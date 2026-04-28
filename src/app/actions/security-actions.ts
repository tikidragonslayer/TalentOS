'use server';

import { db, auth } from '@/lib/firebase-admin';

export async function verifyHumanityAction(idToken: string, recaptchaToken: string) {
    // Verify auth — derive userId from token, never accept from client
    let decodedToken;
    try {
        decodedToken = await auth.verifyIdToken(idToken);
    } catch {
        return { success: false, error: 'Invalid authentication token' };
    }
    const userId = decodedToken.uid;

    console.log(`Verifying humanity for user: ${userId}`);

    try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;

        if (!secretKey) {
            // FAIL CLOSED — do not silently pass when key is missing
            console.error("RECAPTCHA_SECRET_KEY not configured — rejecting verification");
            return { success: false, error: 'Server verification not configured' };
        }

        const response = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`, {
            method: "POST",
        });
        const data = await response.json();

        let score = 0;
        if (data.success && data.score) {
            score = data.score;
        } else {
            console.warn("Recaptcha validation failed", data);
            return { success: false, error: 'reCAPTCHA verification failed' };
        }

        const integerScore = Math.floor(score * 100);

        // Update verified user's document
        const userRef = db.collection('users').doc(userId);
        await userRef.set({
            humanityScore: integerScore,
            lastVerified: new Date().toISOString(),
            isVerifiedBot: integerScore < 50
        }, { merge: true });

        return { success: true, score: integerScore };

    } catch (error) {
        console.error("Verification Action Failed:", error);
        return { success: false, error: "Verification failed" };
    }
}
