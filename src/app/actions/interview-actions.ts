"use server";

import { verifyCandidateSkills, VerifyCandidateSkillsInput } from '@/ai/flows/verify-candidate-skills';
import { generateInterviewFollowup, GenerateInterviewFollowupInput } from '@/ai/flows/generate-interview-followup';
import { FieldValue } from 'firebase-admin/firestore';
import { db, auth } from '@/lib/firebase-admin';
import { CREDIT_COSTS } from '@/lib/credit-costs';
import { isValidSkill, canonicalSkillName } from '@/lib/skill-taxonomy';

const RE_VERIFY_COOLDOWN_DAYS = 30;
const FOLLOWUP_RATE_LIMIT = 20; // max calls per hour
const FOLLOWUP_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface ProctoringReportData {
    score: number;
    verdict: 'pass' | 'warning' | 'fail';
    flags: string[];
    breakdown: Record<string, number>;
}

export async function verifyCandidateSkillsAction(
    idToken: string,
    input: VerifyCandidateSkillsInput & { proctoringReport?: ProctoringReportData | null }
) {
    try {
        // Verify auth — never trust client-supplied userId
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const userId = decodedToken.uid;

        if (input.interviewTranscript.length > 20000) {
            return { success: false, error: 'Input exceeds maximum length.' };
        }
        if (input.targetJobRole.length > 100) {
            return { success: false, error: 'Input exceeds maximum length.' };
        }

        console.log("Starting Skill Verification for role:", input.targetJobRole);

        // Extract proctoring report before sending to AI flow (not part of the schema)
        const proctoringReport = input.proctoringReport ?? null;
        delete (input as any).proctoringReport;

        // Block submission if proctoring score is a hard fail
        if (proctoringReport && proctoringReport.verdict === 'fail') {
            return {
                success: false,
                error: 'Session flagged by proctoring system. Please retake the verification in a proctored environment.',
            };
        }

        // Validate skill against taxonomy (server-side enforcement)
        const canonical = canonicalSkillName(input.targetJobRole);
        if (!canonical) {
            return { success: false, error: `"${input.targetJobRole}" is not a recognized skill.` };
        }
        // Normalize the skill name to canonical casing
        input.targetJobRole = canonical;

        // Atomically check balance and deduct credits BEFORE calling AI
        const userRef = db.collection('users').doc(userId);
        let userData: FirebaseFirestore.DocumentData;
        let existingEntry: any;

        const txResult = await db.runTransaction(async (tx) => {
            const userDoc = await tx.get(userRef);
            if (!userDoc.exists) {
                return { abort: true, error: 'User profile not found.' };
            }
            userData = userDoc.data()!;

            // Role check: only candidates can verify skills
            if (userData.role !== 'candidate') {
                return { abort: true, error: 'Only candidates can verify skills.' };
            }

            const currentCredits = userData.osCredits || 0;

            if (currentCredits < CREDIT_COSTS.SKILL_VERIFICATION) {
                return {
                    abort: true,
                    error: `Insufficient OS Credits. You need ${CREDIT_COSTS.SKILL_VERIFICATION} credits.`,
                    remainingCredits: currentCredits
                };
            }

            // Check for duplicate verification within cooldown period
            const existingSkills: any[] = userData.verifiedSkills || [];
            existingEntry = existingSkills.find(
                (vs: any) => vs.skill.toLowerCase() === canonical.toLowerCase()
            );
            if (existingEntry) {
                const verifiedDate = new Date(existingEntry.verificationDate);
                const daysSince = Math.floor((Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSince < RE_VERIFY_COOLDOWN_DAYS) {
                    const reVerifyDate = new Date(verifiedDate.getTime() + RE_VERIFY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
                    return {
                        abort: true,
                        error: `You've already verified this skill recently. You can re-verify after ${reVerifyDate.toLocaleDateString()}.`
                    };
                }
            }

            // Deduct credits atomically inside the transaction
            tx.update(userRef, {
                osCredits: FieldValue.increment(-CREDIT_COSTS.SKILL_VERIFICATION),
            });

            return { abort: false, creditsAfter: currentCredits - CREDIT_COSTS.SKILL_VERIFICATION };
        });

        if (txResult.abort) {
            return { success: false, error: txResult.error, remainingCredits: (txResult as any).remainingCredits };
        }

        const remainingCredits = txResult.creditsAfter!;

        // Run Genkit Flow AFTER credits have been deducted
        let result;
        try {
            result = await verifyCandidateSkills(input);
        } catch (aiError) {
            // AI failed — refund the credits
            console.error("AI call failed, refunding credits:", aiError);
            await userRef.update({
                osCredits: FieldValue.increment(+CREDIT_COSTS.SKILL_VERIFICATION),
            });
            return { success: false, error: "Failed to verify skills. Credits have been refunded." };
        }

        // Persist Verification Result if successful
        if (result.knowledgeScore >= 0) {
            const now = new Date().toISOString();
            const currentHumanityScore = userData!.humanityScore || 0;

            // If re-verifying, remove the old entry first
            if (existingEntry) {
                await userRef.update({
                    verifiedSkills: FieldValue.arrayRemove(existingEntry),
                });
            }

            const updateData: Record<string, any> = {
                verifiedSkills: FieldValue.arrayUnion({
                    skill: input.targetJobRole,
                    score: result.knowledgeScore,
                    humanityScore: result.humanityScore,
                    justification: result.scoreJustification,
                    verificationDate: now,
                    source: 'TalentOS-AI-Verifier-v1',
                    ...(proctoringReport ? {
                        proctoringScore: proctoringReport.score,
                        proctoringVerdict: proctoringReport.verdict,
                        proctoringFlags: proctoringReport.flags,
                    } : {}),
                }),
                // Audit trail — append every humanity score
                humanityScoreHistory: FieldValue.arrayUnion({
                    score: result.humanityScore,
                    skill: input.targetJobRole,
                    date: now,
                    source: 'skill_verification'
                }),
            };

            // Only raise the global humanity score, never lower it
            if (result.humanityScore > currentHumanityScore) {
                updateData.humanityScore = result.humanityScore;
            }

            await userRef.set(updateData, { merge: true });
        }

        return { success: true, data: result, remainingCredits };

    } catch (error) {
        console.error("Verification Action Failed:", error);
        return { success: false, error: "Failed to verify skills." };
    }
}

export async function generateFollowupAction(idToken: string, input: GenerateInterviewFollowupInput) {
    try {
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const userId = decodedToken.uid;

        // Rate limiting: max 20 calls per hour using Firestore counter
        const rateLimitRef = db.collection('rate_limits').doc(`${userId}_followup`);
        const now = Date.now();

        const rateLimitDoc = await rateLimitRef.get();
        if (rateLimitDoc.exists) {
            const data = rateLimitDoc.data()!;
            const windowStart = data.windowStart || 0;
            const count = data.count || 0;

            if (now - windowStart < FOLLOWUP_RATE_WINDOW_MS) {
                // Still within the current window
                if (count >= FOLLOWUP_RATE_LIMIT) {
                    const resetTime = new Date(windowStart + FOLLOWUP_RATE_WINDOW_MS);
                    return {
                        success: false,
                        error: `Rate limit exceeded. You can generate up to ${FOLLOWUP_RATE_LIMIT} follow-ups per hour. Try again after ${resetTime.toLocaleTimeString()}.`
                    };
                }
                // Increment counter
                await rateLimitRef.update({ count: FieldValue.increment(1) });
            } else {
                // Window expired — reset
                await rateLimitRef.set({ windowStart: now, count: 1 });
            }
        } else {
            // First call — create counter
            await rateLimitRef.set({ windowStart: now, count: 1 });
        }

        if (input.transcript.length > 20000) {
            return { success: false, error: 'Input exceeds maximum length.' };
        }
        if (input.targetSkill.length > 100) {
            return { success: false, error: 'Input exceeds maximum length.' };
        }

        const result = await generateInterviewFollowup(input);
        return { success: true, data: result };
    } catch (error) {
        console.error("Follow-up Generation Failed:", error);
        return { success: false, error: "Failed to generate follow-up question." };
    }
}
