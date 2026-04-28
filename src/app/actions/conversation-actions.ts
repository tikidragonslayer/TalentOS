'use server';

import { db, auth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Conversation, MatchScore, UserProfile } from '@/types';

/**
 * Initiate a conversation from a match. Server-side validated:
 * - Verifies auth token
 * - Confirms match exists and belongs to the user
 * - Prevents duplicate conversations for the same job+candidate pair
 * - Creates conversation doc with proper structure
 */
export async function initiateConversationAction(
    idToken: string,
    matchScoreId: string,
) {
    try {
        // 1. Verify auth
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const userId = decodedToken.uid;

        // 2. Get the match score to verify ownership and get job details
        const matchDoc = await db.collection('matchScores').doc(matchScoreId).get();
        if (!matchDoc.exists) {
            return { success: false, error: 'Match not found' };
        }
        const matchData = matchDoc.data() as MatchScore;

        // Verify the requesting user is the candidate in the match
        if (matchData.userProfileId !== userId) {
            return { success: false, error: 'You are not authorized to initiate this conversation' };
        }

        // 3. Get the job listing to find the employer's company
        const companyId = matchData.jobPostingSnapshot?.companyId;
        if (!companyId) {
            return { success: false, error: 'Job posting has no associated company' };
        }

        // 4. Check for existing conversation for this job+candidate pair
        const existingConv = await db.collection('conversations')
            .where('participantIds', 'array-contains', userId)
            .where('jobId', '==', matchData.jobListingId)
            .limit(1)
            .get();

        if (!existingConv.empty) {
            // Already exists — return existing conversation ID
            return { success: true, conversationId: existingConv.docs[0].id, existing: true };
        }

        // 5. Get user profile for snapshot
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        // 6. Create the conversation
        const newConversation: Omit<Conversation, 'id'> = {
            participantIds: [userId, companyId],
            jobId: matchData.jobListingId,
            jobPostingSnapshot: matchData.jobPostingSnapshot || {},
            candidateProfileSnapshot: {
                anonymizedName: userData?.anonymizedName || 'Anonymous Candidate',
                mbti: userData?.mbti,
            },
            currentMessagingTier: 1,
            totalCost: 0,
            lastMessage: {
                content: `Expressed interest in ${matchData.jobPostingSnapshot?.title || 'a position'}.`,
                senderId: userId,
                timestamp: FieldValue.serverTimestamp() as any,
            },
        };

        const docRef = await db.collection('conversations').add(newConversation);

        return { success: true, conversationId: docRef.id };
    } catch (error: any) {
        console.error('[initiateConversation] Error:', error);
        return { success: false, error: error.message || 'Failed to create conversation' };
    }
}

/**
 * Employer-initiated conversation from the applicants page.
 * - Verifies the employer owns the company that posted the job
 * - Finds or creates a conversation for the match
 */
export async function employerInitiateConversationAction(
    idToken: string,
    matchScoreId: string,
) {
    try {
        // 1. Verify auth
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const employerUid = decodedToken.uid;

        // 2. Get the match score
        const matchDoc = await db.collection('matchScores').doc(matchScoreId).get();
        if (!matchDoc.exists) {
            return { success: false, error: 'Match not found' };
        }
        const matchData = matchDoc.data() as MatchScore;

        // 3. Verify the employer owns the company that posted this job
        const companyId = matchData.jobPostingSnapshot?.companyId;
        if (!companyId) {
            return { success: false, error: 'Job posting has no associated company' };
        }
        const companyDoc = await db.collection('companies').doc(companyId).get();
        if (!companyDoc.exists || companyDoc.data()?.ownerId !== employerUid) {
            return { success: false, error: 'You are not authorized to contact this candidate' };
        }

        const candidateId = matchData.userProfileId;

        // 4. Check for existing conversation for this job+candidate pair
        const existingConv = await db.collection('conversations')
            .where('participantIds', 'array-contains', candidateId)
            .where('jobId', '==', matchData.jobListingId)
            .limit(1)
            .get();

        if (!existingConv.empty) {
            return { success: true, conversationId: existingConv.docs[0].id, existing: true };
        }

        // 5. Get candidate profile for snapshot
        const candidateDoc = await db.collection('users').doc(candidateId).get();
        const candidateData = candidateDoc.data() as UserProfile | undefined;

        // 6. Create the conversation
        const newConversation: Omit<Conversation, 'id'> = {
            participantIds: [candidateId, companyId],
            jobId: matchData.jobListingId,
            jobPostingSnapshot: matchData.jobPostingSnapshot || {},
            candidateProfileSnapshot: {
                anonymizedName: candidateData?.anonymizedName || 'Anonymous Candidate',
                mbti: candidateData?.mbti,
            },
            currentMessagingTier: 1,
            totalCost: 0,
            lastMessage: {
                content: `Employer expressed interest in your profile for ${matchData.jobPostingSnapshot?.title || 'a position'}.`,
                senderId: companyId,
                timestamp: FieldValue.serverTimestamp() as any,
            },
        };

        const docRef = await db.collection('conversations').add(newConversation);

        return { success: true, conversationId: docRef.id };
    } catch (error: any) {
        console.error('[employerInitiateConversation] Error:', error);
        return { success: false, error: error.message || 'Failed to create conversation' };
    }
}
