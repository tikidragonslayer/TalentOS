"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useUser, useFirestore } from "@/contexts/user-context";
import { doc, setDoc, collection } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GlassCard, GlassContent, GlassFooter, GlassHeader } from "@/components/ui/glass-card";
import { Company, EmployerProfile } from "@/types";
import { ArrowRight, Building, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Step = "company" | "culture";

export function EmployerWizard() {
    const { authUser } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState<Step>("company");
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, setValue } = useForm<Partial<Company>>({
        defaultValues: {
            anonymizedCompanyName: "Stealth Startup",
            verificationStatus: "unverified",
            osCredits: 5,
            companyValues: []
        }
    });

    const onSubmit = async (data: Partial<Company>) => {
        if (!authUser || !firestore) return;
        setIsLoading(true);

        try {
            // 1. Create Company
            const companyId = doc(collection(firestore, 'companies')).id;
            const companyRef = doc(firestore, `companies/${companyId}`);

            const newCompany: Company = {
                id: companyId,
                ownerId: authUser.id,
                anonymizedCompanyName: data.anonymizedCompanyName || "Stealth Startup",
                verificationStatus: 'unverified',
                osCredits: 5,
                isEnterpriseMember: false,
                companyCulture: data.companyCulture || "",
                companyValues: data.companyValues || [],
                ...data as any
            };
            await setDoc(companyRef, newCompany);

            // 2. Create User Profile (Employer)
            const userProfileRef = doc(firestore, `users/${authUser.id}`);
            const newProfile: EmployerProfile = {
                id: authUser.id,
                email: authUser.email,
                role: 'employer',
                companyId: companyId
            };
            await setDoc(userProfileRef, newProfile);

            toast({ title: "Organization Established", description: "Welcome to the future of hiring." });
            router.push("/dashboard");
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to create organization.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = () => {
        if (step === "company") setStep("culture");
        else handleSubmit(onSubmit)();
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-200 to-primary mb-2">
                    Establish Your Entity
                </h1>
                <p className="text-gray-400">Step {step === 'company' ? '1' : '2'} of 2: {step === 'company' ? 'Basic Structure' : 'Cultural DNA'}</p>
            </div>

            <GlassCard variant="default" className="border-t-emerald-500/20">
                <GlassHeader>
                    <div className="flex items-center gap-2 text-xl font-semibold text-white">
                        <Building className="h-5 w-5 text-emerald-400" />
                        {step === "company" ? "Company Information" : "Culture & Values"}
                    </div>
                </GlassHeader>

                <GlassContent className="space-y-6">
                    {step === "company" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label className="text-white">Anonymized Company Name</Label>
                                <Input {...register("anonymizedCompanyName")} placeholder="e.g. Series A Fintech" className="bg-white/5 border-white/10 text-white" />
                                <p className="text-xs text-gray-500">Candidates see this before a match.</p>
                            </div>
                        </div>
                    )}

                    {step === "culture" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label className="text-white">Culture Statement</Label>
                                <Textarea
                                    {...register("companyCulture")}
                                    placeholder="Describe your environment: Fast-paced? Async-first? Collaborative?"
                                    className="bg-white/5 border-white/10 text-white min-h-[120px]"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-white">Core Values (Comma Separated)</Label>
                                <Input
                                    placeholder="Transparency, Autonomy, Velocity..."
                                    onChange={(e) => setValue("companyValues", e.target.value.split(",").map(v => v.trim()))}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                        </div>
                    )}
                </GlassContent>

                <GlassFooter className="justify-between">
                    {step === "culture" && (
                        <Button variant="ghost" onClick={() => setStep("company")} className="text-gray-400 hover:text-white">Back</Button>
                    )}
                    <div className={step === "company" ? "w-full flex justify-end" : ""}>
                        <Button onClick={handleNext} disabled={isLoading} className="bg-emerald-500 text-black hover:bg-emerald-400 font-bold px-8 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                            {step === "culture" ? (isLoading ? "Solidifying..." : "Establish HQ") : "Next Phase"}
                            {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>
                </GlassFooter>
            </GlassCard>
        </div>
    );
}
