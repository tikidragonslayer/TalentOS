"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Unlock, CheckCircle, ArrowRight, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { REVEAL_TIERS, getTierInfo, getUpgradeCost, type RevealTierKey } from "@/lib/reveal-tiers";

interface RevealRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRequest: () => void;
    currentTier: number;
    isProcessing: boolean;
    employerName?: string;
    jobTitle?: string;
}

export function RevealRequestModal({ isOpen, onClose, onRequest, currentTier, isProcessing }: RevealRequestModalProps) {
    const nextTier = currentTier + 1;
    const currentTierInfo = getTierInfo(currentTier);
    const nextTierInfo = nextTier <= 5 ? getTierInfo(nextTier) : null;
    const upgradeCost = getUpgradeCost(currentTier);

    if (!nextTierInfo) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-background/95 backdrop-blur border-primary/20 text-foreground">
                <DialogHeader>
                    <div className="mx-auto bg-primary/10 p-3 rounded-full mb-4 w-fit">
                        <Shield className="h-8 w-8 text-primary" />
                    </div>
                    <DialogTitle className="text-2xl font-bold text-center mb-2">
                        Upgrade to {nextTierInfo.name} Tier
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {nextTierInfo.description} This requires <strong>Dual Consent</strong> -- the other party must also agree.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* Current tier */}
                    <div className="p-3 border rounded-lg bg-muted/20">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            Current: {currentTierInfo.name} (Tier {currentTier})
                        </h4>
                        <ul className="space-y-1">
                            {currentTierInfo.reveals.map((item, i) => (
                                <li key={i} className="flex items-center text-xs text-muted-foreground">
                                    <CheckCircle className="h-3 w-3 mr-2 text-green-500 shrink-0" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Arrow */}
                    <div className="flex justify-center">
                        <ArrowRight className="h-5 w-5 text-primary rotate-90" />
                    </div>

                    {/* Next tier */}
                    <div className="p-4 border rounded-lg bg-primary/5 border-primary/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Lock className="h-24 w-24" />
                        </div>

                        <h4 className="font-semibold text-primary mb-3 flex items-center">
                            <Unlock className="mr-2 h-4 w-4" /> New at {nextTierInfo.name} (Tier {nextTier}):
                        </h4>
                        <ul className="space-y-2">
                            {nextTierInfo.reveals.map((item, i) => (
                                <li key={i} className="flex items-center text-sm font-medium">
                                    <Unlock className="h-4 w-4 mr-3 text-primary/60 shrink-0" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Cost */}
                    {upgradeCost > 0 && (
                        <div className="flex items-center justify-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
                            <Coins className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-semibold text-amber-700">
                                Cost: {upgradeCost} OS Credit{upgradeCost !== 1 ? 's' : ''} per party
                            </span>
                        </div>
                    )}

                    {/* Dual consent notice */}
                    <div className="flex items-start text-xs text-muted-foreground bg-secondary/50 p-3 rounded-md">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-500 shrink-0" />
                        <p>
                            Your data remains encrypted until both parties approve. Credits are deducted from both parties only upon mutual approval.
                        </p>
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={onClose} disabled={isProcessing} className="w-full sm:w-auto">
                        Cancel
                    </Button>
                    <Button onClick={onRequest} disabled={isProcessing} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                        {isProcessing ? "Initiating..." : `Request ${nextTierInfo.name} Reveal`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
