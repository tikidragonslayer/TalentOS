"use client";

import React, { useState } from "react";
import { useWatchdog } from "@/components/security/recaptcha-provider";
import { GlassCard, GlassHeader, GlassContent, GlassFooter } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UploadCloud, FileText, CheckCircle, Loader2, ShieldAlert, Sparkles, DollarSign } from "lucide-react";
import { useUser } from "@/contexts/user-context";
import { anonymizeJobDescriptionAction } from '@/app/actions/anonymize-actions';
import { submitJobListing } from '@/app/actions/job-actions';
import { StripeDepositModal } from "@/components/payments/stripe-deposit-modal";
import { getAuth } from "firebase/auth";
import { toast } from "sonner"; // Assuming sonner is used, if not we'll use alert for now

export function JobIngestionForm() {
    const { verifyHumanity } = useWatchdog();
    const { authUser } = useUser();

    // State
    const [rawText, setRawText] = useState("");
    const [anonymizedText, setAnonymizedText] = useState("");
    const [status, setStatus] = useState<"input" | "processing" | "review" | "staking" | "submitting" | "done">("input");
    const [bountyAmount, setBountyAmount] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);

    // 1. Process Raw Input with AI
    const handleAnonymize = async () => {
        if (!rawText.trim()) return;

        // Humanity Check
        const token = await verifyHumanity("anonymize_job");
        if (!token) {
            alert("Humanity verification failed.");
            return;
        }

        setIsProcessing(true);
        setStatus("processing");

        try {
            const firebaseAuth = getAuth();
            const idToken = await firebaseAuth.currentUser?.getIdToken();
            if (!idToken) { alert("Please sign in first."); setStatus("input"); setIsProcessing(false); return; }
            const result = await anonymizeJobDescriptionAction(idToken, rawText);
            if (!result.success || !result.anonymizedDescription) {
                alert(result.error || "Failed to anonymize job.");
                setStatus("input");
            } else {
                setAnonymizedText(result.anonymizedDescription);
                setStatus("review");
            }
        } catch (error) {
            console.error("AI Error:", error);
            alert("Failed to anonymize job.");
            setStatus("input");
        } finally {
            setIsProcessing(false);
        }
    };

    // 2. Handle Stripe Success
    const handleStripeSuccess = async (amount: number) => {
        setBountyAmount(amount);
        setStatus("submitting");

        // 3. Submit to Backend
        try {
            const firebaseAuth = getAuth();
            const idToken = await firebaseAuth.currentUser?.getIdToken();
            if (!idToken) { alert("Authentication error"); setStatus("review"); return; }
            const result = await submitJobListing(
                idToken,
                {
                    description: rawText,
                    anonymizedDescription: anonymizedText,
                    title: "New Opportunity (Pending Analysis)",
                },
                amount,
            );

            if (result.success) {
                setStatus("done");
            } else {
                alert(result.error);
                setStatus("review");
            }
        } catch (error) {
            console.error("Submission Error:", error);
            setStatus("review");
        }
    };

    // RENDER: Success State
    if (status === "done") {
        return (
            <GlassCard variant="neon" className="max-w-xl mx-auto text-center p-8 animate-in fade-in zoom-in duration-500">
                <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Bounty Secured & Job Live</h3>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10 mb-6 inline-block">
                    <p className="text-sm text-gray-400">Total Bounty Staked</p>
                    <p className="text-3xl font-mono text-primary font-bold">${bountyAmount}</p>
                </div>
                <p className="text-gray-300 mb-6">
                    Your listing is now active in the anonymous marketplace. High-signal talent will see this first.
                </p>
                <Button onClick={() => {
                    setStatus("input");
                    setRawText("");
                    setAnonymizedText("");
                }} className="bg-white/10 hover:bg-white/20 text-white">
                    Post Another Role
                </Button>
            </GlassCard>
        );
    }

    return (
        <>
            <GlassCard className="max-w-3xl mx-auto relative overflow-hidden transition-all duration-500">
                <GlassHeader>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <UploadCloud className="text-primary" />
                        Rapid Job Ingestion
                    </h2>
                    <p className="text-xs text-gray-400">Paste your raw description. AI strips the bias. You stake the bounty.</p>
                </GlassHeader>

                <GlassContent className="space-y-6">
                    {/* INPUT MODE */}
                    {status === "input" || status === "processing" ? (
                        <div className="space-y-4">
                            <Textarea
                                placeholder="Paste the full job description here (internal notes, salary range, requirements)..."
                                className="min-h-[300px] bg-black/40 border-white/10 text-gray-200 focus:border-primary/50 text-sm font-mono leading-relaxed resize-none p-6"
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                                disabled={isProcessing}
                            />
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                    <ShieldAlert className="h-3 w-3" />
                                    PII Redaction Protocol Active
                                </span>
                                <span>{rawText.length} chars</span>
                            </div>
                        </div>
                    ) : (
                        // REVIEW MODE
                        <div className="space-y-4 animate-in slide-in-from-right-10 duration-300">
                            <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
                                <span>Anonymized Preview</span>
                                <span className="text-primary text-xs flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" /> AI Optimized
                                </span>
                            </div>
                            <div className="min-h-[300px] bg-primary/5 border border-primary/20 rounded-md p-6 text-gray-200 text-sm font-mono whitespace-pre-wrap leading-relaxed">
                                {anonymizedText}
                            </div>
                        </div>
                    )}
                </GlassContent>

                <GlassFooter className="justify-between border-t border-white/5 bg-white/5">
                    {status === "review" ? (
                        <>
                            <Button
                                variant="ghost"
                                onClick={() => setStatus("input")}
                                className="text-gray-400 hover:text-white"
                            >
                                Edit Raw Text
                            </Button>
                            <Button
                                onClick={() => setStatus("staking")}
                                className="bg-primary hover:bg-primary/90 text-black font-bold px-8 shadow-[0_0_20px_rgba(45,212,191,0.2)]"
                            >
                                <DollarSign className="mr-2 h-4 w-4" />
                                Approve & Stake Bounty
                            </Button>
                        </>
                    ) : (
                        <div className="w-full flex justify-end">
                            <Button
                                disabled={!rawText.trim() || isProcessing}
                                onClick={handleAnonymize}
                                className="min-w-[200px] bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Anonymizing...
                                    </>
                                ) : (
                                    <>
                                        Process Description
                                        <Sparkles className="ml-2 h-4 w-4 text-primary" />
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </GlassFooter>

                {/* Loading Overlay during Submitting */}
                {status === "submitting" && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10">
                        <div className="flex flex-col items-center gap-4 text-primary animate-pulse">
                            <Loader2 className="h-10 w-10 animate-spin" />
                            <span className="font-mono text-lg">Securing Bounty & Publishing...</span>
                        </div>
                    </div>
                )}
            </GlassCard>

            {/* STRIPE MODAL */}
            {status === "staking" && (
                <StripeDepositModal
                    onSuccess={handleStripeSuccess}
                    onCancel={() => setStatus("review")}
                />
            )}
        </>
    );
}
