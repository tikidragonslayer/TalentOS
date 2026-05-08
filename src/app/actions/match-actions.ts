'use server';

import { db, auth } from '@/lib/firebase-admin';
import { UserProfile, JobPosting, MatchScore } from '@/types';
import { matchCandidateToJob } from '@/ai/flows/match-candidate-to-job';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { CREDIT_COSTS } from '@/lib/credit-costs';

/**
 * Strip PII from a candidate profile before sending to the AI matching flow.
 * Shared between scanForMatchesAction and _matchCandidatesToJobInternal.
 */
function stripPII(userProfile: UserProfile): Partial<UserProfile> {
    return {
        id: userProfile.id,
        role: userProfile.role,
        anonymizedName: userProfile.anonymizedName,
        location: userProfile.location,
        locationPreference: userProfile.locationPreference,
        anonymizedExperienceSummary: userProfile.anonymizedExperienceSummary,
        skills: userProfile.skills,
        verifiedSkills: userProfile.verifiedSkills,
        profileTags: userProfile.profileTags,
        bigFive: userProfile.bigFive,
        mbti: userProfile.mbti,
        currentRevealLevel: userProfile.currentRevealLevel,
        humanityScore: userProfile.humanityScore,
        osCredits: userProfile.osCredits,
    };
}

/**
 * Internal function: Match ALL candidates against a job.
 * NOT exported — only callable from server-side code (Stripe webhook, etc.).
 * No auth check because the caller is trusted server code.
 */
export async function _matchCandidatesToJobInternal(
    jobId: string
): Promise<{ success: boolean; count?: number; error?: string; message?: string }> {
    console.log(`[matchCandidatesToJob] Starting match scan for job ${jobId}...`);

    try {
        // 1. Fetch the job listing
        const jobDoc = await db.collection('jobListings').doc(jobId).get();
        if (!jobDoc.exists) {
            return { success: false, error: 'Job listing not found.' };
        }
        const jobData = { id: jobDoc.id, ...jobDoc.data() } as JobPosting;

        if (jobData.status !== 'open') {
            return { success: false, error: 'Job is not in open status. Cannot run matching.' };
        }

        // 2. Fetch all candidate profiles
        const candidatesSnapshot = await db.collection('users')
            .where('role', '==', 'candidate')
            .get();

        if (candidatesSnapshot.empty) {
            return { success: true, count: 0, message: 'No candidate profiles found.' };
        }

        let totalMatches = 0;

        // 3. For each candidate with a usable profile, run AI matching
        for (const candidateDoc of candidatesSnapshot.docs) {
            const candidateData = { id: candidateDoc.id, ...candidateDoc.data() } as UserProfile;

            // Skip candidates missing essential profile data
            if (!candidateData.skills?.length && !candidateData.location) {
                console.log(`[matchCandidatesToJob] Skipping candidate ${candidateData.id} — incomplete profile`);
                continue;
            }

            try {
                const safeProfile = stripPII(candidateData) as UserProfile;

                // Run AI matching for this candidate
                const aiResult = await matchCandidateToJob({ candidateProfile: safeProfile });

                if (!aiResult.matches || aiResult.matches.length === 0) {
                    continue;
                }

                // Filter to only matches for THIS specific job
                const relevantMatches = aiResult.matches.filter(m => m.jobId === jobId);

                if (relevantMatches.length === 0) {
                    continue;
                }

                // 4. Save match results to matchScores collection
                const batch = db.batch();
                const matchesCollection = db.collection('matchScores');

                for (const match of relevantMatches) {
                    const matchRef = matchesCollection.doc(`${candidateData.id}_${match.jobId}`);

                    const matchScore: MatchScore = {
                        id: matchRef.id,
                        userProfileId: candidateData.id,
                        jobListingId: match.jobId,
                        score: match.matchScore,
                        breakdown: match.breakdown,
                        justification: match.justification,
                        jobPostingSnapshot: {
                            title: jobData.anonymizedTitle || jobData.title,
                            anonymizedTitle: jobData.anonymizedTitle,
                            companyId: jobData.companyId,
                            location: jobData.location,
                            anonymizedDescription: jobData.anonymizedDescription,
                            idealCandidateMbti: jobData.idealCandidateMbti,
                            bonusAmount: jobData.bonusAmount,
                        },
                        // Public-safe candidate fields. Employer applicants page
                        // reads this instead of fetching /users/{uid}.
                        candidateSnapshot: {
                            anonymizedName: candidateData.anonymizedName,
                            humanityScore: candidateData.humanityScore,
                            mbti: candidateData.mbti,
                            skills: candidateData.skills,
                            profileTags: candidateData.profileTags,
                            proofOfLearnCredentials: candidateData.proofOfLearnCredentials,
                        },
                    };

                    batch.set(matchRef, matchScore, { merge: true });
                    totalMatches++;
                }

                await batch.commit();
            } catch (candidateError) {
                console.error(`[matchCandidatesToJob] Error matching candidate ${candidateData.id}:`, candidateError);
                // Continue with next candidate — don't fail the whole batch
            }
        }

        console.log(`[matchCandidatesToJob] Completed. Found ${totalMatches} matches for job ${jobId}.`);
        revalidatePath('/candidate/matches');
        revalidatePath('/employer/jobs');

        return { success: true, count: totalMatches };

    } catch (error) {
        console.error('[matchCandidatesToJob] Fatal error:', error);
        return { success: false, error: 'Failed to run candidate matching.' };
    }
}

/**
 * Exported server action: Match ALL candidates against a job.
 * ALWAYS requires auth — the caller must be the employer who owns the job.
 */
export async function matchCandidatesToJobAction(
    idToken: string,
    jobId: string
): Promise<{ success: boolean; count?: number; error?: string; message?: string }> {
    // Auth is REQUIRED — verify the caller owns the job
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch {
        return { success: false, error: 'Invalid authentication token' };
    }

    // Verify the caller is the employer who owns this job
    const jobDoc = await db.collection('jobListings').doc(jobId).get();
    if (!jobDoc.exists) {
        return { success: false, error: 'Job not found' };
    }
    const jobData = jobDoc.data() as JobPosting;
    const companyDoc = await db.collection('companies').doc(jobData.companyId).get();
    if (!companyDoc.exists || companyDoc.data()?.ownerId !== decodedToken.uid) {
        return { success: false, error: 'Unauthorized: you do not own this job listing' };
    }

    return _matchCandidatesToJobInternal(jobId);
}

export async function scanForMatchesAction(idToken: string) {
    // Verify auth — never trust client-supplied userId
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch {
        return { success: false, error: 'Invalid authentication token' };
    }
    const userId = decodedToken.uid;

    console.log(`Scanning matches for User ${userId}...`);

    try {
        // 1. Fetch User Profile and atomically deduct credits in a transaction
        const userRef = db.collection('users').doc(userId);
        let userProfile: UserProfile;

        const txResult = await db.runTransaction(async (tx) => {
            const userDoc = await tx.get(userRef);
            if (!userDoc.exists) {
                return { abort: true, error: "User profile not found." };
            }
            userProfile = { id: userDoc.id, ...userDoc.data() } as UserProfile;

            // 2. Check match eligibility requirements
            if (!userProfile.mbti) {
                return { abort: true, error: 'Please complete the MBTI personality test before scanning for matches.' };
            }
            if (!userProfile.bigFive) {
                return { abort: true, error: 'Please complete the Big Five personality test before scanning for matches.' };
            }
            if (!userProfile.verifiedSkills || userProfile.verifiedSkills.length === 0) {
                return { abort: true, error: 'Please verify at least one skill before scanning for matches.' };
            }
            if (!userProfile.humanityScore || userProfile.humanityScore < 50) {
                return { abort: true, error: 'Your humanity score is too low. Please complete a skill verification to improve it.' };
            }

            // 3. Check credit balance and deduct atomically
            const currentCredits = userProfile.osCredits || 0;
            if (currentCredits < CREDIT_COSTS.MATCH_SCAN) {
                return {
                    abort: true,
                    error: `Insufficient OS Credits. You need ${CREDIT_COSTS.MATCH_SCAN} credit(s).`,
                    remainingCredits: currentCredits
                };
            }

            // Deduct credits atomically inside the transaction
            tx.update(userRef, {
                osCredits: FieldValue.increment(-CREDIT_COSTS.MATCH_SCAN),
            });

            return { abort: false, creditsAfter: currentCredits - CREDIT_COSTS.MATCH_SCAN };
        });

        if (txResult.abort) {
            return { success: false, error: txResult.error, remainingCredits: (txResult as any).remainingCredits };
        }

        const remainingCredits = txResult.creditsAfter!;

        // 4. Strip PII before passing to AI — only send anonymized/safe fields
        // NEVER send fullName, email, or experienceSummary to the LLM
        const safeProfile = stripPII(userProfile!);

        // 5. Fetch Open Jobs
        const jobsSnapshot = await db.collection('jobListings')
            .where('status', '==', 'open')
            .limit(20)
            .get();

        if (jobsSnapshot.empty) {
            // Refund credits — no work was done
            await userRef.update({
                osCredits: FieldValue.increment(+CREDIT_COSTS.MATCH_SCAN),
            });
            return { success: true, message: "No open jobs found to match against." };
        }

        // 6. Run AI Matching with PII-stripped profile
        let aiResult;
        try {
            aiResult = await matchCandidateToJob({ candidateProfile: safeProfile as UserProfile });
        } catch (aiError) {
            // AI failed — refund the credits
            console.error("AI matching failed, refunding credits:", aiError);
            await userRef.update({
                osCredits: FieldValue.increment(+CREDIT_COSTS.MATCH_SCAN),
            });
            return { success: false, error: "Failed to scan for matches. Credits have been refunded." };
        }

        if (!aiResult.matches || aiResult.matches.length === 0) {
            return { success: true, count: 0, message: "AI found no strong matches.", remainingCredits };
        }

        // 7. Save Matches to Firestore
        const batch = db.batch();
        const matchesCollection = db.collection('matchScores');

        const jobIds = aiResult.matches.map(m => m.jobId);
        const jobDocs = await Promise.all(jobIds.map(id => db.collection('jobListings').doc(id).get()));

        let newMatchCount = 0;

        for (const match of aiResult.matches) {
            const jobDoc = jobDocs.find(d => d.id === match.jobId);
            if (!jobDoc?.exists) continue;
            const jobData = jobDoc.data() as JobPosting;

            const matchRef = matchesCollection.doc(`${userId}_${match.jobId}`);

            // Only store anonymized fields in the snapshot
            const matchScore: MatchScore = {
                id: matchRef.id,
                userProfileId: userId,
                jobListingId: match.jobId,
                score: match.matchScore,
                breakdown: match.breakdown,
                justification: match.justification,
                jobPostingSnapshot: {
                    title: jobData.anonymizedTitle || jobData.title,
                    anonymizedTitle: jobData.anonymizedTitle,
                    companyId: jobData.companyId,
                    location: jobData.location,
                    anonymizedDescription: jobData.anonymizedDescription,
                    idealCandidateMbti: jobData.idealCandidateMbti,
                    bonusAmount: jobData.bonusAmount,
                },
                // Public-safe candidate fields. Employer applicants page
                // reads this instead of fetching /users/{uid}.
                candidateSnapshot: {
                    anonymizedName: userProfile!.anonymizedName,
                    humanityScore: userProfile!.humanityScore,
                    mbti: userProfile!.mbti,
                    skills: userProfile!.skills,
                    profileTags: userProfile!.profileTags,
                    proofOfLearnCredentials: userProfile!.proofOfLearnCredentials,
                },
            };

            batch.set(matchRef, matchScore, { merge: true });
            newMatchCount++;
        }

        await batch.commit();

        revalidatePath('/candidate/matches');

        return { success: true, count: newMatchCount, remainingCredits };

    } catch (error) {
        console.error("Match Scan Error:", error);
        return { success: false, error: "Failed to scan for matches." };
    }
}
