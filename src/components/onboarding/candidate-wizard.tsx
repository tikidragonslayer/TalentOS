"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useUser, useFirestore } from "@/contexts/user-context";
import { doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GlassCard, GlassContent, GlassFooter, GlassHeader } from "@/components/ui/glass-card";
import { UserProfile } from "@/types";
import { ArrowRight, Sparkles, MapPin, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Step = "basics" | "skills" | "finish";

export function CandidateWizard() {
    const { authUser, role } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [step, setStep] = useState<Step>("basics");
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, watch, setValue } = useForm<Partial<UserProfile>>({
        defaultValues: {
            anonymizedName: `Talent ${authUser?.id.substring(0, 6)}`,
            locationPreference: "remote",
            skills: [],
            osCredits: 5,
            currentRevealLevel: 1
        }
    });

    const onSubmit = async (data: Partial<UserProfile>) => {
        if (!authUser || !firestore) return;
        setIsLoading(true);

        try {
            const userProfileRef = doc(firestore, `users/${authUser.id}`);
            const newProfile: UserProfile = {
                id: authUser.id,
                email: authUser.email,
                role: 'candidate',
                anonymizedName: data.anonymizedName || `Talent ${authUser.id.substring(0, 6)}`,
                location: data.location || "",
                locationPreference: data.locationPreference || "remote",
                anonymizedExperienceSummary: data.anonymizedExperienceSummary || "",
                skills: data.skills || [],
                profileTags: [],
                currentRevealLevel: 1,
                profileCompletionPercentage: 50,
                osCredits: 5,
                isFoundingMember: true,
                ...data as any
            };

            await setDoc(userProfileRef, newProfile);
            toast({ title: "Welcome to TalentOS", description: "Your anonymous profile is live." });
            router.push("/dashboard");
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to create profile.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = () => {
        if (step === "basics") setStep("skills");
        else if (step === "skills") handleSubmit(onSubmit)();
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-teal-200 to-emerald-400 mb-2">
                    Initialize Your Node
                </h1>
                <p className="text-gray-400">Step {step === 'basics' ? '1' : '2'} of 2: {step === 'basics' ? 'Identity Protocol' : 'Capability Matrix'}</p>
            </div>

            <GlassCard variant="neon" className="border-t-primary/20">
                <GlassHeader>
                    <div className="flex items-center gap-2 text-xl font-semibold text-white">
                        <Sparkles className="h-5 w-5 text-primary" />
                        {step === "basics" ? "Anonymity Setup" : "Skill & Experience"}
                    </div>
                </GlassHeader>

                <GlassContent className="space-y-6">
                    {step === "basics" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label className="text-white">Anonymized Display Name</Label>
                                <Input {...register("anonymizedName")} className="bg-white/5 border-white/10 text-white" />
                                <p className="text-xs text-gray-500">This is how you appear in match results.</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-white">Location Base</Label>
                                <div className="flex items-center gap-2">
                                    <MapPin className="text-gray-500 h-4 w-4" />
                                    <Input {...register("location")} placeholder="e.g. New York, NY" className="bg-white/5 border-white/10 text-white" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-white">Work Preference</Label>
                                <select {...register("locationPreference")} className="w-full bg-black/50 border border-white/10 rounded-md p-2 text-white">
                                    <option value="remote">Remote Only</option>
                                    <option value="location">On-Site Only</option>
                                    <option value="relocation">Open to Relocation</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {step === "skills" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label className="text-white">Experience Summary (Anonymized)</Label>
                                <Textarea
                                    {...register("anonymizedExperienceSummary")}
                                    placeholder="E.g., Senior Engineer with 5 years in React and Node.js..."
                                    className="bg-white/5 border-white/10 text-white min-h-[120px]"
                                />
                                <p className="text-xs text-gray-500">Do not include your real name or current company name.</p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-white">Top Skills (Comma Separated)</Label>
                                <Input
                                    placeholder="React, TypeScript, AWS..."
                                    onChange={(e) => setValue("skills", e.target.value.split(",").map(s => s.trim()))}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-white">Professional Values / Tags (Comma Separated)</Label>
                                <Input
                                    placeholder="Growth Mindset, Leadership, Async-First..."
                                    onChange={(e) => setValue("profileTags", e.target.value.split(",").map(s => s.trim()))}
                                    className="bg-white/5 border-white/10 text-white"
                                />
                            </div>
                        </div>
                    )}
                </GlassContent>

                <GlassFooter className="justify-between">
                    {step === "skills" && (
                        <Button variant="ghost" onClick={() => setStep("basics")} className="text-gray-400 hover:text-white">Back</Button>
                    )}
                    <div className={step === "basics" ? "w-full flex justify-end" : ""}>
                        <Button onClick={handleNext} disabled={isLoading} className="bg-primary text-black hover:bg-primary/90 font-bold px-8">
                            {step === "skills" ? (isLoading ? "Initializing..." : "Launch Profile") : "Next Phase"}
                            {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </div>
                </GlassFooter>
            </GlassCard>
        </div>
    );
}
