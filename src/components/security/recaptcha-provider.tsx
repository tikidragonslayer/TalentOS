"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { verifyHumanityAction } from '@/app/actions/security-actions';
import { useUser } from "@/contexts/user-context";
import { getAuth } from "firebase/auth";

/*
  The Watchdog:
  This provider wraps the application and ensures a seamless humanity check exists in the background.
  It manages the recaptcha token generation without obstructing the user flow, keeping it "Elon-level" smooth.
*/

interface WatchdogContextType {
    verifyHumanity: (action: string) => Promise<string | null>;
    isHuman: boolean;
    score: number;
}

const WatchdogContext = createContext<WatchdogContextType>({
    verifyHumanity: async () => null,
    isHuman: false,
    score: 0
});

export const useWatchdog = () => useContext(WatchdogContext);

const WatchdogInternal = ({ children }: { children: React.ReactNode }) => {
    const { executeRecaptcha } = useGoogleReCaptcha();
    const { authUser } = useUser();
    const [isHuman, setIsHuman] = useState(false);
    const [score, setScore] = useState(0);

    const verifyHumanity = async (action: string) => {
        if (!executeRecaptcha) {
            console.warn("Watchdog: Recaptcha not ready");
            return null;
        }

        try {
            // 1. Get Token from Google Client
            const token = await executeRecaptcha(action);

            // 2. Verify Token & Update Profile on Server
            // We pass the authUser.id so the server can save the score to Firestore
            const firebaseAuth = getAuth();
            const idToken = await firebaseAuth.currentUser?.getIdToken();
            if (!idToken) { console.warn("Watchdog: No auth token"); return null; }
            const result = await verifyHumanityAction(idToken, token);

            if (result.success && result.score) {
                console.log(`Watchdog: Action '${action}' verified. Score: ${result.score}`);
                setScore(result.score);
                setIsHuman(result.score >= 50);
                return token;
            } else {
                console.error("Watchdog: Server verification failed.");
                return null;
            }

        } catch (error) {
            console.error("Watchdog: Verification Exception", error);
            return null;
        }
    };

    return (
        <WatchdogContext.Provider value={{ verifyHumanity, isHuman, score }}>
            {children}
        </WatchdogContext.Provider>
    );
};

const WatchdogDisabled = ({ children }: { children: React.ReactNode }) => {
    if (typeof window !== "undefined") {
        console.warn("Watchdog: NEXT_PUBLIC_RECAPTCHA_KEY is not set. reCAPTCHA is disabled.");
    }
    return (
        <WatchdogContext.Provider value={{ verifyHumanity: async () => null, isHuman: false, score: 0 }}>
            {children}
        </WatchdogContext.Provider>
    );
};

export function RecaptchaProvider({ children }: { children: React.ReactNode }) {
    const RECAPTCHA_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_KEY || "";

    if (!RECAPTCHA_KEY) {
        return <WatchdogDisabled>{children}</WatchdogDisabled>;
    }

    return (
        <GoogleReCaptchaProvider
            reCaptchaKey={RECAPTCHA_KEY}
            scriptProps={{
                async: false,
                defer: false,
                appendTo: "head",
                nonce: undefined,
            }}
        >
            <WatchdogInternal>{children}</WatchdogInternal>
        </GoogleReCaptchaProvider>
    );
}
