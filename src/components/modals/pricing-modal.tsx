'use client';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/user-context";
import { getAuth } from "firebase/auth";

interface PricingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPurchaseSuccess?: () => void;
    role: 'candidate' | 'employer';
}

export function PricingModal({ isOpen, onClose, onPurchaseSuccess, role }: PricingModalProps) {
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const { toast } = useToast();
    const { authUser } = useUser();

    const handleCheckout = async (plan: 'starter' | 'pro' | 'enterprise') => {
        if (!authUser) {
            toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
            return;
        }

        setIsProcessing(plan);
        try {
            const auth = getAuth();
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Could not get auth token.");

            const res = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({ plan }),
            });

            if (!res.ok) {
                const errorBody = await res.json();
                throw new Error(errorBody.error || 'Failed to start checkout.');
            }

            const { url } = await res.json();
            if (url) {
                window.location.href = url;
            } else {
                throw new Error("No checkout URL returned.");
            }
        } catch (error: any) {
            console.error("Checkout error:", error);
            toast({
                title: "Checkout Failed",
                description: error.message || "An unexpected error occurred.",
                variant: "destructive",
            });
            setIsProcessing(null);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl bg-background/95 backdrop-blur border-primary/20 text-foreground">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center mb-2">
                        {role === 'employer' ? 'Power Up Your Recruiting' : 'Accelerate Your Career'}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Choose a plan to unlock premium features and AI credits.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
                    {/* Starter Plan */}
                    <Card className="border-border/50 bg-card/50">
                        <CardHeader>
                            <CardTitle>Starter</CardTitle>
                            <CardDescription>For testing the waters</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold mb-4">$19<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> 10 OS Credits / month</li>
                                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Basic AI Analysis</li>
                                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Skill Verification</li>
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" className="w-full" onClick={() => handleCheckout('starter')} disabled={!!isProcessing}>
                                {isProcessing === 'starter' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Choose Starter
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Pro Plan */}
                    <Card className="border-primary/50 bg-primary/5 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-1">POPULAR</div>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Pro</CardTitle>
                            <CardDescription>For serious growth</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold mb-4 text-primary">$49<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> 50 OS Credits / month</li>
                                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Priority Matching</li>
                                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Advanced AI Tools</li>
                                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Profile Boost</li>
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full bg-primary text-black hover:bg-primary/90" onClick={() => handleCheckout('pro')} disabled={!!isProcessing}>
                                {isProcessing === 'pro' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Upgrade to Pro
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Enterprise Plan */}
                    <Card className="border-border/50 bg-card/50">
                        <CardHeader>
                            <CardTitle>Enterprise</CardTitle>
                            <CardDescription>For scaling teams</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold mb-4">$199<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                            <ul className="space-y-2 text-sm">
                                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Unlimited Credits</li>
                                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Dedicated Agent</li>
                                <li className="flex items-center"><Check className="h-4 w-4 mr-2 text-green-500" /> Custom Integrations</li>
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" className="w-full" onClick={() => handleCheckout('enterprise')} disabled={!!isProcessing}>
                                {isProcessing === 'enterprise' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Contact Sales
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

            </DialogContent>
        </Dialog>
    );
}
