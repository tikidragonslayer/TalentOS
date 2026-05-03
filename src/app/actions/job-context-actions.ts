'use server';

import { db, auth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { CREDIT_COSTS } from '@/lib/credit-costs';
import { extractJobContext } from '@/ai/flows/extract-job-context';

export interface JobContextResult {
    cultureAnalysis: string;
    hiddenRequirements: string[];
    teamDynamic: string;
    recommendedKeywords: string[];
}

export async function extractJobContextAction(
    idToken: string,
    transcript: string
): Promise<{ success: boolean; data?: JobContextResult; error?: string; remainingCredits?: number }> {
    // Verify auth — never trust client-supplied userId
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch {
        return { success: false, error: 'Invalid authentication token' };
    }
    const userId = decodedToken.uid;

    try {
        if (transcript.length > 20000) {
            return { success: false, error: 'Input exceeds maximum length.' };
        }

        console.log("Extracting Job Context from transcript length:", transcript.length);

        // Atomically check balance and deduct credits BEFORE doing AI work
        const userRef = db.collection('users').doc(userId);

        const txResult = await db.runTransaction(async (tx) => {
            const userDoc = await tx.get(userRef);
            if (!userDoc.exists) {
                return { abort: true as const, error: 'User profile not found.' };
            }
            const userData = userDoc.data()!;
            const currentCredits = userData.osCredits || 0;

            if (currentCredits < CREDIT_COSTS.JOB_CONTEXT_EXTRACTION) {
                return {
                    abort: true as const,
                    error: `Insufficient OS Credits. You need ${CREDIT_COSTS.JOB_CONTEXT_EXTRACTION} credit(s).`,
                    remainingCredits: currentCredits
                };
            }

            // Deduct credits atomically inside the transaction
            tx.update(userRef, {
                osCredits: FieldValue.increment(-CREDIT_COSTS.JOB_CONTEXT_EXTRACTION),
            });

            return { abort: false as const, creditsAfter: currentCredits - CREDIT_COSTS.JOB_CONTEXT_EXTRACTION };
        });

        if (txResult.abort) {
            return { success: false, error: txResult.error, remainingCredits: (txResult as any).remainingCredits };
        }

        const remainingCredits = txResult.creditsAfter!;

        // Run AI work AFTER credits have been deducted.
        // Fail-closed: if the configured AI provider rejects or is missing,
        // we refund the credit and surface the error. We do NOT fall back
        // to keyword heuristics — that was the prior bug.
        let result: JobContextResult;
        try {
            const aiResult = await extractJobContext({ transcript });
            result = {
                cultureAnalysis: aiResult.cultureAnalysis,
                hiddenRequirements: aiResult.hiddenRequirements,
                teamDynamic: aiResult.teamDynamic,
                recommendedKeywords: aiResult.recommendedKeywords,
            };
        } catch (aiError) {
            // AI failed — refund the credit and surface a useful message.
            console.error("Job context AI call failed, refunding credit:", aiError);
            await userRef.update({
                osCredits: FieldValue.increment(+CREDIT_COSTS.JOB_CONTEXT_EXTRACTION),
            });
            const message =
                aiError instanceof Error
                    ? aiError.message
                    : "Unknown AI extraction failure.";
            return {
                success: false,
                error: `Failed to extract job context: ${message} Your credit has been refunded.`,
                remainingCredits: remainingCredits + CREDIT_COSTS.JOB_CONTEXT_EXTRACTION,
            };
        }

        return { success: true, data: result, remainingCredits };

    } catch (error) {
        console.error("Job Context Extraction Failed:", error);
        return { success: false, error: "Failed to extract job context." };
    }
}
