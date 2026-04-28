'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { acceptOfferAction, rejectOfferAction } from '@/app/actions/offer-actions';
import { CheckCircle2, XCircle, FileSignature, Gift, Calendar, MessageSquare, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import type { Offer } from '@/types';

interface OfferBannerProps {
    offer: Offer;
    jobTitle: string;
}

export function OfferBanner({ offer, jobTitle }: OfferBannerProps) {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [showAgreement, setShowAgreement] = useState(false);

    const getIdToken = async () => {
        const firebaseAuth = getAuth();
        const token = await firebaseAuth.currentUser?.getIdToken();
        if (!token) throw new Error('Not authenticated');
        return token;
    };

    const handleAccept = async () => {
        setIsProcessing(true);
        try {
            const idToken = await getIdToken();
            const result = await acceptOfferAction(idToken, offer.id);
            if (result.success) {
                toast({ title: 'Offer Accepted!', description: 'Congratulations! A Commitment Agreement has been created.' });
            } else {
                toast({ variant: 'destructive', title: 'Failed', description: result.error });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        setIsProcessing(true);
        try {
            const idToken = await getIdToken();
            const result = await rejectOfferAction(idToken, offer.id);
            if (result.success) {
                toast({ title: 'Offer Declined', description: 'You have declined this offer.' });
            } else {
                toast({ variant: 'destructive', title: 'Failed', description: result.error });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsProcessing(false);
        }
    };

    const agreementText = `BONUS COMMITMENT AGREEMENT

ROLE: ${jobTitle}
SIGN-ON BONUS: $${offer.bonusAmount.toLocaleString()}
PROPOSED START DATE: ${offer.proposedStartDate}

TERMS:
1. The Employer commits to paying you a sign-on bonus of $${offer.bonusAmount.toLocaleString()} upon your start of employment.
2. Payment of the bonus is a direct obligation between the Employer and you. TalentOS is NOT a party to the bonus payment.
3. You may confirm receipt of the bonus or raise a dispute through the TalentSync platform.
4. This agreement becomes binding when you accept through TalentSync.`;

    return (
        <div className="mx-4 mb-4 p-4 rounded-xl border-2 border-primary/40 bg-primary/5 backdrop-blur-sm animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 mb-3">
                <div className="bg-primary/10 p-2 rounded-full">
                    <Gift className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-bold text-lg text-primary">You Have an Offer!</h3>
            </div>

            <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                    <Gift className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Sign-On Bonus:</span>
                    <span className="font-bold text-green-600">${offer.bonusAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Proposed Start:</span>
                    <span className="font-semibold">{new Date(offer.proposedStartDate).toLocaleDateString()}</span>
                </div>
                {offer.message && (
                    <div className="flex items-start gap-2 text-sm">
                        <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground">Message:</span>
                        <span className="italic">"{offer.message}"</span>
                    </div>
                )}
            </div>

            {/* Agreement Toggle */}
            <div className="border rounded-lg overflow-hidden mb-4">
                <button
                    type="button"
                    onClick={() => setShowAgreement(!showAgreement)}
                    className="w-full p-2 text-left flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                    <span className="flex items-center gap-2 text-sm font-medium">
                        <FileSignature className="h-4 w-4" />
                        View Commitment Agreement Terms
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {showAgreement ? 'Hide' : 'View'}
                    </span>
                </button>
                {showAgreement && (
                    <div className="p-3 bg-background max-h-40 overflow-y-auto">
                        <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                            {agreementText}
                        </pre>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleAccept}
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Accept Offer
                </Button>
                <Button
                    variant="outline"
                    className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
                    onClick={handleReject}
                    disabled={isProcessing}
                >
                    <XCircle className="mr-2 h-4 w-4" />
                    Decline
                </Button>
            </div>
        </div>
    );
}
