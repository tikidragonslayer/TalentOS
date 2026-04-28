'use server';

import { db, auth } from '@/lib/firebase-admin';
import { anonymizeJobDescription } from '@/ai/flows/anonymize-job-description';
import { Company } from '@/types';
import { CREDIT_COSTS } from '@/lib/credit-costs';

export async function anonymizeJobDescriptionAction(idToken: string, jobDescription: string) {
    // Verify auth — never trust client-supplied userId
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch {
        return { success: false, error: 'Invalid authentication token' };
    }
    const userId = decodedToken.uid;

    if (jobDescription.length > 10000) {
        return { success: false, error: 'Input exceeds maximum length.' };
    }

    console.log(`Starting secure anonymization for user ${userId}...`);

    try {
        // 1. Fetch User/Company Profile to check credits
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return { success: false, error: "User profile not found." };
        }

        const userData = userDoc.data();
        if (userData?.role !== 'employer') {
            return { success: false, error: "Only employers can anonymize job descriptions." };
        }

        const companyId = userData?.companyId;
        if (!companyId) {
            return { success: false, error: "Company profile association not found." };
        }

        const companyRef = db.collection('companies').doc(companyId);

        // Run transaction to ensure atomic credit check and decrement
        const result = await db.runTransaction(async (transaction) => {
            const companyDoc = await transaction.get(companyRef);
            if (!companyDoc.exists) {
                throw new Error("Company profile not found.");
            }

            const companyData = companyDoc.data() as Company;
            const currentCredits = companyData.osCredits || 0;

            if (currentCredits < CREDIT_COSTS.ANONYMIZE_JOB) {
                throw new Error(`Insufficient OS Credits. You need ${CREDIT_COSTS.ANONYMIZE_JOB} credit(s).`);
            }

            transaction.update(companyRef, { osCredits: currentCredits - CREDIT_COSTS.ANONYMIZE_JOB });
            return currentCredits - CREDIT_COSTS.ANONYMIZE_JOB;
        });

        // Run AI Flow
        const aiResult = await anonymizeJobDescription({ jobDescription });

        if (!aiResult.anonymizedJobDescription) {
            // Refund credit on AI failure
            await companyRef.update({ osCredits: result + CREDIT_COSTS.ANONYMIZE_JOB });
            return { success: false, error: "AI generation failed. Credits refunded." };
        }

        return {
            success: true,
            anonymizedDescription: aiResult.anonymizedJobDescription,
            remainingCredits: result
        };

    } catch (error: any) {
        console.error("Anonymization Action Error:", error);
        return { success: false, error: error.message || "Failed to anonymize description." };
    }
}
