"use client";

import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, Auth, getAdditionalUserInfo } from 'firebase/auth';
import { notifySignupAction } from '@/app/actions/notification-actions';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FcGoogle } from 'react-icons/fc'; // Assuming react-icons is installed, or use an SVG

// Fallback Google Icon if react-icons not available
function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512" {...props}>
            <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
        </svg>
    );
}

interface LoginFormProps {
    auth: Auth;
    onSuccess?: () => void;
}

export function GoogleSignInButton({ auth, onSuccess }: LoginFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            if (getAdditionalUserInfo(result)?.isNewUser) {
                const idToken = await result.user.getIdToken();
                notifySignupAction(idToken, {
                    email: result.user.email,
                    displayName: result.user.displayName,
                    uid: result.user.uid,
                    authMethod: 'google',
                }).catch(() => {});
            }
            // Success handling could be here or via onAuthStateChanged in the context
            if (onSuccess) onSuccess();
        } catch (error: any) {
            console.error("Google Sign-In Error:", error);

            // Handle specific error codes if needed
            let errorMessage = "Failed to sign in with Google.";
            if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = "Sign-in cancelled.";
            } else if (error.code === 'auth/popup-blocked') {
                errorMessage = "Pop-up blocked. Please allow pop-ups for this site.";
            }

            toast({
                title: "Sign-In Failed",
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <Button
                variant="outline"
                className="w-full flex items-center gap-2 py-6 text-md"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
            >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon className="h-5 w-5" />}
                Sign in with Google
            </Button>
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
            </div>
            {/* Fallback for email/pass if needed later, but focusing on Google first */}
        </div>
    );
}
