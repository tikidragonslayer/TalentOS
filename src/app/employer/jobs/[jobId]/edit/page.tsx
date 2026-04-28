// src/app/employer/jobs/[jobId]/edit/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUser, useFirestore } from "@/contexts/user-context";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, DollarSign, Info, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { doc, getDoc } from "firebase/firestore";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import type { JobPosting, Company } from "@/types";
import { anonymizeJobDescriptionAction } from "@/app/actions/anonymize-actions";
import { getAuth } from "firebase/auth";
import { ActiveJobContextBuilder } from "@/components/jobs/active-job-context-builder";
import { updateJobAction } from "@/app/actions/job-actions";
import type { JobContextResult } from "@/app/actions/job-context-actions";

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

export default function EditJobPage() {
  const { authUser, profile, isLoading: userLoading, setRole } = useUser();
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAnonymizing, setIsAnonymizing] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [existingJob, setExistingJob] = useState<JobPosting | null>(null);
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

  // Fetch existing job data
  useEffect(() => {
    async function fetchJob() {
      if (!firestore || !jobId || !companyProfile?.id) return;

      try {
        const jobDoc = await getDoc(doc(firestore, "jobListings", jobId));
        if (!jobDoc.exists()) {
          toast({ title: "Error", description: "Job posting not found.", variant: "destructive" });
          router.push("/employer/jobs");
          return;
        }

        const jobData = { id: jobDoc.id, ...jobDoc.data() } as JobPosting;

        // Verify ownership
        if (jobData.companyId !== companyProfile.id) {
          toast({ title: "Unauthorized", description: "You do not own this job posting.", variant: "destructive" });
          router.push("/employer/jobs");
          return;
        }

        // Block editing if hired or closed
        if (jobData.status === "hired" || jobData.status === "closed") {
          toast({ title: "Cannot Edit", description: `This job is "${jobData.status}" and cannot be edited.`, variant: "destructive" });
          router.push("/employer/jobs");
          return;
        }

        setExistingJob(jobData);

        // Pre-fill form
        form.reset({
          title: jobData.title || "",
          location: jobData.location || "",
          hiringMode: jobData.hiringMode || "location",
          description: jobData.description || "",
          anonymizedDescription: jobData.anonymizedDescription || "",
          requirements: Array.isArray(jobData.requirements) ? jobData.requirements.join(", ") : "",
          idealCandidateMbti: jobData.idealCandidateMbti || "",
          bonusAmount: jobData.bonusAmount || 500,
          expectedHireDate: jobData.expectedHireDate ? jobData.expectedHireDate.split("T")[0] : "",
        });
      } catch (error) {
        console.error("Error fetching job:", error);
        toast({ title: "Error", description: "Failed to load job posting.", variant: "destructive" });
        router.push("/employer/jobs");
      } finally {
        setIsLoadingJob(false);
      }
    }

    if (!userLoading && companyProfile?.id) {
      fetchJob();
    }
  }, [firestore, jobId, companyProfile?.id, userLoading, router, toast, form]);

  const handleAnonymizeDescription = async () => {
    const originalDescription = form.getValues("description");
    if (!originalDescription || originalDescription.length < 20) {
      toast({ title: "Error", description: "Please provide a more detailed description to anonymize.", variant: "destructive" });
      return;
    }

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
      form.setValue("anonymizedDescription", existingJob?.anonymizedDescription || "");
    } finally {
      setIsAnonymizing(false);
    }
  };

  const handleJobContextExtracted = (result: JobContextResult) => {
    const currentDesc = form.getValues("description");
    const newContext = `\n\n--- AI GENERATED JOB DNA ---\n\n**Culture Analysis:**\n${result.cultureAnalysis}\n\n**Team Dynamics:**\n${result.teamDynamic}\n\n**Hidden Requirements:**\n- ${result.hiddenRequirements.join('\n- ')}`;

    form.setValue("description", currentDesc + newContext);

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
    if (!firestore || !companyProfile || !existingJob) {
      toast({ title: "Error", description: "Cannot update job. Data not loaded.", variant: "destructive" });
      return;
    }

    try {
      const firebaseAuth = getAuth();
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      if (!idToken) {
        toast({ title: "Auth error", variant: "destructive" });
        return;
      }

      const updates: Partial<JobPosting> = {
        title: data.title,
        location: data.location,
        hiringMode: data.hiringMode,
        description: data.description,
        anonymizedDescription: data.anonymizedDescription,
        requirements: data.requirements.split(",").map(r => r.trim()),
        idealCandidateMbti: data.idealCandidateMbti || undefined,
        bonusAmount: data.bonusAmount,
        expectedHireDate: data.expectedHireDate ? new Date(data.expectedHireDate).toISOString() : undefined,
      };

      const result = await updateJobAction(idToken, jobId, updates);

      if (result.success) {
        toast({
          title: "Job Updated",
          description: `"${data.title}" has been updated successfully.${result.matchingTriggered ? " AI matching has been re-triggered." : ""}`,
        });
        router.push("/employer/jobs");
      } else {
        toast({ title: "Update Failed", description: result.error || "Could not update job posting.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Update error:", error);
      toast({ title: "Error", description: error.message || "Failed to update job.", variant: "destructive" });
    }
  };

  if (userLoading || isLoadingJob || !profile) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /><p>Loading job details...</p></div>;
  }

  if (!existingJob) {
    return <div className="flex h-screen items-center justify-center"><p>Job not found.</p></div>;
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Edit Job Posting</CardTitle>
          <CardDescription>Update the details for "{existingJob.title}".</CardDescription>
        </CardHeader>
        <CardContent>
          {existingJob.status === "open" && (
            <div className="mb-6 flex items-start gap-3 p-4 border border-destructive/50 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-destructive">Live Listing Warning</p>
                <p className="text-sm text-destructive/80">
                  This job is currently open and visible to candidates. Changes may affect existing matches and applicant expectations.
                </p>
              </div>
            </div>
          )}

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
                    <Select onValueChange={field.onChange} value={field.value}>
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

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push("/employer/jobs")}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
