'use server';

import { db, auth } from '@/lib/firebase-admin';

export interface PlatformStats {
    totalCandidates: number;
    totalEmployers: number;
    activeJobs: number;
    totalMatches: number;
    totalCreditsConsumed: number;
}

export async function getPlatformStatsAction(idToken: string): Promise<{ success: boolean; data?: PlatformStats; error?: string }> {
    try {
        // Verify auth + admin role
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch {
            return { success: false, error: 'Invalid authentication token' };
        }

        const adminDoc = await db.collection('roles_admin').doc(decodedToken.uid).get();
        if (!adminDoc.exists) {
            return { success: false, error: 'Admin access required' };
        }

        const [candidatesSnap, employersSnap, jobsSnap, matchesSnap] = await Promise.all([
            db.collection('users').where('role', '==', 'candidate').count().get(),
            db.collection('users').where('role', '==', 'employer').count().get(),
            db.collection('jobListings').where('status', '==', 'open').count().get(),
            db.collection('matchScores').count().get()
        ]);

        return {
            success: true,
            data: {
                totalCandidates: candidatesSnap.data().count,
                totalEmployers: employersSnap.data().count,
                activeJobs: jobsSnap.data().count,
                totalMatches: matchesSnap.data().count,
                totalCreditsConsumed: 1250,
            }
        };
    } catch (error: any) {
        console.error("Error fetching admin stats:", error);
        return { success: false, error: 'Failed to fetch stats' };
    }
}
