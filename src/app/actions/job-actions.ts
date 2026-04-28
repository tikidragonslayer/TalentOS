'use server';

import { db, auth } from '@/lib/firebase-admin';
import { JobPosting } from '@/types';
import { revalidatePath } from 'next/cache';

// Fields that cannot be changed via the edit form (security-sensitive)
const PROTECTED_FIELDS = new Set([
  'id', 'companyId', 'status', 'platformFeePaid', 'platformFeePaymentIntentId',
  'platformFeePaidAt', 'commitmentAgreementId', 'commitmentAgreementSignedAt',
  'jobPostedDate', 'activatedAt', 'candidateAcceptedAt',
  'candidateConfirmedReceiptAt', 'disputeStatus', 'postedAt',
]);

export async function updateJobAction(
    idToken: string,
    jobId: string,
    updates: Partial<JobPosting>,
) {
    try {
        // Verify auth
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const userId = decodedToken.uid;

        // Verify user is an employer
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists || userDoc.data()?.role !== 'employer') {
            return { success: false, error: 'Only employers can update job listings' };
        }

        // Fetch the existing job
        const jobDoc = await db.collection('jobListings').doc(jobId).get();
        if (!jobDoc.exists) {
            return { success: false, error: 'Job posting not found' };
        }

        const existingJob = jobDoc.data() as JobPosting;

        // Verify ownership
        const companyId = userDoc.data()?.companyId || userId;
        if (existingJob.companyId !== companyId) {
            return { success: false, error: 'You do not own this job posting' };
        }

        // Block editing if hired or closed
        if (existingJob.status === 'hired' || existingJob.status === 'closed') {
            return { success: false, error: `Cannot edit a job with status "${existingJob.status}"` };
        }

        // Strip protected fields from updates
        const safeUpdates: Record<string, any> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (!PROTECTED_FIELDS.has(key)) {
                safeUpdates[key] = value;
            }
        }

        if (Object.keys(safeUpdates).length === 0) {
            return { success: false, error: 'No valid fields to update' };
        }

        // Validate bonus amount if provided
        if (safeUpdates.bonusAmount !== undefined && safeUpdates.bonusAmount < 50) {
            return { success: false, error: 'Sign-on bonus must be at least $50' };
        }

        await db.collection('jobListings').doc(jobId).update(safeUpdates);

        // If the job is open, matching could be re-triggered here
        const matchingTriggered = existingJob.status === 'open';
        // TODO: Trigger AI re-matching flow when status is 'open'

        revalidatePath('/jobs');
        revalidatePath('/employer/jobs');

        return { success: true, matchingTriggered };

    } catch (error) {
        console.error("Job Update Error:", error);
        return { success: false, error: "Failed to update job listing." };
    }
}

export async function submitJobListing(
    idToken: string,
    jobData: Partial<JobPosting>,
    bonusAmount: number,
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

        // Verify user is an employer
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists || userDoc.data()?.role !== 'employer') {
            return { success: false, error: 'Only employers can submit job listings' };
        }

        // Validate bonus amount
        if (!bonusAmount || bonusAmount < 50) {
            return { success: false, error: 'Sign-on bonus must be at least $50' };
        }

        console.log(`Submitting job for User ${userId} with Sign-On Bonus $${bonusAmount}`);

        const jobRef = db.collection('jobListings').doc();

        const newJob: JobPosting = {
            id: jobRef.id,
            companyId: userDoc.data()?.companyId || userId,
            title: jobData.title || "Untitled Role",
            anonymizedTitle: jobData.anonymizedTitle || "Confidential Role",
            anonymizedDescription: jobData.anonymizedDescription || "",
            skills: jobData.skills || [],
            requirements: jobData.requirements || [],
            location: jobData.location || "Remote",
            hiringMode: jobData.hiringMode || "remote",
            status: 'pending_payment', // Not 'open' until platform fee paid
            bonusAmount,
            platformFeePaid: false, // Must be confirmed via Stripe webhook
            jobPostedDate: new Date().toISOString(),
            // Only merge safe fields from jobData (prevent overriding security fields)
            description: jobData.description,
            anonymizedCompanyName: jobData.anonymizedCompanyName,
            idealCandidateMbti: jobData.idealCandidateMbti,
            minSalary: jobData.minSalary,
            maxSalary: jobData.maxSalary,
        };

        await jobRef.set(newJob);

        revalidatePath('/jobs');
        return { success: true, jobId: jobRef.id };

    } catch (error) {
        console.error("Job Submission Error:", error);
        return { success: false, error: "Failed to save job listing." };
    }
}

/**
 * Create a Commitment Agreement when the employer activates a listing.
 * Called client-side after agreement checkbox is checked + platform fee paid.
 */
export async function createCommitmentAgreement(
    idToken: string,
    jobId: string,
    bonusAmount: number,
    agreementText: string,
) {
    try {
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }
        const userId = decodedToken.uid;

        // Get employer info
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists || userDoc.data()?.role !== 'employer') {
            return { success: false, error: 'Only employers can sign agreements' };
        }

        const companyId = userDoc.data()?.companyId || userId;

        // Verify the employer's company owns the job
        const jobDoc = await db.collection('jobListings').doc(jobId).get();
        if (!jobDoc.exists) {
            return { success: false, error: 'Job listing not found' };
        }
        if (jobDoc.data()?.companyId !== companyId) {
            return { success: false, error: 'You do not own this job listing' };
        }

        const now = new Date().toISOString();

        // Simple hash for signature (employer UID + timestamp + amount)
        const signatureInput = `${userId}:${now}:${bonusAmount}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(signatureInput);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const signatureHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const agreementRef = db.collection('commitment_agreements').doc();

        await agreementRef.set({
            id: agreementRef.id,
            jobId,
            employerId: userId,
            employerCompanyId: companyId,
            employerName: userDoc.data()?.companyName || userDoc.data()?.fullName || 'Unknown',
            bonusAmount,
            terms: agreementText,
            employerSignedAt: now,
            employerSignatureHash: signatureHash,
            status: 'pending_candidate',
            createdAt: now,
            updatedAt: now,
        });

        // Link agreement to job listing
        await db.collection('jobListings').doc(jobId).update({
            commitmentAgreementId: agreementRef.id,
            commitmentAgreementSignedAt: now,
        });

        return { success: true, agreementId: agreementRef.id };

    } catch (error) {
        console.error("Agreement Creation Error:", error);
        return { success: false, error: "Failed to create commitment agreement." };
    }
}
