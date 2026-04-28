'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sendOfferAction } from '@/app/actions/offer-actions';
import { FileSignature, Handshake, Loader2, DollarSign, Calendar } from 'lucide-react';
import { useState } from 'react';
import { getAuth } from 'firebase/auth';

interface SendOfferModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversationId: string;
    jobId: string;
    jobTitle: string;
    candidateName: string;
    defaultBonusAmount: number;
}

function getOfferAgreementText(bonusAmount: number, jobTitle: string): string {
    return `BONUS COMMITMENT AGREEMENT

This agreement is made between the Employer (the party posting this job listing on TalentSync) and the Candidate (the party who accepts the offer for the role described below).

ROLE: ${jobTitle}
SIGN-ON BONUS: $${bonusAmount.toLocaleString()}

TERMS:
1. The Employer commits to paying the Candidate a sign-on bonus of $${bonusAmount.toLocaleString()} upon the Candidate's start of employment.
2. Payment of the bonus is a direct obligation between the Employer and the Candidate. TalentOS is NOT a party to the bonus payment and does not hold, escrow, or transfer any bonus funds.
3. The Candidate may confirm receipt of the bonus or raise a dispute through the TalentSync platform.
4. This agreement becomes binding when the Candidate accepts the offer through TalentSync.

By sending this offer, the Employer acknowledges and agrees to these terms.`;
}

export function SendOfferModal({
    isOpen,
    onClose,
    conversationId,
    jobId,
    jobTitle,
    candidateName,
    defaultBonusAmount,
}: SendOfferModalProps) {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [bonusAmount, setBonusAmount] = useState(defaultBonusAmount);
    const [proposedStartDate, setProposedStartDate] = useState('');
    const [message, setMessage] = useState('');
    const [agreementSigned, setAgreementSigned] = useState(false);
    const [showAgreement, setShowAgreement] = useState(false);

    const handleSubmit = async () => {
        if (!agreementSigned) {
            toast({ variant: 'destructive', title: 'Agreement Required', description: 'You must agree to the Commitment Agreement terms.' });
            return;
        }
        if (!proposedStartDate) {
            toast({ variant: 'destructive', title: 'Start Date Required', description: 'Please enter a proposed start date.' });
            return;
        }
        if (bonusAmount < 50) {
            toast({ variant: 'destructive', title: 'Invalid Bonus', description: 'Sign-on bonus must be at least $50.' });
            return;
        }

        setIsProcessing(true);
        try {
            const firebaseAuth = getAuth();
            const idToken = await firebaseAuth.currentUser?.getIdToken();
            if (!idToken) {
                toast({ variant: 'destructive', title: 'Auth Error', description: 'Please sign in again.' });
                return;
            }

            const result = await sendOfferAction(idToken, conversationId, jobId, {
                bonusAmount,
                proposedStartDate,
                message,
            });

            if (result.success) {
                toast({ title: 'Offer Sent!', description: `Your offer has been sent to ${candidateName}.` });
                onClose();
                // Reset form
                setBonusAmount(defaultBonusAmount);
                setProposedStartDate('');
                setMessage('');
                setAgreementSigned(false);
            } else {
                toast({ variant: 'destructive', title: 'Failed to Send Offer', description: result.error });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Something went wrong.' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur border-primary/20">
                <DialogHeader>
                    <div className="mx-auto bg-primary/10 p-3 rounded-full mb-4 w-fit">
                        <Handshake className="h-8 w-8 text-primary" />
                    </div>
                    <DialogTitle className="text-2xl font-bold text-center mb-2">
                        Send Offer
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Send an offer to <strong>{candidateName}</strong> for <strong>{jobTitle}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Bonus Amount */}
                    <div className="space-y-2">
                        <Label htmlFor="bonusAmount" className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" /> Sign-On Bonus Amount
                        </Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                                id="bonusAmount"
                                type="number"
                                min={50}
                                value={bonusAmount}
                                onChange={e => setBonusAmount(Number(e.target.value))}
                                className="pl-8"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            This bonus is paid directly by you to the candidate upon their start date.
                        </p>
                    </div>

                    {/* Proposed Start Date */}
                    <div className="space-y-2">
                        <Label htmlFor="startDate" className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> Proposed Start Date
                        </Label>
                        <Input
                            id="startDate"
                            type="date"
                            value={proposedStartDate}
                            onChange={e => setProposedStartDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                        />
                    </div>

                    {/* Personal Message */}
                    <div className="space-y-2">
                        <Label htmlFor="offerMessage">Personal Message (optional)</Label>
                        <Textarea
                            id="offerMessage"
                            placeholder="Add a personal note to the candidate..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Commitment Agreement */}
                    <div className="border rounded-lg overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowAgreement(!showAgreement)}
                            className="w-full p-3 text-left flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                            <span className="flex items-center gap-2 text-sm font-medium">
                                <FileSignature className="h-4 w-4" />
                                Bonus Commitment Agreement
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {showAgreement ? 'Hide' : 'View'}
                            </span>
                        </button>
                        {showAgreement && (
                            <div className="p-3 bg-background max-h-48 overflow-y-auto">
                                <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                                    {getOfferAgreementText(bonusAmount, jobTitle)}
                                </pre>
                            </div>
                        )}
                        <div className="p-3 border-t">
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={agreementSigned}
                                    onChange={e => setAgreementSigned(e.target.checked)}
                                    className="mt-1 h-4 w-4 rounded border-gray-300"
                                />
                                <span className="text-sm">
                                    I have read and agree to the Bonus Commitment Agreement. I commit to paying the
                                    candidate <strong>${bonusAmount.toLocaleString()}</strong> directly upon their start of employment.
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={onClose} disabled={isProcessing} className="w-full sm:w-auto">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isProcessing || !agreementSigned || !proposedStartDate}
                        className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        {isProcessing ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Offer...</>
                        ) : (
                            <><Handshake className="mr-2 h-4 w-4" /> Send Offer</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
