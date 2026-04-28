// src/app/settings/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUser } from "@/contexts/user-context";
import { useEffect, useState, useCallback } from "react";
import { getAuth } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Bell, UserCircle, ShieldCheck, Gift, Copy, CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const { authUser, profile, userDoc, role, isLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  // Note: We'd get notification settings from the profile in a real app
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const referralLink = authUser ? `https://talentos.com/join?ref=${authUser.id}` : '';

  const handleManageSubscription = useCallback(async () => {
    setIsBillingLoading(true);
    try {
      const firebaseAuth = getAuth();
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Could not get auth token.");

      const res = await fetch("/api/stripe/billing-portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        const errorBody = await res.json();
        throw new Error(errorBody.error || "Failed to open billing portal.");
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No portal URL returned.");
      }
    } catch (error: any) {
      toast({
        title: "Billing Portal Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsBillingLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isLoading && !authUser) {
      router.push("/"); // Redirect if not logged in
    }
  }, [authUser, isLoading, router]);

  const handleNotificationToggle = (checked: boolean) => {
    setEnableNotifications(checked);
    // TODO: API call to save this preference to backend user profile
    toast({
      title: "Settings Updated",
      description: `Push notifications ${checked ? 'enabled' : 'disabled'}. (Simulation)`,
    });
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({
      title: "Link Copied!",
      description: "Your referral link has been copied to your clipboard.",
    });
  };

  if (isLoading || !authUser) {
    return <div className="flex h-screen items-center justify-center"><p>Loading settings...</p></div>;
  }

  const referralIncentive = role === 'candidate' 
    ? "When they sign up and verify their profile, you both get a free year of Founding Member status."
    : "When they sign up and post their first job, you both get a $100 credit towards your next platform fee.";

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and notification settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <Card className="shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center"><Gift className="mr-2 h-5 w-5 text-primary"/> Referral Program</CardTitle>
            <CardDescription>Share TalentOS and earn rewards. Help us grow the network.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="referral-link">Your Unique Referral Link</Label>
              <div className="flex space-x-2 mt-1">
                <Input id="referral-link" value={referralLink} readOnly />
                <Button variant="outline" size="icon" onClick={copyReferralLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground p-4 bg-secondary rounded-md">{referralIncentive}</p>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">Referrals tracked: 0 (Feature coming soon)</p>
          </CardFooter>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Bell className="mr-2 h-5 w-5 text-primary"/> Notifications</CardTitle>
            <CardDescription>Control how you receive updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="notifications-switch" className="text-base">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  For new matches & messages.
                </p>
              </div>
              <Switch
                id="notifications-switch"
                checked={enableNotifications}
                onCheckedChange={handleNotificationToggle}
                aria-label="Toggle push notifications"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><UserCircle className="mr-2 h-5 w-5 text-primary"/> Account</CardTitle>
            <CardDescription>Manage your login and profile details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={() => router.push(role === 'candidate' ? '/candidate/profile' : '/employer/profile')}>
              Edit Profile Information
            </Button>
            <Button variant="outline" className="w-full" disabled>Change Email</Button>
            <Button variant="outline" className="w-full" disabled>Change Password</Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><CreditCard className="mr-2 h-5 w-5 text-primary"/> Subscription</CardTitle>
            <CardDescription>
              {userDoc?.isPremium
                ? `You are on the ${userDoc?.plan || "premium"} plan.`
                : "You are on the free plan."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {userDoc?.isPremium ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleManageSubscription}
                disabled={isBillingLoading}
              >
                {isBillingLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Manage Subscription
              </Button>
            ) : (
              <Button
                className="w-full bg-primary text-black hover:bg-primary/90"
                onClick={() => router.push("/dashboard?upgrade=true")}
              >
                Upgrade Plan
              </Button>
            )}
          </CardContent>
        </Card>

         <Card className="shadow-lg lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary"/> Privacy & Security</CardTitle>
            <CardDescription>Manage your data and privacy settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" disabled>Manage Anonymization Settings</Button>
            <Button variant="outline" className="w-full" disabled>Download Your Data</Button>
            <Button variant="destructive" className="w-full" disabled>Delete Account</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
