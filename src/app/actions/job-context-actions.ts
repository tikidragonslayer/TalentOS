'use server';

import { db, auth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { CREDIT_COSTS } from '@/lib/credit-costs';

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

        // Run AI work AFTER credits have been deducted
        let result: JobContextResult;
        try {
            // In a real scenario, we would send this transcript to a high-reasoning model (Gemini 1.5 Pro)
            // to infer the "vibe" and "hidden requirements".

            // Simulating AI delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Mock Analysis based on transcript content (basic keyword heuristics for demo)
            const isRemote = transcript.toLowerCase().includes('remote');
            const isFastPaced = transcript.toLowerCase().includes('fast') || transcript.toLowerCase().includes('ship');
            const isMentorship = transcript.toLowerCase().includes('mentor') || transcript.toLowerCase().includes('learn');

            result = {
                cultureAnalysis: isFastPaced
                    ? "High-velocity delivery environment. Values shipping over perfection. Suitable for self-starters."
                    : "Structured, methodical engineering culture. Values correctness and stability.",

                hiddenRequirements: [
                    isRemote ? "Strong written communication skills (Async)" : "In-person collaboration capability",
                    "Ability to navigate ambiguity",
                    "Ownership mindset"
                ],
                teamDynamic: isMentorship
                    ? "Collaborative, teaching-focused team structure."
                    : "Senior-heavy, autonomous squad structure.",
                recommendedKeywords: ["Agile", "Ownership", "System Design", "Communication"]
            };
        } catch (aiError) {
            // AI failed — refund the credits
            console.error("AI call failed, refunding credits:", aiError);
            await userRef.update({
                osCredits: FieldValue.increment(+CREDIT_COSTS.JOB_CONTEXT_EXTRACTION),
            });
            return { success: false, error: "Failed to extract job context. Credits have been refunded." };
        }

        return { success: true, data: result, remainingCredits };

    } catch (error) {
        console.error("Job Context Extraction Failed:", error);
        return { success: false, error: "Failed to extract job context." };
    }
}
