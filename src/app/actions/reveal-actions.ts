'use server';

import { db, auth } from '@/lib/firebase-admin';
import type { RevealRequest, Conversation, UserProfile, Company } from '@/types';
import { FieldValue } from 'firebase-admin/firestore';
import { REVEAL_TIERS, type RevealTierKey } from '@/lib/reveal-tiers';

/**
 * Resolve the credit-holding document ref and current balance for a participant.
 * Candidates own credits directly; employers own credits via their Company doc.
 */
async function resolveCreditsRef(
    userId: string,
    transaction: FirebaseFirestore.Transaction
): Promise<{ ref: FirebaseFirestore.DocumentReference; credits: number } | null> {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) return null;

    const userData = userDoc.data() as UserProfile;

    if (userData.role === 'candidate') {
        return { ref: userRef, credits: userData.osCredits || 0 };
    }

    // Employer — credits live on the Company doc
    const companyId = (userData as any).companyId;
    if (!companyId) return null;

    const companyRef = db.collection('companies').doc(companyId);
    const companyDoc = await transaction.get(companyRef);
    if (!companyDoc.exists) return null;

    const companyData = companyDoc.data() as Company;
    return { ref: companyRef, credits: companyData.osCredits || 0 };
}

/**
 * Request a reveal tier upgrade. Auth-verified server action.
 * Now accepts idToken instead of trusting client-supplied requesterId.
 */
export async function requestRevealAction(idToken: string, conversationId: string, newTier: number) {
    try {
        // Verify auth token — never trust client-supplied userId
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const requesterId = decodedToken.uid;

        const convRef = db.collection('conversations').doc(conversationId);
        const convDoc = await convRef.get();

        if (!convDoc.exists) {
            return { success: false, error: "Conversation not found" };
        }

        const convData = convDoc.data() as Conversation;

        // Resolve companyId for employers (conversations store companyId, not employer UID)
        const requesterDoc = await db.collection('users').doc(requesterId).get();
        const requesterCompanyId = requesterDoc.exists ? requesterDoc.data()?.companyId : null;

        // Verify requester is a participant
        const isParticipant = convData.participantIds.includes(requesterId)
            || (requesterCompanyId && convData.participantIds.includes(requesterCompanyId));
        if (!isParticipant) {
            return { success: false, error: "You are not a participant in this conversation" };
        }

        const receiverId = convData.participantIds.find(id => id !== requesterId && id !== requesterCompanyId);
        if (!receiverId) {
            return { success: false, error: "Could not determine receiver ID" };
        }

        // Validate tier progression
        if (newTier !== convData.currentMessagingTier + 1 || newTier > 5) {
            return { success: false, error: "Invalid tier upgrade request" };
        }

        // Check for existing pending request
        const existingRequests = await db.collection('revealRequests')
            .where('conversationId', '==', conversationId)
            .where('status', '==', 'pending')
            .get();

        if (!existingRequests.empty) {
            return { success: false, message: "A reveal request is already pending." };
        }

        // Pre-check: verify requester has sufficient credits
        const tierCost = REVEAL_TIERS[newTier as RevealTierKey].cost;
        if (tierCost > 0) {
            const requesterCredits = await db.runTransaction(async (transaction) => {
                const resolved = await resolveCreditsRef(requesterId, transaction);
                return resolved?.credits ?? 0;
            });

            if (requesterCredits < tierCost) {
                return { success: false, error: `Insufficient OS Credits. You need ${tierCost} credit(s) but have ${requesterCredits}.` };
            }
        }

        await db.collection('revealRequests').add({
            conversationId,
            requesterId,
            receiverId,
            participantIds: convData.participantIds, // Denormalized for Firestore rules
            targetTier: newTier,
            status: 'pending',
            timestamp: FieldValue.serverTimestamp(),
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error requesting reveal:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Approve a reveal request. Auth-verified — checks approverId via token.
 * Deducts OS Credits from both parties atomically.
 */
export async function approveRevealAction(idToken: string, requestId: string) {
    try {
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const approverId = decodedToken.uid;

        const requestRef = db.collection('revealRequests').doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            return { success: false, error: "Request not found" };
        }

        const requestData = requestDoc.data() as RevealRequest;

        if (requestData.status !== 'pending') {
            return { success: false, error: "Request is not pending" };
        }

        // Dual-consent: approver must be the receiver, not the requester
        if (requestData.requesterId === approverId) {
            return { success: false, error: "You cannot approve your own request." };
        }
        if (requestData.receiverId !== approverId) {
            return { success: false, error: "You are not authorized to approve this request." };
        }

        const targetTier = requestData.targetTier as RevealTierKey;
        const tierCost = REVEAL_TIERS[targetTier].cost;
        const conversationRef = db.collection('conversations').doc(requestData.conversationId);

        await db.runTransaction(async (transaction) => {
            // Deduct credits from both parties if cost > 0
            if (tierCost > 0) {
                const requesterCredits = await resolveCreditsRef(requestData.requesterId, transaction);
                const approverCredits = await resolveCreditsRef(approverId, transaction);

                if (!requesterCredits || !approverCredits) {
                    throw new Error("Could not resolve credit accounts for both parties.");
                }

                if (requesterCredits.credits < tierCost) {
                    throw new Error(`Requester has insufficient OS Credits (needs ${tierCost}, has ${requesterCredits.credits}).`);
                }
                if (approverCredits.credits < tierCost) {
                    throw new Error(`You have insufficient OS Credits (needs ${tierCost}, has ${approverCredits.credits}).`);
                }

                transaction.update(requesterCredits.ref, { osCredits: requesterCredits.credits - tierCost });

                // If both parties share the same credit doc (same company), only deduct once
                if (approverCredits.ref.path !== requesterCredits.ref.path) {
                    transaction.update(approverCredits.ref, { osCredits: approverCredits.credits - tierCost });
                }
            }

            transaction.update(requestRef, { status: 'approved' });
            transaction.update(conversationRef, {
                currentMessagingTier: requestData.targetTier,
            });
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error approving reveal:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Reject a reveal request. Auth-verified.
 */
export async function rejectRevealAction(idToken: string, requestId: string) {
    try {
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const userId = decodedToken.uid;

        const requestRef = db.collection('revealRequests').doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            return { success: false, error: "Request not found" };
        }

        const requestData = requestDoc.data() as RevealRequest;

        // Either participant can reject/cancel
        if (requestData.requesterId !== userId && requestData.receiverId !== userId) {
            return { success: false, error: "You are not authorized to reject this request." };
        }

        await requestRef.update({ status: 'rejected' });
        return { success: true };
    } catch (error: any) {
        console.error("Error rejecting reveal:", error);
        return { success: false, error: error.message };
    }
}
