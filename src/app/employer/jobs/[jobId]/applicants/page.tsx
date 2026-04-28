// src/app/employer/jobs/[jobId]/applicants/page.tsx
"use client";

import { GlassCard, GlassContent, GlassFooter, GlassHeader } from "@/components/ui/glass-card";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/contexts/user-context";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  MessageSquare,
  TrendingUp,
  ShieldCheck,
  Info,
  Loader2,
  ChevronDown,
  ChevronUp,
  Users,
  Sparkles,
} from "lucide-react";
import type { MatchScore, UserProfile, Company } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { employerInitiateConversationAction } from "@/app/actions/conversation-actions";

interface CandidateInfo {
  anonymizedName: string;
  humanityScore?: number;
  mbti?: { personalityType: string } | null;
  skills?: string[];
  profileTags?: string[];
}

export default function ApplicantsPage() {
  const { authUser, profile, isLoading: isUserLoading, setRole } = useUser();
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;
  const firestore = useFirestore();
  const { toast } = useToast();
  const companyProfile = profile as Company | null;

  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [candidateProfiles, setCandidateProfiles] = useState<Record<string, CandidateInfo>>({});
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState<string>("");

  // Query matchScores for this job
  const matchesQuery = useMemoFirebase(() => {
    if (!firestore || !jobId) return null;
    return query(collection(firestore, "matchScores"), where("jobListingId", "==", jobId));
  }, [firestore, jobId]);

  const { data: matches, isLoading: areMatchesLoading } = useCollection<MatchScore>(matchesQuery);

  useEffect(() => {
    if (!isUserLoading && authUser) {
      setRole("employer");
    } else if (!isUserLoading && !authUser) {
      router.push("/login?role=employer");
    }
  }, [authUser, isUserLoading, router, setRole]);

  // Fetch the job title for the header
  useEffect(() => {
    if (!firestore || !jobId) return;
    const fetchJob = async () => {
      try {
        const jobDoc = await getDoc(doc(firestore, "jobListings", jobId));
        if (jobDoc.exists()) {
          setJobTitle(jobDoc.data()?.title || jobDoc.data()?.anonymizedTitle || "Job Posting");
        }
      } catch (e) {
        console.error("Error fetching job:", e);
      }
    };
    fetchJob();
  }, [firestore, jobId]);

  // Fetch candidate profiles for each match
  useEffect(() => {
    if (!firestore || !matches || matches.length === 0) return;

    const fetchProfiles = async () => {
      const profileMap: Record<string, CandidateInfo> = {};
      const uniqueIds = [...new Set(matches.map((m) => m.userProfileId))];

      for (const uid of uniqueIds) {
        if (candidateProfiles[uid]) continue; // Already fetched
        try {
          const userDoc = await getDoc(doc(firestore, "users", uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            profileMap[uid] = {
              anonymizedName: data.anonymizedName || "Anonymous Candidate",
              humanityScore: data.humanityScore,
              mbti: data.mbti,
              skills: data.skills,
              profileTags: data.profileTags,
            };
          } else {
            profileMap[uid] = { anonymizedName: "Anonymous Candidate" };
          }
        } catch {
          profileMap[uid] = { anonymizedName: "Anonymous Candidate" };
        }
      }

      if (Object.keys(profileMap).length > 0) {
        setCandidateProfiles((prev) => ({ ...prev, ...profileMap }));
      }
    };

    fetchProfiles();
  }, [firestore, matches]);

  const handleStartConversation = async (match: MatchScore) => {
    if (!authUser) return;
    setIsConnecting(match.id);

    try {
      const firebaseAuth = getAuth();
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      if (!idToken) {
        toast({ title: "Authentication Error", description: "Please sign in again.", variant: "destructive" });
        return;
      }

      const result = await employerInitiateConversationAction(idToken, match.id);

      if (result.success && result.conversationId) {
        toast({
          title: result.existing ? "Conversation Exists" : "Conversation Started!",
          description: result.existing
            ? "Redirecting to your existing conversation."
            : "A secure channel has been opened with this candidate.",
        });
        router.push(`/messages/${result.conversationId}`);
      } else {
        toast({ title: "Error", description: result.error || "Could not start conversation.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error("Error starting conversation:", e);
      toast({ title: "Error", description: e.message || "Could not start conversation.", variant: "destructive" });
    } finally {
      setIsConnecting(null);
    }
  };

  const toggleExpanded = (matchId: string) => {
    setExpandedMatch((prev) => (prev === matchId ? null : matchId));
  };

  const getScoreColor = (score: number) => {
    if (score > 80) return "text-emerald-300";
    if (score > 60) return "text-yellow-300";
    return "text-red-300";
  };

  const getScoreBg = (score: number) => {
    if (score > 80) return "bg-emerald-500/20 border-emerald-500/50";
    if (score > 60) return "bg-yellow-500/20 border-yellow-500/50";
    return "bg-red-500/20 border-red-500/50";
  };

  const getHumanityBadge = (score: number | undefined) => {
    if (score === undefined) return null;
    if (score >= 80) {
      return (
        <span className="text-emerald-400 flex items-center gap-0.5 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
          <ShieldCheck className="h-3 w-3" /> Verified Human ({score})
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="text-yellow-400 flex items-center gap-0.5 text-[10px] bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">
          <ShieldCheck className="h-3 w-3" /> Moderate ({score})
        </span>
      );
    }
    return (
      <span className="text-red-400 flex items-center gap-0.5 text-[10px] bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
        <ShieldCheck className="h-3 w-3" /> Low ({score})
      </span>
    );
  };

  // Sort matches by score descending
  const sortedMatches = matches ? [...matches].sort((a, b) => b.score - a.score) : [];

  const isLoading = isUserLoading || areMatchesLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> <p>Loading applicants...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="mb-4 text-gray-400 hover:text-white" onClick={() => router.push("/employer/jobs")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Jobs
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Applicants</h1>
            <p className="text-muted-foreground">
              {jobTitle && <span className="text-white font-medium">{jobTitle}</span>}
              {jobTitle && " — "}
              {sortedMatches.length} {sortedMatches.length === 1 ? "candidate" : "candidates"} matched
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">{sortedMatches.length}</span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {sortedMatches.length === 0 && (
        <GlassCard variant="neon" className="text-center py-16 max-w-2xl mx-auto border-dashed border-primary/30">
          <GlassContent className="flex flex-col items-center">
            <Sparkles className="h-12 w-12 text-primary/50 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">No Applicants Yet</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Our AI is actively scanning candidate profiles for this role. Matches will appear here as they are found.
            </p>
            <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => router.push("/employer/jobs")}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Jobs
            </Button>
          </GlassContent>
        </GlassCard>
      )}

      {/* Applicant Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedMatches.map((match) => {
          const candidate = candidateProfiles[match.userProfileId];
          const isExpanded = expandedMatch === match.id;

          return (
            <GlassCard key={match.id} variant="neon" className="flex flex-col">
              <GlassHeader className="pb-4 border-white/10">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white leading-tight">
                      {candidate?.anonymizedName || "Anonymous Candidate"}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {candidate?.mbti && (
                        <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
                          {candidate.mbti.personalityType}
                        </Badge>
                      )}
                      {getHumanityBadge(candidate?.humanityScore)}
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1 px-2 py-1 ${getScoreBg(match.score)} rounded-full text-sm font-bold border ${getScoreColor(match.score)}`}
                  >
                    <TrendingUp className="h-4 w-4" />
                    {match.score}%
                  </div>
                </div>
              </GlassHeader>

              <GlassContent className="flex-grow space-y-4">
                {/* Skills Tags */}
                {candidate?.skills && candidate.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.skills.slice(0, 6).map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-[10px] bg-white/5 border-white/10 text-gray-300">
                        {skill}
                      </Badge>
                    ))}
                    {candidate.skills.length > 6 && (
                      <Badge variant="secondary" className="text-[10px] bg-white/5 border-white/10 text-gray-500">
                        +{candidate.skills.length - 6} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Score Breakdown Bars */}
                {match.breakdown && (
                  <div className="grid grid-cols-2 gap-3 py-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-cyan-300/80 uppercase tracking-wider">
                        <span>Skills</span>
                        <span>{match.breakdown.skills}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" style={{ width: `${match.breakdown.skills}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-purple-300/80 uppercase tracking-wider">
                        <span>Culture</span>
                        <span>{match.breakdown.culture}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" style={{ width: `${match.breakdown.culture}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-emerald-300/80 uppercase tracking-wider">
                        <span>Urgency</span>
                        <span>{match.breakdown.urgency}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${match.breakdown.urgency}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-yellow-300/80 uppercase tracking-wider">
                        <span>Logistics</span>
                        <span>{match.breakdown.logistics}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" style={{ width: `${match.breakdown.logistics}%` }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Expandable AI Justification */}
                <button
                  onClick={() => toggleExpanded(match.id)}
                  className="w-full bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-primary flex items-center">
                      <Info className="h-3 w-3 mr-1" /> AI Match Analysis
                    </h4>
                    {isExpanded ? <ChevronUp className="h-3 w-3 text-gray-400" /> : <ChevronDown className="h-3 w-3 text-gray-400" />}
                  </div>
                  <p className={`text-xs text-gray-400 italic mt-1 ${isExpanded ? "" : "line-clamp-2"}`}>{match.justification}</p>
                </button>

                {/* Profile Tags */}
                {candidate?.profileTags && candidate.profileTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {candidate.profileTags.slice(0, 4).map((tag) => (
                      <span key={tag} className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </GlassContent>

              <GlassFooter className="flex w-full gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-primary text-black hover:bg-primary/90 font-bold"
                  onClick={() => handleStartConversation(match)}
                  disabled={isConnecting === match.id}
                >
                  {isConnecting === match.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="mr-2 h-4 w-4" />
                  )}
                  Start Conversation
                </Button>
              </GlassFooter>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
