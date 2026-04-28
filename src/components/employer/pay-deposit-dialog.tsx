// src/components/employer/pay-deposit-dialog.tsx
//
// Platform Fee + Commitment Agreement Dialog
// Employer pays 10% platform fee and digitally signs a Bonus Commitment Agreement.
'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { JobPosting } from '@/types';
import { DollarSign, FileSignature, Loader2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useUser } from '@/firebase/provider';
import { calculatePlatformFee, PLATFORM_FEE_CONFIG } from '@/config/stripe-products';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

interface PayPlatformFeeDialogProps {
  job: JobPosting;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (jobId: string) => void;
}

/** Generate the commitment agreement text */
function getAgreementText(job: JobPosting): string {
  return `BONUS COMMITMENT AGREEMENT

This agreement is made between the Employer (the party posting this job listing on TalentSync) and the Candidate (the party who accepts the offer for the role described below).

ROLE: ${job.title}
SIGN-ON BONUS: $${job.bonusAmount.toLocaleString()}

TERMS:
1. The Employer commits to paying the Candidate a sign-on bonus of $${job.bonusAmount.toLocaleString()} upon the Candidate's start of employment.
2. Payment of the bonus is a direct obligation between the Employer and the Candidate. TalentOS is NOT a party to the bonus payment and does not hold, escrow, or transfer any bonus funds.
3. The Employer has paid a non-refundable platform fee of ${formatFee(job.bonusAmount)} to TalentSync for the matchmaking service.
4. The Candidate may confirm receipt of the bonus or raise a dispute through the TalentSync platform.
5. This agreement becomes binding when the Candidate accepts the offer through TalentSync.

By signing below, the Employer acknowledges and agrees to these terms.`;
}

function formatFee(bonusAmount: number): string {
  const feeCents = calculatePlatformFee(bonusAmount);
  return `$${(feeCents / 100).toFixed(2)}`;
}

const CheckoutForm = ({
  job,
  onClose,
  onPaymentSuccess,
}: Pick<PayPlatformFeeDialogProps, 'job' | 'onClose' | 'onPaymentSuccess'>) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const { user } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agreementSigned, setAgreementSigned] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);

  const platformFeeCents = calculatePlatformFee(job.bonusAmount);
  const platformFeeFormatted = `$${(platformFeeCents / 100).toFixed(2)}`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) return;
    if (!user) {
      setErrorMessage('You must be signed in to make a payment.');
      return;
    }
    if (!agreementSigned) {
      setErrorMessage('You must sign the Bonus Commitment Agreement before proceeding.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setIsProcessing(false);
      return;
    }

    // Get Firebase ID token
    let idToken: string;
    try {
      idToken = await user.getIdToken();
    } catch {
      setErrorMessage('Authentication error. Please sign in again.');
      setIsProcessing(false);
      return;
    }

    // Create platform fee payment intent on the server
    const res = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        bonusAmount: job.bonusAmount,
        jobId: job.id,
        jobTitle: job.title,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErrorMessage(data.error || 'Failed to create payment. Please try again.');
      setIsProcessing(false);
      return;
    }

    const { clientSecret } = await res.json();

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (error) {
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      toast({
        title: 'Job Activated!',
        description: `Platform fee of ${platformFeeFormatted} paid. "${job.title}" is now live.`,
      });
      onPaymentSuccess(job.id);
      setIsProcessing(false);
      onClose();
    } else {
      setErrorMessage('Payment did not succeed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        {/* Job Summary */}
        <div className="p-4 border rounded-lg bg-muted/50">
          <h3 className="font-semibold text-lg mb-2">{job.title}</h3>
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">Sign-On Bonus (paid by you to candidate):</p>
            <p className="font-bold text-green-600">${job.bonusAmount.toLocaleString()}</p>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <p className="text-muted-foreground">
              Platform Fee ({(PLATFORM_FEE_CONFIG.rate * 100).toFixed(0)}% matchmaking fee):
            </p>
            <p className="font-bold text-primary">{platformFeeFormatted}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-3 border-t pt-2">
            You only pay the <strong>{platformFeeFormatted} platform fee</strong> to TalentSync today.
            The ${job.bonusAmount.toLocaleString()} bonus is paid directly by you to the candidate after they start work.
            No escrow. No middleman on the bonus.
          </p>
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
                {getAgreementText(job)}
              </pre>
            </div>
          )}
          <div className="p-3 border-t">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreementSigned}
                onChange={(e) => setAgreementSigned(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">
                I have read and agree to the Bonus Commitment Agreement. I commit to paying the
                candidate <strong>${job.bonusAmount.toLocaleString()}</strong> directly upon their start of employment.
              </span>
            </label>
          </div>
        </div>

        {/* Card Input */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Payment — Platform Fee Only ({platformFeeFormatted})</p>
          <div className="p-4 border rounded-md bg-background">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': { color: '#aab7c4' },
                  },
                  invalid: { color: '#9e2146' },
                },
              }}
            />
          </div>
        </div>

        {errorMessage && (
          <div className="text-destructive text-sm font-medium">{errorMessage}</div>
        )}
      </div>

      <AlertDialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isProcessing}>
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || isProcessing || !agreementSigned}>
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Sign Agreement & Pay {platformFeeFormatted}
            </>
          )}
        </Button>
      </AlertDialogFooter>
    </form>
  );
};

export function PayDepositDialog(props: PayPlatformFeeDialogProps) {
  if (!props.isOpen) return null;

  return (
    <AlertDialog open={props.isOpen} onOpenChange={props.onClose}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center text-2xl">
            <DollarSign className="mr-2 h-6 w-6 text-primary" />
            Activate Your Job Listing
          </AlertDialogTitle>
          <AlertDialogDescription>
            Sign the Bonus Commitment Agreement and pay the platform fee to activate your listing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Elements stripe={stripePromise}>
          <CheckoutForm {...props} />
        </Elements>
      </AlertDialogContent>
    </AlertDialog>
  );
}
