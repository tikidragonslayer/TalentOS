"use client";

import { useUser } from "@/contexts/user-context";
import { CandidateWizard } from "@/components/onboarding/candidate-wizard";
import { EmployerWizard } from "@/components/onboarding/employer-wizard";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function OnboardingPage() {
    const { authUser, role, isLoading, profile } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !authUser) {
            router.push("/login");
            return;
        }

        // If profile already exists, redirect to dashboard
        if (!isLoading && profile) {
            // Check if it's a candidate profile or employer company
            // For now, strict redirect if truthy
            router.push("/dashboard");
        }
    }, [authUser, isLoading, profile, router]);

    if (isLoading || !authUser) {
        return <div className="min-h-screen flex items-center justify-center bg-black text-primary"><Loader2 className="animate-spin h-8 w-8 mr-2" /> Initializing Onboarding Protocol...</div>
    }

    if (profile) return null; // Will redirect

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-[#050505] p-6 flex flex-col items-center justify-center">
            {role === "candidate" ? <CandidateWizard /> : <EmployerWizard />}
        </div>
    );
}
