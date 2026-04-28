'use server';

import { db, auth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Conversation, Offer } from '@/types';

/**
 * Employer sends an offer to a candidate within a conversation.
 */
export async function sendOfferAction(
    idToken: string,
    conversationId: string,
    jobId: string,
    offerDetails: {
        bonusAmount: number;
        proposedStartDate: string;
        message: string;
    },
) {
    try {
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const userId = decodedToken.uid;

        // Verify user is an employer and resolve companyId
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists || userDoc.data()?.role !== 'employer') {
            return { success: false, error: 'Only employers can send offers' };
        }
        const companyId = userDoc.data()?.companyId || null;

        // Verify conversation exists and employer is a participant
        const convRef = db.collection('conversations').doc(conversationId);
        const convDoc = await convRef.get();
        if (!convDoc.exists) {
            return { success: false, error: 'Conversation not found' };
        }
        const convData = convDoc.data() as Conversation;
        const isParticipant = convData.participantIds.includes(userId)
            || (companyId && convData.participantIds.includes(companyId));
        if (!isParticipant) {
            return { success: false, error: 'You are not a participant in this conversation' };
        }

        // Verify the jobId matches the conversation's job
        if (convData.jobId !== jobId) {
            return { success: false, error: 'Job does not match this conversation' };
        }

        // Enforce Tier 3 (Identity) minimum before offers can be sent.
        // Accepting an offer creates a legal commitment agreement with real names,
        // so both parties must have consented to identity reveal first.
        if ((convData.currentMessagingTier || 1) < 3) {
            return {
                success: false,
                error: 'Both parties must reach Identity Tier (Tier 3) before sending an offer. Upgrade the reveal level first.',
            };
        }

        // Check no pending offer already exists for this conversation
        const existingOffers = await db.collection('offers')
            .where('conversationId', '==', conversationId)
            .where('status', '==', 'pending')
            .limit(1)
            .get();
        if (!existingOffers.empty) {
            return { success: false, error: 'There is already a pending offer in this conversation' };
        }

        // Determine candidate ID (the other participant — not the employer or their company)
        const candidateId = convData.participantIds.find(id => id !== userId && id !== companyId);
        if (!candidateId) {
            return { success: false, error: 'Could not determine candidate' };
        }

        // Validate offer details
        if (!offerDetails.bonusAmount || offerDetails.bonusAmount < 50) {
            return { success: false, error: 'Sign-on bonus must be at least $50' };
        }
        if (!offerDetails.proposedStartDate) {
            return { success: false, error: 'Proposed start date is required' };
        }

        const now = new Date().toISOString();
        const offerRef = db.collection('offers').doc();

        const batch = db.batch();

        // Create the offer document (participantIds denormalized for Firestore rules)
        batch.set(offerRef, {
            id: offerRef.id,
            conversationId,
            jobId,
            employerId: userId,
            candidateId,
            participantIds: convData.participantIds,
            bonusAmount: offerDetails.bonusAmount,
            proposedStartDate: offerDetails.proposedStartDate,
            message: offerDetails.message || '',
            status: 'pending',
            createdAt: now,
        });

        // Send a system message in the conversation
        const messageRef = convRef.collection('messages').doc();
        const systemContent = `[OFFER] An offer has been sent for this position with a $${offerDetails.bonusAmount.toLocaleString()} sign-on bonus and a proposed start date of ${offerDetails.proposedStartDate}. ${offerDetails.message ? `Message: "${offerDetails.message}"` : ''}`;

        batch.set(messageRef, {
            senderId: 'system',
            receiverId: candidateId,
            content: systemContent,
            timestamp: FieldValue.serverTimestamp(),
            revealLevelAtSend: convData.currentMessagingTier,
        });

        batch.update(convRef, {
            'lastMessage.content': systemContent,
            'lastMessage.timestamp': FieldValue.serverTimestamp(),
            'lastMessage.senderId': 'system',
        });

        await batch.commit();

        return { success: true, offerId: offerRef.id };
    } catch (error: any) {
        console.error('[sendOfferAction] Error:', error);
        return { success: false, error: error.message || 'Failed to send offer' };
    }
}

/**
 * Candidate accepts a pending offer.
 */
export async function acceptOfferAction(idToken: string, offerId: string) {
    try {
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const userId = decodedToken.uid;

        // Get the offer
        const offerRef = db.collection('offers').doc(offerId);
        const offerDoc = await offerRef.get();
        if (!offerDoc.exists) {
            return { success: false, error: 'Offer not found' };
        }
        const offer = offerDoc.data() as Offer;

        // Verify the user is the candidate
        if (offer.candidateId !== userId) {
            return { success: false, error: 'Only the candidate can accept this offer' };
        }
        if (offer.status !== 'pending') {
            return { success: false, error: `Offer is already ${offer.status}` };
        }

        const now = new Date().toISOString();

        // Verify conversation reveal tier — both parties must be at Tier 3 (Identity) before
        // accepting an offer, since the commitment agreement contains real identity info.
        const convRef = db.collection('conversations').doc(offer.conversationId);
        const convDoc = await convRef.get();
        const convData = convDoc.data() as Conversation;
        const currentTier = convData?.currentMessagingTier || 1;

        if (currentTier < 3) {
            return {
                success: false,
                error: 'Both parties must upgrade to Identity Tier (Tier 3) before accepting an offer. This protects your anonymity until both sides agree to reveal.',
            };
        }

        // Create commitment agreement — safe to use real names since both parties
        // have mutually consented to Tier 3 (Identity) reveal.
        const employerDoc = await db.collection('users').doc(offer.employerId).get();
        const employerData = employerDoc.data();
        const companyId = employerData?.companyId || offer.employerId;

        const candidateDoc = await db.collection('users').doc(userId).get();
        const candidateData = candidateDoc.data();

        // Get job info for agreement text
        const jobDoc = await db.collection('jobListings').doc(offer.jobId).get();
        const jobData = jobDoc.data();

        const signatureInput = `${offer.employerId}:${now}:${offer.bonusAmount}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(signatureInput);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const employerSignatureHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const candidateSignatureInput = `${userId}:${now}:${offer.bonusAmount}`;
        const candidateData2 = new TextEncoder().encode(candidateSignatureInput);
        const candidateHashBuffer = await crypto.subtle.digest('SHA-256', candidateData2);
        const candidateHashArray = Array.from(new Uint8Array(candidateHashBuffer));
        const candidateSignatureHash = candidateHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Use real names (Tier 3+ verified) for the legal agreement
        const employerDisplayName = employerData?.companyName || employerData?.fullName || 'Employer';
        const candidateDisplayName = candidateData?.fullName || candidateData?.anonymizedName || 'Candidate';
        // Use anonymized title — real title only if Tier 4+
        const roleDisplayName = currentTier >= 4
            ? (jobData?.title || 'Position')
            : (jobData?.anonymizedTitle || 'Confidential Role');

        const agreementText = `BONUS COMMITMENT AGREEMENT

This agreement is made between the Employer (${employerDisplayName}) and the Candidate (${candidateDisplayName}).

ROLE: ${roleDisplayName}
SIGN-ON BONUS: $${offer.bonusAmount.toLocaleString()}
PROPOSED START DATE: ${offer.proposedStartDate}

TERMS:
1. The Employer commits to paying the Candidate a sign-on bonus of $${offer.bonusAmount.toLocaleString()} upon the Candidate's start of employment.
2. Payment of the bonus is a direct obligation between the Employer and the Candidate. TalentOS is NOT a party to the bonus payment.
3. The Candidate may confirm receipt of the bonus or raise a dispute through the TalentSync platform.
4. This agreement is binding as both parties have accepted through TalentSync.

Employer signed at: ${now}
Candidate accepted at: ${now}`;

        const agreementRef = db.collection('commitment_agreements').doc();

        const batch = db.batch();

        // Create commitment agreement
        batch.set(agreementRef, {
            id: agreementRef.id,
            jobId: offer.jobId,
            employerId: offer.employerId,
            employerCompanyId: companyId,
            employerName: employerData?.companyName || employerData?.fullName || 'Unknown',
            candidateId: userId,
            candidateName: candidateData?.fullName || candidateData?.anonymizedName || 'Unknown',
            bonusAmount: offer.bonusAmount,
            terms: agreementText,
            employerSignedAt: now,
            employerSignatureHash,
            candidateAcceptedAt: now,
            candidateSignatureHash,
            status: 'active',
            createdAt: now,
            updatedAt: now,
        });

        // Update the offer
        batch.update(offerRef, {
            status: 'accepted',
            respondedAt: now,
            commitmentAgreementId: agreementRef.id,
        });

        // Update job status to hired
        const jobRef = db.collection('jobListings').doc(offer.jobId);
        batch.update(jobRef, {
            status: 'hired',
            candidateAcceptedAt: now,
            commitmentAgreementId: agreementRef.id,
            commitmentAgreementSignedAt: now,
        });

        // Send system message (convRef already fetched above for tier check)
        const messageRef = convRef.collection('messages').doc();
        const systemContent = `[OFFER ACCEPTED] The offer has been accepted! A Commitment Agreement has been created. The sign-on bonus of $${offer.bonusAmount.toLocaleString()} is due upon the candidate's start date of ${offer.proposedStartDate}. Congratulations to both parties!`;

        batch.set(messageRef, {
            senderId: 'system',
            receiverId: offer.employerId,
            content: systemContent,
            timestamp: FieldValue.serverTimestamp(),
            revealLevelAtSend: convData?.currentMessagingTier || 1,
        });

        batch.update(convRef, {
            'lastMessage.content': systemContent,
            'lastMessage.timestamp': FieldValue.serverTimestamp(),
            'lastMessage.senderId': 'system',
        });

        await batch.commit();

        return { success: true, agreementId: agreementRef.id };
    } catch (error: any) {
        console.error('[acceptOfferAction] Error:', error);
        return { success: false, error: error.message || 'Failed to accept offer' };
    }
}

/**
 * Candidate rejects a pending offer.
 */
export async function rejectOfferAction(idToken: string, offerId: string) {
    try {
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const userId = decodedToken.uid;

        const offerRef = db.collection('offers').doc(offerId);
        const offerDoc = await offerRef.get();
        if (!offerDoc.exists) {
            return { success: false, error: 'Offer not found' };
        }
        const offer = offerDoc.data() as Offer;

        if (offer.candidateId !== userId) {
            return { success: false, error: 'Only the candidate can reject this offer' };
        }
        if (offer.status !== 'pending') {
            return { success: false, error: `Offer is already ${offer.status}` };
        }

        const now = new Date().toISOString();
        const batch = db.batch();

        batch.update(offerRef, {
            status: 'rejected',
            respondedAt: now,
        });

        // Send system message
        const convRef = db.collection('conversations').doc(offer.conversationId);
        const convDoc = await convRef.get();
        const convData = convDoc.data() as Conversation;

        const messageRef = convRef.collection('messages').doc();
        const systemContent = `[OFFER DECLINED] The offer has been declined by the candidate.`;

        batch.set(messageRef, {
            senderId: 'system',
            receiverId: offer.employerId,
            content: systemContent,
            timestamp: FieldValue.serverTimestamp(),
            revealLevelAtSend: convData?.currentMessagingTier || 1,
        });

        batch.update(convRef, {
            'lastMessage.content': systemContent,
            'lastMessage.timestamp': FieldValue.serverTimestamp(),
            'lastMessage.senderId': 'system',
        });

        await batch.commit();

        return { success: true };
    } catch (error: any) {
        console.error('[rejectOfferAction] Error:', error);
        return { success: false, error: error.message || 'Failed to reject offer' };
    }
}

/**
 * Employer withdraws a pending offer.
 */
export async function withdrawOfferAction(idToken: string, offerId: string) {
    try {
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const userId = decodedToken.uid;

        const offerRef = db.collection('offers').doc(offerId);
        const offerDoc = await offerRef.get();
        if (!offerDoc.exists) {
            return { success: false, error: 'Offer not found' };
        }
        const offer = offerDoc.data() as Offer;

        if (offer.employerId !== userId) {
            return { success: false, error: 'Only the employer can withdraw this offer' };
        }
        if (offer.status !== 'pending') {
            return { success: false, error: `Offer is already ${offer.status}` };
        }

        const now = new Date().toISOString();
        const batch = db.batch();

        batch.update(offerRef, {
            status: 'withdrawn',
            respondedAt: now,
        });

        // Send system message
        const convRef = db.collection('conversations').doc(offer.conversationId);
        const convDoc = await convRef.get();
        const convData = convDoc.data() as Conversation;

        const messageRef = convRef.collection('messages').doc();
        const systemContent = `[OFFER WITHDRAWN] The employer has withdrawn the offer.`;

        batch.set(messageRef, {
            senderId: 'system',
            receiverId: offer.candidateId,
            content: systemContent,
            timestamp: FieldValue.serverTimestamp(),
            revealLevelAtSend: convData?.currentMessagingTier || 1,
        });

        batch.update(convRef, {
            'lastMessage.content': systemContent,
            'lastMessage.timestamp': FieldValue.serverTimestamp(),
            'lastMessage.senderId': 'system',
        });

        await batch.commit();

        return { success: true };
    } catch (error: any) {
        console.error('[withdrawOfferAction] Error:', error);
        return { success: false, error: error.message || 'Failed to withdraw offer' };
    }
}
