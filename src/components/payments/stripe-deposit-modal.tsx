"use client";

import React, { useState } from "react";
import { GlassCard, GlassHeader, GlassContent, GlassFooter } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { DollarSign, ShieldCheck, Trophy, Loader2, FileSignature } from "lucide-react";
import { calculatePlatformFee, PLATFORM_FEE_CONFIG } from "@/config/stripe-products";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

interface StripeDepositModalProps {
    onSuccess: (amount: number) => void;
    onCancel: () => void;
}

const CheckoutForm = ({ onSuccess, onCancel }: StripeDepositModalProps) => {
    const stripe = useStripe();
    const elements = useElements();
    const [bonusAmount, setBonusAmount] = useState<number>(500);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [agreementSigned, setAgreementSigned] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!agreementSigned) {
            setError("You must sign the Bonus Commitment Agreement before proceeding.");
            return;
        }
        setIsProcessing(true);
        setError(null);

        if (!stripe || !elements) {
            return;
        }

        // In production, this would call /api/create-payment-intent
        // For now, simulate processing
        await new Promise(resolve => setTimeout(resolve, 1500));

        setIsProcessing(false);
        onSuccess(bonusAmount);
    };

    const platformFeeCents = calculatePlatformFee(bonusAmount);
    const platformFee = platformFeeCents / 100;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[250, 500, 1000].map((val) => (
                    <div
                        key={val}
                        onClick={() => setBonusAmount(val)}
                        className={`
              cursor-pointer rounded-xl p-4 text-center border transition-all
              ${bonusAmount === val
                                ? "bg-primary/20 border-primary text-white shadow-[0_0_15px_rgba(45,212,191,0.3)]"
                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"}
            `}
                    >
                        <div className="font-bold text-lg">${val}</div>
                        <div className="text-xs">Sign-On Bonus</div>
                    </div>
                ))}
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-2 text-sm">
                <div className="flex justify-between text-gray-300">
                    <span>Sign-On Bonus (you pay candidate directly)</span>
                    <span className="font-mono text-green-400">${bonusAmount}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                    <span>Platform Fee ({(PLATFORM_FEE_CONFIG.rate * 100).toFixed(0)}% matchmaking fee)</span>
                    <span className="font-mono text-white">${platformFee.toFixed(2)}</span>
                </div>
                <div className="h-px bg-white/10 my-2" />
                <div className="flex justify-between text-primary font-bold text-lg">
                    <span>You Pay Today</span>
                    <span className="font-mono">${platformFee.toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    Only the platform fee is charged. The bonus is your direct commitment to the candidate.
                </p>
            </div>

            {/* Agreement Checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/5 cursor-pointer">
                <input
                    type="checkbox"
                    checked={agreementSigned}
                    onChange={(e) => setAgreementSigned(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded"
                />
                <span className="text-sm text-gray-300">
                    <FileSignature className="inline h-3 w-3 mr-1" />
                    I agree to the <strong className="text-white">Bonus Commitment Agreement</strong> and commit to paying
                    the candidate <strong className="text-green-400">${bonusAmount}</strong> directly upon their start of employment.
                </span>
            </label>

            <div className="border border-white/20 p-4 rounded-lg bg-black/20">
                <CardElement options={{
                    style: {
                        base: {
                            fontSize: '16px',
                            color: '#fff',
                            '::placeholder': {
                                color: '#aab7c4',
                            },
                        },
                        invalid: {
                            color: '#9e2146',
                        },
                    },
                }} />
            </div>

            {error && <div className="text-red-400 text-sm">{error}</div>}

            <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent border-white/20 text-white hover:bg-white/10">
                    Cancel
                </Button>
                <Button type="submit" disabled={!stripe || isProcessing || !agreementSigned} className="flex-1 bg-primary text-black font-bold hover:bg-primary/90">
                    {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                    Pay ${platformFee.toFixed(2)} Platform Fee
                </Button>
            </div>
        </form>
    );
};

export function StripeDepositModal({ onSuccess, onCancel }: StripeDepositModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <GlassCard variant="neon" className="w-full max-w-md animate-in zoom-in-95 duration-300">
                <GlassHeader>
                    <div className="flex items-center gap-3">
                        <Trophy className="h-8 w-8 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Sign-On Bonus</h2>
                            <p className="text-xs text-gray-400">Attract top talent with a verified bonus commitment.</p>
                        </div>
                    </div>
                </GlassHeader>
                <GlassContent>
                    <Elements stripe={stripePromise}>
                        <CheckoutForm onSuccess={onSuccess} onCancel={onCancel} />
                    </Elements>
                </GlassContent>
                <GlassFooter className="justify-center text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Platform fee secured by Stripe. Bonus is your direct commitment.
                    </span>
                </GlassFooter>
            </GlassCard>
        </div>
    );
}
