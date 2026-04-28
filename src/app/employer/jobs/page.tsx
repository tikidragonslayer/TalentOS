// src/app/employer/jobs/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/contexts/user-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusCircle, Edit, Eye, Trash2, DollarSign, Clock, MapPin, Award, CheckCircle, Loader2, Sparkles } from "lucide-react";
import type { JobPosting, Company } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { PayDepositDialog } from "@/components/employer/pay-deposit-dialog";
import { collection, query, where, doc } from "firebase/firestore";
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { matchCandidatesToJobAction } from "@/app/actions/match-actions";
import { getAuth } from "firebase/auth";

export default function ManageJobsPage() {
  const { authUser, profile, isLoading: isUserLoading, setRole } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const companyProfile = profile as Company | null;
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [matchingJobId, setMatchingJobId] = useState<string | null>(null);

  const jobsQuery = useMemoFirebase(() => {
    if (!firestore || !companyProfile?.id) return null;
    return query(collection(firestore, "jobListings"), where("companyId", "==", companyProfile.id));
  }, [firestore, companyProfile?.id]);
  
  const { data: jobs, isLoading: areJobsLoading } = useCollection<JobPosting>(jobsQuery);

  useEffect(() => {
    if (!isUserLoading && authUser) {
      setRole("employer");
    } else if (!isUserLoading && !authUser) {
      router.push("/login?role=employer");
    }
  }, [authUser, isUserLoading, router, setRole]);

  const handleMarkHired = (jobId: string) => {
    if(!firestore) return;
    const jobDocRef = doc(firestore, 'jobListings', jobId);
    updateDocumentNonBlocking(jobDocRef, { status: 'hired' });
    toast({
      title: "Marked as Hired",
      description: "Congratulations! Remember to pay the sign-on bonus directly to your new hire per the Commitment Agreement.",
    });
  };
  
  const handleOpenPayDialog = (job: JobPosting) => {
    setSelectedJob(job);
    setIsPayDialogOpen(true);
  }
  
  const handlePaymentSuccess = async (jobId: string) => {
    if(!firestore) return;
    const jobDocRef = doc(firestore, 'jobListings', jobId);
    updateDocumentNonBlocking(jobDocRef, {
      status: 'open',
      platformFeePaid: true,
      activatedAt: new Date().toISOString(),
    });
    toast({ title: "Job Activated!", description: "Platform fee paid. Our AI is now finding the best candidates for your role."});

    // Trigger AI matching flow for this job (Stripe webhook also triggers this server-side)
    await handleRunMatching(jobId);
  };

  const handleRunMatching = async (jobId: string) => {
    if (!authUser) return;
    setMatchingJobId(jobId);
    try {
      const fbAuth = getAuth();
      const idToken = await fbAuth.currentUser?.getIdToken();
      if (!idToken) {
        toast({ title: "Authentication Error", description: "Could not get auth token. Please try again.", variant: "destructive" });
        return;
      }
      const result = await matchCandidatesToJobAction(idToken, jobId);
      if (result.success) {
        toast({
          title: "AI Matching Complete",
          description: result.count
            ? `Found ${result.count} candidate match${result.count === 1 ? '' : 'es'} for this role.`
            : result.message || "No strong matches found yet.",
        });
      } else {
        toast({ title: "Matching Failed", description: result.error || "Something went wrong.", variant: "destructive" });
      }
    } catch (err) {
      console.error("Run matching error:", err);
      toast({ title: "Matching Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setMatchingJobId(null);
    }
  };

  const handleDeleteJob = (jobId: string) => {
    if(!firestore) return;
    if (confirm("Are you sure you want to delete this job posting? This action cannot be undone.")) {
      const jobDocRef = doc(firestore, 'jobListings', jobId);
      deleteDocumentNonBlocking(jobDocRef);
      toast({ title: "Job Deleted", variant: "destructive" });
    }
  }

  const isLoading = isUserLoading || areJobsLoading;

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /> <p>Loading job postings...</p></div>;
  }

  const getStatusBadgeClasses = (status: JobPosting['status']) => {
    switch (status) {
      case 'open': return 'bg-green-500 text-white hover:bg-green-600';
      case 'closed': return 'bg-gray-500 text-white hover:bg-gray-600';
      case 'hired': return 'bg-blue-500 text-white hover:bg-blue-600';
      case 'pending_payment': return 'bg-yellow-500 text-black hover:bg-yellow-600';
      default: return '';
    }
  };

  return (
    <>
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">Manage Job Postings</h1>
          <p className="text-muted-foreground">Oversee your active and pending job listings.</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/employer/jobs/new">
            <PlusCircle className="mr-2 h-5 w-5" /> Post New Job
          </Link>
        </Button>
      </div>

      {jobs && jobs.length === 0 && (
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle>No Job Postings Yet</CardTitle>
            <CardDescription>
              Click "Post New Job" to start finding talent.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {jobs?.map((job) => (
          <Card key={job.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="pb-4">
               <div className="flex items-start justify-between">
                <CardTitle className="text-xl font-semibold text-primary leading-tight">{job.title}</CardTitle>
                <Badge className={getStatusBadgeClasses(job.status)}>
                  {job.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <MapPin className="h-3 w-3 mr-1" />
                {job.location}
              </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-3">
              <p className="text-sm text-foreground/80 line-clamp-3">{job.anonymizedDescription}</p>
              <div className="flex items-center text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4 mr-1 text-green-600" />
                Sign-On Bonus: ${job.bonusAmount?.toLocaleString() || 0}
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4 mr-1 text-primary" />
                Platform Fee: {job.platformFeePaid ? "Paid" : "Pending"}
              </div>
              {job.expectedHireDate && (
                 <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 mr-1 text-primary" />
                    Expected Hire: {new Date(job.expectedHireDate).toLocaleDateString()}
                 </div>
              )}
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2 pt-4 border-t">
              <Button variant="outline" size="sm" className="w-full" onClick={() => router.push(`/employer/jobs/${job.id}/applicants`)}>
                <Eye className="mr-2 h-4 w-4" /> View Applicants
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={() => router.push(`/employer/jobs/${job.id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" /> Edit Job
              </Button>
              
              {job.status === 'pending_payment' && (
                <Button onClick={() => handleOpenPayDialog(job)} size="sm" className="w-full bg-green-600 hover:bg-green-700 col-span-2">
                  <DollarSign className="mr-2 h-4 w-4" /> Pay Platform Fee & Activate
                </Button>
              )}

              {job.status === 'open' && (
                <>
                  <Button
                    onClick={() => handleRunMatching(job.id)}
                    size="sm"
                    className="w-full bg-purple-600 hover:bg-purple-700 col-span-2"
                    disabled={matchingJobId === job.id}
                  >
                    {matchingJobId === job.id ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Matching...</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" /> Run AI Matching</>
                    )}
                  </Button>
                  <Button onClick={() => handleMarkHired(job.id)} size="sm" className="w-full bg-blue-600 hover:bg-blue-700 col-span-2">
                    <Award className="mr-2 h-4 w-4" /> Mark as Hired
                  </Button>
                </>
              )}

              {job.status === 'hired' && (
                 <div className="col-span-2 text-center text-sm font-medium text-green-600 flex items-center justify-center p-2 bg-green-50 rounded-md">
                   <CheckCircle className="mr-2 h-4"/> Hired — Pay bonus per Commitment Agreement
                 </div>
              )}

              <Button variant="destructive" size="sm" className="w-full col-span-2" onClick={() => handleDeleteJob(job.id)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Job
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
    {selectedJob && (
        <PayDepositDialog
            job={selectedJob}
            isOpen={isPayDialogOpen}
            onClose={() => setIsPayDialogOpen(false)}
            onPaymentSuccess={handlePaymentSuccess}
        />
    )}
    </>
  );
}
