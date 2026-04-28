"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useFirestore, useMemoFirebase } from "@/firebase";
import { useUser } from "@/contexts/user-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { User, MapPin, Briefcase, Tags, Edit3, CheckCircle, BadgePercent, Award, Brain, Sparkles, Zap, Star, Loader2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import type { UserProfile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { doc, serverTimestamp } from "firebase/firestore";
import { setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useForm, Controller } from "react-hook-form";
import { PricingModal } from "@/components/modals/pricing-modal";
import { CredentialVault } from "@/components/profile/credential-vault";

const calculateProfileCompletion = (profile: UserProfile | null): number => {
  if (!profile) return 0;
  let score = 0;
  const total = 10;
  if (profile.anonymizedName) score++;
  if (profile.location) score++;
  if (profile.locationPreference) score++;
  if (profile.anonymizedExperienceSummary) score++;
  if (profile.skills && profile.skills.length > 0) score++;
  if (profile.profileTags && profile.profileTags.length > 0) score++;
  if (profile.mbti) score++;
  if (profile.bigFive) score++;
  if (profile.verifiedSkills && profile.verifiedSkills.length > 0) score++;
  if (profile.humanityScore && profile.humanityScore > 0) score++;
  return Math.round((score / total) * 100);
}

const getMatchEligibility = (profile: UserProfile | null) => {
  if (!profile) return { eligible: false, items: [] };
  const items = [
    { label: 'MBTI personality test', met: !!profile.mbti, link: '/candidate/mbti-test' },
    { label: 'Big Five personality test', met: !!profile.bigFive, link: '/candidate/big-five-test' },
    { label: 'At least 1 verified skill', met: !!(profile.verifiedSkills && profile.verifiedSkills.length > 0), link: '/candidate/verify-skills' },
    { label: 'Humanity score above 50', met: !!(profile.humanityScore && profile.humanityScore >= 50), link: '/candidate/verify-skills' },
  ];
  return { eligible: items.every(i => i.met), items };
}

export default function CandidateProfilePage() {
  const { authUser, profile, isLoading, setRole } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const candidateProfile = profile as UserProfile | null;

  const { control, handleSubmit, setValue } = useForm<Partial<UserProfile>>({
    defaultValues: candidateProfile || {},
  });

  const [isPricingOpen, setIsPricingOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && authUser) {
      setRole("candidate");
    } else if (!isLoading && !authUser) {
      router.push('/login?role=candidate');
    }
  }, [authUser, isLoading, router, setRole]);

  useEffect(() => {
    if (candidateProfile) {
      Object.keys(candidateProfile).forEach((key) => {
        setValue(key as keyof UserProfile, candidateProfile[key as keyof UserProfile]);
      });
    }
  }, [candidateProfile, setValue]);

  const handleProfileCreation = () => {
    if (!firestore || !authUser) return;
    const userProfileRef = doc(firestore, `users/${authUser.id}`);
    const newProfile: UserProfile = {
      id: authUser.id,
      email: authUser.email,
      role: 'candidate',
      anonymizedName: `Talent ${authUser.id.substring(0, 6)}`,
      location: "",
      locationPreference: 'remote',
      anonymizedExperienceSummary: "",
      skills: [],
      profileTags: [],
      currentRevealLevel: 1,
      profileCompletionPercentage: 0,
      osCredits: 5, // Starting credits
      isFoundingMember: true // Early user benefit
    };
    setDocumentNonBlocking(userProfileRef, newProfile, { merge: false });
    toast({ title: "Profile Created!", description: "You can now start filling out your details." });
  };

  const handleProfileUpdate = (data: Partial<UserProfile>) => {
    if (!firestore || !authUser) return;
    const userProfileRef = doc(firestore, `users/${authUser.id}`);
    const completionPercentage = calculateProfileCompletion({ ...candidateProfile, ...data } as UserProfile);
    updateDocumentNonBlocking(userProfileRef, { ...data, profileCompletionPercentage: completionPercentage });
    toast({ title: "Profile Updated", description: "Your changes have been saved." });
  };

  const handleUpgrade = () => {
    setIsPricingOpen(true);
  }

  const handleStartVerification = () => {
    router.push('/candidate/verify-skills');
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /> <p>Loading Talent profile...</p></div>;
  }

  if (!candidateProfile) {
    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /> <p>Loading Talent profile...</p></div>;

    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4">
        <p>Profile not found. Please complete onboarding.</p>
        <Button onClick={() => router.push('/onboarding')}>Go to Onboarding</Button>
      </div>
    );
  }

  const completionPercentage = calculateProfileCompletion(candidateProfile);
  const { eligible: isMatchEligible, items: eligibilityItems } = getMatchEligibility(candidateProfile);

  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      {!isMatchEligible && (
        <Card className="mb-6 border-yellow-500/50 bg-yellow-500/5 shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-yellow-500 shrink-0" />
            <div>
              <p className="font-semibold text-yellow-600">Complete your profile to start receiving job matches</p>
              <p className="text-sm text-muted-foreground">You need to finish the items below before the AI matching engine can find jobs for you.</p>
            </div>
          </CardContent>
        </Card>
      )}
      <form onChange={handleSubmit(handleProfileUpdate)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="w-full shadow-lg">
              <CardHeader className="bg-secondary p-6 rounded-t-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-16 w-16 sm:h-20 sm:w-20">
                      <Image src={`https://picsum.photos/seed/${candidateProfile.anonymizedName}/200`} alt="Anonymous Avatar" fill className="rounded-full object-cover" data-ai-hint="abstract geometric" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">{candidateProfile.anonymizedName}</CardTitle>
                      <CardDescription className="text-md text-muted-foreground">Your anonymous public profile</CardDescription>
                      {candidateProfile.isFoundingMember && (
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          <Sparkles className="h-4 w-4" />
                          Founding Member
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

                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <Label className="flex items-center text-lg font-semibold text-primary"><BadgePercent className="mr-2 h-5 w-5" /> Profile Completion</Label>
                    <span className="text-sm font-medium text-primary">{completionPercentage}%</span>
                  </div>
                  <Progress value={completionPercentage} className="w-full h-2.5" />
                  {completionPercentage < 100 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Complete your profile to improve match quality and unlock more features.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center text-lg font-semibold text-primary"><MapPin className="mr-2 h-5 w-5" /> Location Preferences</Label>
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <Controller
                      name="location"
                      control={control}
                      render={({ field }) => <Input {...field} id="location" placeholder="e.g. San Francisco, CA or Remote" className="bg-background mb-4" />}
                    />
                    <Controller
                      name="locationPreference"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col sm:flex-row gap-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="location" id="r-location" />
                            <Label htmlFor="r-location">Local Only</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="remote" id="r-remote" />
                            <Label htmlFor="r-remote">Remote Only</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="relocation" id="r-relocation" />
                            <Label htmlFor="r-relocation">Willing to Relocate</Label>
                          </div>
                        </RadioGroup>
                      )}
                    />
                    <p className="text-xs text-muted-foreground mt-2">This setting heavily influences your job matches.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience" className="flex items-center text-lg font-semibold text-primary"><Briefcase className="mr-2 h-5 w-5" /> Anonymized Experience Summary</Label>
                  <Controller
                    name="anonymizedExperienceSummary"
                    control={control}
                    render={({ field }) => (
                      <Textarea {...field} id="experience" placeholder="Describe your experience without mentioning company names or PII." rows={5} />
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <Label className="flex items-center text-lg font-semibold text-primary"><Award className="mr-2 h-5 w-5" /> Skills & Verification</Label>
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-2">Listed Skills:</h4>
                        <Controller
                          name="skills"
                          control={control}
                          render={({ field }) => (
                            <Input {...field} placeholder="Comma-separated skills, e.g., React, AI"
                              onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))}
                              value={Array.isArray(field.value) ? field.value.join(', ') : ''}
                            />
                          )}
                        />
                        <div className="flex flex-wrap gap-2 mt-2">
                          {candidateProfile.skills?.map(skill => (
                            <span key={skill} className="px-3 py-1 bg-accent text-accent-foreground text-sm rounded-full shadow-sm">{skill}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Verified Skills:</h4>
                        {candidateProfile.verifiedSkills && candidateProfile.verifiedSkills.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {candidateProfile.verifiedSkills.map(vSkill => (
                              <span key={vSkill.skill} className="flex items-center px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full shadow-sm" title={`Verified on ${new Date(vSkill.verificationDate).toLocaleDateString()}`}>
                                <CheckCircle className="h-4 w-4 mr-1.5 text-green-500" />
                                {vSkill.skill} ({vSkill.score}/100)
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No skills verified yet.</p>
                        )}
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="mt-4" onClick={handleStartVerification}>
                      <Zap className="mr-2 h-4 w-4" /> Start AI Skill Verification Interview
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">Prove your expertise in a role. (Costs 2 OS Credits)</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <CredentialVault />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center text-lg font-semibold text-primary"><Tags className="mr-2 h-5 w-5" /> Profile Tags</Label>
                  <Controller
                    name="profileTags"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} placeholder="Comma-separated tags, e.g., Leadership, Startup-Experience"
                        onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()))}
                        value={Array.isArray(field.value) ? field.value.join(', ') : ''}
                      />
                    )}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {candidateProfile.profileTags?.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-secondary text-secondary-foreground text-sm rounded-full shadow-sm">{tag}</span>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary flex items-center"><Brain className="mr-2 h-5 w-5" />Personality Insights</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium">MBTI Type: <span className="font-normal text-accent">{candidateProfile.mbti?.personalityType || "Not set"}</span></p>
                      <Button variant="link" size="sm" className="p-0 h-auto" type="button" onClick={() => router.push("/candidate/mbti-test")}>Take/Retake MBTI Test</Button>
                    </div>
                    <div>
                      <p className="font-medium">Big Five Scores:</p>
                      {candidateProfile.bigFive ? (
                        <ul className="list-disc list-inside text-sm">
                          <li>Openness: {candidateProfile.bigFive.openness * 100}%</li>
                          <li>Conscientiousness: {candidateProfile.bigFive.conscientiousness * 100}%</li>
                          <li>Extraversion: {candidateProfile.bigFive.extraversion * 100}%</li>
                          <li>Agreeableness: {candidateProfile.bigFive.agreeableness * 100}%</li>
                          <li>Neuroticism: {candidateProfile.bigFive.neuroticism * 100}%</li>
                        </ul>
                      ) : <p className="text-xs text-muted-foreground">Not set</p>}
                      <Button variant="link" size="sm" className="p-0 h-auto mt-1" type="button" onClick={() => router.push("/candidate/big-five-test")}>Take/Retake Big Five Test</Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center text-lg font-semibold text-primary">Reveal Level</Label>
                  <p className="text-sm text-muted-foreground">
                    Current reveal level: <strong>Level {candidateProfile.currentRevealLevel}</strong>. Higher levels reveal more specific information to matched employers after mutual interest.
                  </p>
                </div>

                <div className="items-top flex space-x-2 pt-4">
                  <Checkbox id="terms" defaultChecked />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="terms"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Allow TalentOS to use AI to anonymize and parse my profile.
                    </label>
                    <p className="text-xs text-muted-foreground">
                      You can manage your anonymization settings at any time.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-8">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary flex items-center">
                  <CheckCircle className="mr-2 h-5 w-5" /> Profile Readiness
                </CardTitle>
                <CardDescription>Requirements to be match-eligible</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {eligibilityItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.met ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <span className="h-4 w-4 shrink-0 text-red-500 flex items-center justify-center font-bold text-xs">X</span>
                      )}
                      <span className={`text-sm ${item.met ? 'text-muted-foreground' : 'text-foreground'}`}>{item.label}</span>
                    </div>
                    {!item.met && (
                      <Button variant="link" size="sm" className="p-0 h-auto text-xs" type="button" onClick={() => router.push(item.link)}>
                        Complete
                      </Button>
                    )}
                  </div>
                ))}
                {isMatchEligible && (
                  <p className="text-sm text-green-600 font-medium pt-2 border-t">You are match-eligible!</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary flex items-center">
                  <ShieldCheck className="mr-2 h-5 w-5" /> Humanity Score
                </CardTitle>
                <CardDescription>Verified via Interaction Biometrics</CardDescription>
              </CardHeader>
              <CardContent>
                {candidateProfile?.humanityScore !== undefined ? (
                  <div className="flex flex-col items-center">
                    <div className={`relative flex items-center justify-center w-24 h-24 rounded-full border-4 text-3xl font-bold mb-2
                                ${candidateProfile.humanityScore >= 80 ? 'border-green-500 text-green-600' :
                        candidateProfile.humanityScore >= 50 ? 'border-yellow-500 text-yellow-600' :
                          'border-red-500 text-red-600'}`}>
                      {candidateProfile.humanityScore}
                    </div>
                    <p className="text-sm font-medium">
                      {candidateProfile.humanityScore >= 80 ? 'Verified Human' :
                        candidateProfile.humanityScore >= 50 ? 'Suspicious Activity' :
                          'Bot Detected'}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-4">Not verified yet.</p>
                    <Button variant="outline" size="sm" onClick={handleStartVerification}>
                      Verify Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-primary flex items-center">
                  <Sparkles className="mr-2 h-6 w-6" /> Become a Founding Member
                </CardTitle>
                <CardDescription>Get the strategic edge with premium features.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="font-semibold">For a small monthly fee, you unlock:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong className="text-primary">Get Seen First:</strong> Your profile gets priority placement in employer match results.</li>
                  <li><strong className="text-primary">Deeper Insights:</strong> See advanced analytics on team archetypes and why you matched.</li>
                  <li><strong className="text-primary">AI Interview Review:</strong> Get detailed feedback on your AI skill verification interviews to sharpen your knowledge.</li>
                  <li><strong className="text-primary">Lifetime Discounts:</strong> Lock in lower fees on all future premium features.</li>
                  <li><strong className="text-primary">Stealth Mode+:</strong> Block specific companies from ever seeing your profile.</li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button type="button" className="w-full bg-primary hover:bg-primary/90" onClick={handleUpgrade}>
                  <Star className="mr-2" /> Upgrade Now
                </Button>
              </CardFooter>
            </Card>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary flex items-center"><Zap className="mr-2 h-5 w-5" /> OS Credits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-6xl font-bold">{candidateProfile.osCredits}</p>
                <p className="text-sm text-muted-foreground mt-2">OS Credits are used for high-value AI operations like skill verification.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} role="candidate" />
    </div>
  );
}
