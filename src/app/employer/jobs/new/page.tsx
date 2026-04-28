// src/app/employer/jobs/new/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUser, useFirestore } from "@/contexts/user-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, DollarSign, Info } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collection } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import type { JobPosting, Company } from "@/types";

import { anonymizeJobDescriptionAction } from '@/app/actions/anonymize-actions';
import { getAuth } from "firebase/auth";
import { ActiveJobContextBuilder } from "@/components/jobs/active-job-context-builder";
import { submitJobListing } from '@/app/actions/job-actions';
import type { JobContextResult } from '@/app/actions/job-context-actions';


const jobPostingSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  location: z.string().min(3, "Location is required"),
  hiringMode: z.enum(["location", "remote", "relocation"]),
  description: z.string().min(50, "Description must be at least 50 characters"),
  anonymizedDescription: z.string().min(20, "Anonymized description must be at least 20 characters."),
  requirements: z.string().min(10, "Requirements must be at least 10 characters (comma-separated)"),
  idealCandidateMbti: z.string().optional(),
  bonusAmount: z.preprocess(
    (val) => Number(String(val)),
    z.number().min(50, "Sign-on bonus must be at least $50")
  ),
  expectedHireDate: z.string().optional(),
});

type JobPostingFormData = z.infer<typeof jobPostingSchema>;

export default function NewJobPage() {
  const { authUser, profile, isLoading: userLoading, setRole } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const companyProfile = profile as Company | null;

  const form = useForm<JobPostingFormData>({
    resolver: zodResolver(jobPostingSchema),
    defaultValues: {
      title: "",
      location: "",
      hiringMode: "location",
      description: "",
      anonymizedDescription: "",
      requirements: "",
      idealCandidateMbti: "",
      bonusAmount: 500,
    },
  });

  useEffect(() => {
    if (!userLoading && authUser) {
      setRole("employer");
    } else if (!userLoading && !authUser) {
      router.push("/login?role=employer");
    }
  }, [authUser, userLoading, router, setRole]);

  const handleAnonymizeDescription = async () => {
    const originalDescription = form.getValues("description");
    if (!originalDescription || originalDescription.length < 20) {
      toast({ title: "Error", description: "Please provide a more detailed description to anonymize.", variant: "destructive" });
      return;
    }

    // Optimistic check (server will double check)
    if ((companyProfile?.osCredits ?? 0) < 1) {
      toast({ title: "Insufficient OS Credits", description: "Please purchase more OS credits from your profile page to use this feature.", variant: "destructive" });
      return;
    }

    if (!authUser) return;

    setIsAnonymizing(true);
    form.setValue("anonymizedDescription", "Generating...");

    try {
      const firebaseAuth = getAuth();
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      if (!idToken) { toast({ title: "Auth error", variant: "destructive" }); setIsAnonymizing(false); return; }
      const result = await anonymizeJobDescriptionAction(idToken, originalDescription);

      if (result.success && result.anonymizedDescription) {
        form.setValue("anonymizedDescription", result.anonymizedDescription);
        toast({
          title: "Success",
          description: `Description anonymized. You have ${result.remainingCredits} credits remaining.`
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error("Anonymization error:", error);
      toast({ title: "Anonymization Failed", description: error.message || "Could not anonymize description.", variant: "destructive" });
      form.setValue("anonymizedDescription", "");
    } finally {
      setIsAnonymizing(false);
    }
  };

  const handleJobContextExtracted = (result: JobContextResult) => {
    // Append the extracted "DNA" to the description and requirements
    const currentDesc = form.getValues("description");
    const newContext = `\n\n--- AI GENERATED JOB DNA ---\n\n**Culture Analysis:**\n${result.cultureAnalysis}\n\n**Team Dynamics:**\n${result.teamDynamic}\n\n**Hidden Requirements:**\n- ${result.hiddenRequirements.join('\n- ')}`;

    form.setValue("description", currentDesc + newContext);

    // Add keywords to requirements if not present
    const currentReqs = form.getValues("requirements");
    const newKeywords = result.recommendedKeywords.filter(k => !currentReqs.includes(k));
    if (newKeywords.length > 0) {
      form.setValue("requirements", currentReqs ? `${currentReqs}, ${newKeywords.join(', ')}` : newKeywords.join(', '));
    }

    toast({
      title: "Job DNA Applied",
      description: "We've enhanced your description with insights provided by the AI agent.",
    });
  };


  const onSubmit: SubmitHandler<JobPostingFormData> = async (data) => {
    if (!firestore || !companyProfile) {
      toast({ title: "Error", description: "Cannot create job. Company profile not found.", variant: "destructive" });
      return;
    };

    const jobsRef = collection(firestore, "jobListings");
    const newJob: Omit<JobPosting, 'id'> = {
      companyId: companyProfile.id,
      ...data,
      requirements: data.requirements.split(',').map(r => r.trim()),
      status: 'pending_payment',
      platformFeePaid: false,
      jobPostedDate: new Date().toISOString(),
      expectedHireDate: data.expectedHireDate ? new Date(data.expectedHireDate).toISOString() : undefined
    };

    addDocumentNonBlocking(jobsRef, newJob);

    toast({
      title: "Job Posting Saved",
      description: `"${data.title}" is pending platform fee payment on your 'Manage Jobs' page.`,
    });
    router.push("/employer/jobs");
  };

  if (userLoading || !profile) {
    return <div className="flex h-screen items-center justify-center"><p>Loading form...</p></div>;
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Post a New Confidential Role</CardTitle>
          <CardDescription>Fill in the details below. Final activation and AI matching occurs after platform fee payment.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title</FormLabel>
                    <FormControl><Input placeholder="e.g., Senior Software Engineer, Stealth Project" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hiringMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hiring Mode</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a hiring mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="location">Local</SelectItem>
                        <SelectItem value="remote">Remote</SelectItem>
                        <SelectItem value="relocation">Relocation</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Determines how location is weighted in the matching algorithm.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl><Input placeholder="e.g., San Francisco, CA or Remote" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Job Description (Internal Use)</FormLabel>
                    <FormControl><Textarea placeholder="Provide the full, detailed job description here. This remains confidential and is used for AI matching." {...field} rows={8} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ACTIVE JOB CONTEXT BUILDER */}
              <div className="mb-6">
                <ActiveJobContextBuilder onContextExtracted={handleJobContextExtracted} />
              </div>

              <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                <FormField
                  control={form.control}
                  name="anonymizedDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Anonymized Public Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={5} placeholder="Write your public, anonymized job description here, or use the AI generator." />
                      </FormControl>
                      <FormDescription>This is the only description candidates will see initially.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" onClick={handleAnonymizeDescription} disabled={isAnonymizing} variant="outline" className="mt-2">
                  {isAnonymizing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {isAnonymizing ? "Anonymizing..." : `Generate with AI (Costs 1 OS Credit)`}
                </Button>
                <p className="text-xs text-muted-foreground pt-1">You have {companyProfile?.osCredits} OS credits remaining.</p>
              </div>

              <FormField
                control={form.control}
                name="requirements"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key Skills/Requirements</FormLabel>
                    <FormControl><Textarea placeholder="e.g., React, Node.js, Project Management, 5+ years experience" {...field} rows={3} /></FormControl>
                    <FormDescription>List key skills, experience, or qualifications, comma-separated. These will be used for matching.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="idealCandidateMbti"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ideal Candidate MBTI Type (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., INFP, ESTJ" {...field} /></FormControl>
                    <FormDescription>Helps in personality-based matching.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expectedHireDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Hire Date (Optional)</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormDescription>Helps set expectations for the hiring timeline.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bonusAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4 text-green-600" /> Candidate Sign-On Bonus</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 500" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="text-xs text-muted-foreground p-2 bg-secondary/50 rounded-md mt-2 flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                <div>
                  Set the <strong>Sign-On Bonus</strong> you will pay the candidate directly upon their start date.
                  A <strong>10% platform fee</strong> (min $5) is charged when you activate the listing.
                  You will sign a Bonus Commitment Agreement at activation — this is a binding promise between you and the candidate. TalentSync does not hold or transfer bonus funds.
                </div>
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Job & Proceed to Payment
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
