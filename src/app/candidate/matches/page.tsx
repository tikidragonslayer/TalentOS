// src/app/candidate/matches/page.tsx
"use client";

import { GlassCard, GlassContent, GlassFooter, GlassHeader } from "@/components/ui/glass-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Keeping simple Card for fallback or zero-states if desired, but mostly replacing.
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useUser } from "@/contexts/user-context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, MessageSquare, TrendingUp, MapPin, ShieldAlert, ThumbsUp, ThumbsDown, Info, Loader2, RefreshCw, Sparkles, ShieldCheck, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import type { MatchScore, JobPosting, Conversation, UserProfile } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, doc } from "firebase/firestore";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { getAuth } from "firebase/auth";
import { scanForMatchesAction } from '@/app/actions/match-actions';
import { initiateConversationAction } from '@/app/actions/conversation-actions';
import { RevealRequestModal } from "@/components/modals/reveal-request-modal";
import { JobDetailsModal } from "@/components/modals/job-details-modal";
import { ScanningRadar } from "@/components/ui/scanning-radar";

export default function CandidateMatchesPage() {
  // DEMO OVERRIDE:
  // DEMO OVERRIDE:
  const { authUser, profile, isLoading: isUserLoading, setRole } = useUser();
  // const authUser = { id: 'sim_candidate_001', email: 'alice@simulation.com' };
  // const profile = { anonymizedName: 'Alice S.', mbti: 'INTJ' }; // Hardcoding profile for demo
  // const isUserLoading = false;
  // const setRole = () => { }; // No-op for demo
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchScore | null>(null);
  const [viewingJob, setViewingJob] = useState<Partial<JobPosting> | null>(null);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  const candidateProfile = profile as UserProfile | null;

  const eligibilityChecks = [
    { label: 'MBTI personality test', met: !!candidateProfile?.mbti, link: '/candidate/mbti-test' },
    { label: 'Big Five personality test', met: !!candidateProfile?.bigFive, link: '/candidate/big-five-test' },
    { label: 'At least 1 verified skill', met: !!(candidateProfile?.verifiedSkills && candidateProfile.verifiedSkills.length > 0), link: '/candidate/verify-skills' },
    { label: 'Humanity score above 50', met: !!(candidateProfile?.humanityScore && candidateProfile.humanityScore >= 50), link: '/candidate/verify-skills' },
  ];
  const isMatchEligible = eligibilityChecks.every(c => c.met);

  const matchesQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return query(collection(firestore, "matchScores"), where("userProfileId", "==", authUser.id));
  }, [firestore, authUser]);

  const { data: matches, isLoading: areMatchesLoading } = useCollection<MatchScore>(matchesQuery);

  useEffect(() => {
    if (!isUserLoading && authUser) {
      setRole("candidate");
    } else if (!isUserLoading && !authUser) {
      router.push('/login?role=candidate');
    }
  }, [authUser, isUserLoading, router, setRole]);

  const eligibilityErrorMessages = [
    'Please complete the MBTI personality test before scanning for matches.',
    'Please complete the Big Five personality test before scanning for matches.',
    'Please verify at least one skill before scanning for matches.',
    'Your humanity score is too low. Please complete a skill verification to improve it.',
  ];

  const handleScan = async () => {
    if (!authUser) return;
    setEligibilityError(null);
    setIsScanning(true);
    try {
      const firebaseAuth = getAuth();
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      if (!idToken) { toast({ title: "Auth Error", variant: "destructive" }); return; }
      const result = await scanForMatchesAction(idToken);
      if (result.success) {
        toast({
          title: "Scan Complete",
          description: `Found ${result.count || 0} matches based on your profile.`,
        });
      } else if (result.error && eligibilityErrorMessages.includes(result.error)) {
        setEligibilityError(result.error);
      } else {
        toast({
          title: "Scan Failed",
          description: result.error || "Unknown error",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Scan Error", error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleFeedback = (matchId: string, feedback: 'positive' | 'negative') => {
    if (!firestore) return;
    const matchDocRef = doc(firestore, `matchScores/${matchId}`);
    updateDocumentNonBlocking(matchDocRef, { feedback }); // Note: Ensure 'doc' is imported if used
    toast({
      title: "Feedback Submitted",
      description: `Thank you for your feedback on this match! It helps us improve.`,
    });
  };

  const [isConnecting, setIsConnecting] = useState(false);

  const handleConfirmInterest = async () => {
    if (!authUser || !selectedMatch) return;
    setIsConnecting(true);

    try {
      const firebaseAuth = getAuth();
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      if (!idToken) {
        toast({ title: "Authentication Error", description: "Please sign in again.", variant: "destructive" });
        return;
      }

      const result = await initiateConversationAction(idToken, selectedMatch.id);

      if (result.success && result.conversationId) {
        toast({
          title: result.existing ? "Channel Already Open" : "Signal Sent!",
          description: result.existing
            ? "Redirecting to your existing conversation."
            : "Handshake initiated. A secure channel has been opened.",
        });
        router.push(`/messages/${result.conversationId}`);
        setSelectedMatch(null);
      } else {
        toast({ title: "Error", description: result.error || "Could not express interest.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error("Error expressing interest:", e);
      toast({ title: "Error", description: e.message || "Could not express interest. Please try again.", variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  }

  const getDisplayLocation = (location: string | undefined) => {
    if (!location) return "Not specified";
    if (location.toLowerCase().includes('remote')) {
      return location;
    }
    const parts = location.split(',');
    const state = parts.length > 1 ? parts[parts.length - 1].trim() : 'ST';
    return `Metro Area, ${state}`;
  };

  const isLoading = isUserLoading || areMatchesLoading;

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /> <p>Loading job matches...</p></div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 text-center relative">
        <h1 className="text-3xl font-bold text-primary">Your Job Matches</h1>
        <p className="text-muted-foreground">Based on your profile, skills, and personality assessments.</p>
        <div className="absolute right-0 top-0">
          <Button onClick={handleScan} disabled={isScanning} variant="outline" size="sm">
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Scan for Matches
          </Button>
        </div>
      </div>

      {/* Profile Readiness Mini-Widget */}
      <Card className={`mb-6 ${isMatchEligible ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className={`h-5 w-5 ${isMatchEligible ? 'text-green-500' : 'text-yellow-500'}`} />
            <h3 className="font-semibold text-sm">{isMatchEligible ? 'Profile Ready for Matching' : 'Profile Readiness'}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {eligibilityChecks.map((check) => (
              <div key={check.label} className="flex items-center gap-1.5">
                {check.met ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <span className="text-xs text-muted-foreground">{check.label}</span>
                {!check.met && (
                  <Button variant="link" size="sm" className="p-0 h-auto text-[10px]" onClick={() => router.push(check.link)}>Fix</Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Eligibility Error Card */}
      {eligibilityError && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Profile Incomplete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{eligibilityError}</p>
            <div className="flex flex-wrap gap-2">
              {eligibilityChecks.filter(c => !c.met).map((check) => (
                <Button key={check.label} variant="outline" size="sm" onClick={() => router.push(check.link)}>
                  {check.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {matches && matches.length === 0 && (
        <GlassCard variant="neon" className="text-center py-16 max-w-2xl mx-auto border-dashed border-primary/30">
          <GlassContent className="flex flex-col items-center">
            <ScanningRadar className="mb-8" />
            <h2 className="text-2xl font-bold text-white mb-2">AI Agent Active</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              We haven't found a perfect match yet, but your agent is monitoring the network for new opportunities.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              <Button onClick={() => router.push('/candidate/profile')} variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
                Update Search Criteria
              </Button>
              <Button onClick={handleScan} disabled={isScanning} className="bg-primary text-black hover:bg-primary/90 font-bold min-w-[160px]">
                {isScanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Force Rescan
              </Button>
            </div>
          </GlassContent>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {matches?.map((match) => (
          <GlassCard key={match.id} variant="neon" className="flex flex-col">
            <GlassHeader className="pb-4 border-white/10">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white leading-tight">{match.jobPostingSnapshot?.title}</h3>
                  <p className="text-sm text-gray-400 flex items-center gap-1">
                    {match.jobPostingSnapshot?.anonymizedCompanyName || "Confidential Company"}
                    <span className="text-emerald-400 flex items-center gap-0.5 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Identity Verified">
                      <ShieldCheck className="h-3 w-3" /> Verified
                    </span>
                  </p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 ${match.score > 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50' : match.score > 60 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'} rounded-full text-sm font-bold`}>
                  <TrendingUp className="h-4 w-4" />
                  {match.score}%
                </div>
              </div>
              <div className="flex items-center text-xs text-gray-500 mt-2">
                <MapPin className="h-3 w-3 mr-1" />
                {getDisplayLocation(match.jobPostingSnapshot?.location)}
              </div>
            </GlassHeader>
            <GlassContent className="flex-grow space-y-4">
              <p className="text-sm text-gray-300 line-clamp-3">{match.jobPostingSnapshot?.anonymizedDescription}</p>

              {match.breakdown && (
                <div className="grid grid-cols-2 gap-3 py-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-cyan-300/80 uppercase tracking-wider"><span>Skills</span><span>{match.breakdown.skills}%</span></div>
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" style={{ width: `${match.breakdown.skills}%` }} /></div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-purple-300/80 uppercase tracking-wider"><span>Culture</span><span>{match.breakdown.culture}%</span></div>
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" style={{ width: `${match.breakdown.culture}%` }} /></div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-emerald-300/80 uppercase tracking-wider"><span>Urgency</span><span>{match.breakdown.urgency}%</span></div>
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${match.breakdown.urgency}%` }} /></div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-yellow-300/80 uppercase tracking-wider"><span>Logistics</span><span>{match.breakdown.logistics}%</span></div>
                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" style={{ width: `${match.breakdown.logistics}%` }} /></div>
                  </div>
                </div>
              )}

              <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                <h4 className="text-xs font-semibold text-primary mb-1 flex items-center"><Info className="h-3 w-3 mr-1" />Match Logic:</h4>
                <p className="text-xs text-gray-400 italic line-clamp-2">{match.justification}</p>
              </div>
              <div className="flex items-center text-xs text-gray-500">
                <ShieldAlert className="h-3 w-3 mr-1 text-primary" />
                Ideal Archetype: <span className="text-white ml-1">{match.jobPostingSnapshot?.idealCandidateMbti || 'Not specified'}</span>
              </div>
            </GlassContent>
            <GlassFooter className="flex flex-col gap-2">
              <div className="flex w-full gap-2">
                <Button variant="ghost" size="sm" className="flex-1 text-gray-300 hover:text-white hover:bg-white/10" onClick={() => setViewingJob(match.jobPostingSnapshot || null)}>
                  <Eye className="mr-2 h-4 w-4" /> View Details
                </Button>
                <Button size="sm" className="flex-1 bg-primary text-black hover:bg-primary/90 font-bold" onClick={() => setSelectedMatch(match)}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Connect
                </Button>
              </div>
              <div className="flex w-full gap-2 pt-2 border-t border-white/5 justify-between items-center">
                <p className="text-xs text-gray-500">Accuracy feedback:</p>
                <div className="flex gap-2">
                  <Button
                    variant={match.feedback === 'positive' ? "default" : "ghost"}
                    size="icon"
                    className={`h-8 w-8 rounded-full ${match.feedback === 'positive' ? 'bg-emerald-500 text-black' : 'hover:bg-white/10 text-gray-400'}`}
                    onClick={() => handleFeedback(match.id, 'positive')}
                    disabled={!!match.feedback}
                  >
                    <ThumbsUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={match.feedback === 'negative' ? "destructive" : "ghost"}
                    size="icon"
                    className={`h-8 w-8 rounded-full ${match.feedback === 'negative' ? 'bg-red-500 text-white' : 'hover:bg-white/10 text-gray-400'}`}
                    onClick={() => handleFeedback(match.id, 'negative')}
                    disabled={!!match.feedback}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </GlassFooter>
          </GlassCard>
        ))}
      </div>

      <RevealRequestModal
        isOpen={!!selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onRequest={handleConfirmInterest}
        currentTier={0}
        isProcessing={false} // Match page doesn't have local processing state for the modal action easily available, could add it but keeping simple
        employerName={selectedMatch?.jobPostingSnapshot?.anonymizedCompanyName || "Confidential Company"}
        jobTitle={selectedMatch?.jobPostingSnapshot?.title || "Role"}
      />

      {viewingJob && (
        <JobDetailsModal
          isOpen={!!viewingJob}
          onClose={() => setViewingJob(null)}
          onConnect={() => {
            // Find the match associated with this job to set as selectedMatch
            const match = matches?.find(m => m.jobPostingSnapshot?.title === viewingJob.title); // Simple loose match for now, ideally use ID if available in snapshot
            if (match) setSelectedMatch(match);
            setViewingJob(null);
          }}
          jobSnapshot={viewingJob}
        />
      )}
    </div>
  );
}
