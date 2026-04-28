"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser } from "@/contexts/user-context";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Building, UserCog, Edit3, DollarSign, Briefcase, HeartHandshake, Target, Image as ImageIcon, ShieldAlert, Sparkles, Star, Zap, Loader2 } from "lucide-react";
import { CheckShield } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import type { EmployerProfile, Company } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { doc, collection } from "firebase/firestore";
import { useForm, Controller } from "react-hook-form";
import { PricingModal } from "@/components/modals/pricing-modal";

export default function EmployerProfilePage() {
  const { authUser, profile, isLoading, setRole } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const employerProfile = profile as EmployerProfile | null;

  const companyRef = useMemoFirebase(() => {
    if (!firestore || !employerProfile?.companyId) return null;
    return doc(firestore, `companies/${employerProfile.companyId}`);
  }, [firestore, employerProfile?.companyId]);

  const { data: companyData, isLoading: isCompanyLoading } = useDoc<Company>(companyRef);

  const { control, handleSubmit, setValue } = useForm<Partial<Company>>({
    defaultValues: companyData || {},
  });

  const [isPricingOpen, setIsPricingOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && authUser) {
      setRole("employer");
    } else if (!isLoading && !authUser) {
      router.push("/login?role=employer");
    }
  }, [authUser, isLoading, router, setRole]);

  useEffect(() => {
    if (companyData) {
      Object.keys(companyData).forEach((key) => {
        setValue(key as keyof Company, companyData[key as keyof Company]);
      });
    }
  }, [companyData, setValue]);

  const handleProfileCreation = () => {
    if (!firestore || !authUser) return;
    // Step 1: Create the Company document
    const companyId = doc(collection(firestore, 'temp')).id; // Generate a new ID
    const companyRef = doc(firestore, `companies/${companyId}`);
    const newCompany: Company = {
      id: companyId,
      ownerId: authUser.id,
      anonymizedCompanyName: `Stealth Startup ${companyId.substring(0, 4)}`,
      verificationStatus: 'unverified',
      osCredits: 5,
      isEnterpriseMember: false,
    };
    setDocumentNonBlocking(companyRef, newCompany, { merge: false });

    // Step 2: Create/Update the user profile to link to the company
    const userProfileRef = doc(firestore, `users/${authUser.id}`);
    const newUserProfile: EmployerProfile = {
      id: authUser.id,
      email: authUser.email,
      role: 'employer',
      companyId: companyId,
    };
    setDocumentNonBlocking(userProfileRef, newUserProfile, { merge: true });

    toast({ title: "Company Profile Created!", description: "You can now start filling out your company details." });
  };

  const handleProfileUpdate = (data: Partial<Company>) => {
    if (!firestore || !companyData) return;
    const companyDocRef = doc(firestore, `companies/${companyData.id}`);
    updateDocumentNonBlocking(companyDocRef, data);
    toast({ title: "Profile Updated", description: "Your changes have been saved." });
  };

  const handleUpgrade = () => {
    setIsPricingOpen(true);
  }

  const handlePurchaseCredits = () => {
    setIsPricingOpen(true);
  }

  const getVerificationBadge = (status?: Company['verificationStatus']) => {
    if (!status) return null;
    switch (status) {
      case 'verified':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1.5 pl-2 pr-3">
            <CheckShield className="h-4 w-4" />
            Verified
          </Badge>
        );
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pending</Badge>;
      case 'unverified':
      default:
        return <Badge variant="destructive" className="gap-1.5"><ShieldAlert className="h-4 w-4" /> Unverified</Badge>;
    }
  };

  const pageLoading = isLoading || (employerProfile && !companyData && isCompanyLoading);

  if (pageLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /><p>Loading builder profile...</p></div>;
  }

  if (!profile && !isLoading) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <p>Company profile not found. Please complete onboarding.</p>
        <Button onClick={() => router.push('/onboarding')}>Go to Onboarding</Button>
      </div>
    );
  }

  if (!companyData) return null; // Should be handled by loading state, but as a safeguard.

  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <form onChange={handleSubmit(handleProfileUpdate)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="w-full shadow-lg">
              <CardHeader className="bg-secondary p-6 rounded-t-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 sm:h-20 sm:w-20 bg-muted rounded-md flex items-center justify-center">
                      <Image
                        src={companyData.companyLogoDataUri || `https://picsum.photos/seed/${companyData.anonymizedCompanyName}/200`}
                        alt="Anonymous Company Logo"
                        fill
                        className="rounded-md object-cover"
                        data-ai-hint="office building"
                      />
                    </div>
                    <div>
                      <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">{companyData.anonymizedCompanyName}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <CardDescription className="text-md text-muted-foreground">
                          Your company's anonymous public profile
                        </CardDescription>
                        {getVerificationBadge(companyData.verificationStatus)}
                      </div>
                      {companyData.isEnterpriseMember && (
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          <Sparkles className="h-4 w-4" />
                          Enterprise Member
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto" type="button" onClick={() => toast({ title: "Edit mode is always on!" })}>
                    <Edit3 className="mr-2 h-4 w-4" /> Edit Profile
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">

                {companyData.verificationStatus !== 'verified' && (
                  <Card className="bg-yellow-50 border border-yellow-200">
                    <CardHeader>
                      <CardTitle className="text-lg text-yellow-800 flex items-center"><ShieldAlert className="mr-2 h-5 w-5" />Complete Verification</CardTitle>
                      <CardDescription className="text-yellow-700">
                        Verify your company to gain full access to the platform, build trust with candidates, and start posting jobs.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button className="bg-yellow-600 hover:bg-yellow-700 text-white" type="button" onClick={() => toast({ title: "Feature coming soon!" })}>Start Verification</Button>
                      <p className="text-xs text-yellow-600 mt-2">The process is quick and helps maintain a secure ecosystem.</p>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-2">
                  <Label htmlFor="companyBio" className="flex items-center text-lg font-semibold text-primary"><Building className="mr-2 h-5 w-5" /> Anonymized Company Bio</Label>
                  <Controller
                    name="anonymizedCompanyName"
                    control={control}
                    render={({ field }) => (
                      <Textarea {...field} id="companyBio" rows={4} readOnly className="bg-muted/50" />
                    )}
                  />
                </div>

                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <h3 className="text-lg font-semibold text-primary flex items-center"><HeartHandshake className="mr-2 h-5 w-5" /> Company Culture & Values</h3>
                  <div className="space-y-2">
                    <Label htmlFor="companyCulture">Culture Statement</Label>
                    <Controller name="companyCulture" control={control} render={({ field }) => <Textarea {...field} id="companyCulture" rows={3} />} />
                  </div>
                  <div className="space-y-1">
                    <Label>Core Values</Label>
                    <Controller
                      name="companyValues"
                      control={control}
                      render={({ field }) => (
                        <Input {...field} placeholder="Comma-separated values, e.g., Innovation, Integrity"
                          onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))}
                          value={Array.isArray(field.value) ? field.value.join(', ') : ''}
                        />
                      )}
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {companyData.companyValues?.map(value => (
                        <span key={value} className="px-3 py-1 bg-accent text-accent-foreground text-sm rounded-full shadow-sm">{value}</span>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-2" type="button">
                    <ImageIcon className="mr-2 h-4 w-4" /> Add/Edit Branding Media
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">Showcase your company culture with images or videos (feature coming soon).</p>
                </div>


                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <h3 className="text-lg font-semibold text-primary flex items-center"><UserCog className="mr-2 h-5 w-5" /> Hiring Manager Profile (Anonymized)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="font-medium">Name:
                        <span className="font-normal text-accent"> {companyData.hiringManager?.anonymizedName || "N/A"}</span>
                      </p>
                      <p className="font-medium">MBTI: <span className="font-normal text-accent">{companyData.hiringManager?.mbti?.personalityType || "Not set"}</span></p>
                      <Button variant="link" size="sm" className="p-0 h-auto mt-1" type="button" onClick={() => router.push("/candidate/mbti-test")}>Take/Retake MBTI Test</Button>
                    </div>
                    <div>
                      <p className="font-medium">Big Five Scores:</p>
                      {companyData.hiringManager?.bigFive ? (
                        <ul className="list-disc list-inside text-sm">
                          <li>Openness: {companyData.hiringManager.bigFive.openness * 100}%</li>
                          <li>Conscientiousness: {companyData.hiringManager.bigFive.conscientiousness * 100}%</li>
                          <li>Extraversion: {companyData.hiringManager.bigFive.extraversion * 100}%</li>
                          <li>Agreeableness: {companyData.hiringManager.bigFive.agreeableness * 100}%</li>
                          <li>Neuroticism: {companyData.hiringManager.bigFive.neuroticism * 100}%</li>
                        </ul>
                      ) : <p className="text-xs text-muted-foreground">Not set</p>}
                      <Button variant="link" size="sm" className="p-0 h-auto mt-1" type="button" onClick={() => router.push("/candidate/big-five-test")}>Take/Retake Big Five Test</Button>
                    </div>
                  </div>
                </div>

                <div className="items-top flex space-x-2 pt-4">
                  <Checkbox id="terms-employer" defaultChecked />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="terms-employer"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Allow TalentOS to use AI to anonymize our company profile and job descriptions.
                    </label>
                    <p className="text-xs text-muted-foreground">
                      You can manage anonymization settings for each job posting.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-8">
            {!companyData.isEnterpriseMember && (
              <Card className="shadow-lg bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-primary flex items-center">
                    <Sparkles className="mr-2 h-6 w-6" /> Upgrade to Enterprise
                  </CardTitle>
                  <CardDescription>The strategic choice for high-volume, high-stakes hiring.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p className="font-semibold">For a monthly subscription, unlock a superior economic model:</p>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong className="text-primary">Reduced Platform Fees:</strong> Pay only 5% matchmaking fee instead of the standard 10%.</li>
                    <li><strong className="text-primary">Premium Matching:</strong> Get priority AI matching and first access to top-tier candidates.</li>
                    <li><strong className="text-primary">Unlimited OS Credits:</strong> Run unlimited advanced team-building and candidate analyses.</li>
                    <li><strong className="text-primary">Unlimited Posts & Priority Access:</strong> Post all your strategic roles and get first access to our pool of elite, "Founding Member" candidates.</li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button type="button" className="w-full bg-primary hover:bg-primary/90" onClick={handleUpgrade}>
                    <Star className="mr-2" /> View Enterprise Plans
                  </Button>
                </CardFooter>
              </Card>
            )}

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary flex items-center"><Zap className="mr-2 h-5 w-5" /> OS Credits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-6xl font-bold">{companyData.isEnterpriseMember ? '∞' : companyData.osCredits}</p>
                <p className="text-sm text-muted-foreground mt-2">OS Credits are used for AI operations like generating job descriptions.</p>
              </CardContent>
              {!companyData.isEnterpriseMember && (
                <CardFooter>
                  <Button size="sm" className="w-full" type="button" onClick={handlePurchaseCredits}>Purchase More Credits</Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
      </form>
      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} role="employer" />
    </div>
  );
}
