// src/app/dashboard/page.tsx
"use client";

import { useEffect, useMemo } from "react";
import { GlassCard, GlassContent, GlassHeader } from "@/components/ui/glass-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Briefcase, Search, MessageSquare, FileText, Globe, Gift, Loader2, Clock, Trophy } from "lucide-react";
import { collection, query, where } from "firebase/firestore";
import type { Conversation, MatchScore, UserProfile, Company, JobPosting } from "@/types";


function DashboardContent() {
  const { authUser, role, isLoading, profile } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  // --- Firestore queries for real stats ---

  // Conversations where user is a participant
  const conversationsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return query(
      collection(firestore, "conversations"),
      where("participantIds", "array-contains", authUser.id)
    );
  }, [firestore, authUser]);
  const { data: conversations } = useCollection<Conversation>(conversationsQuery);

  // Match scores for candidates
  const matchScoresQuery = useMemoFirebase(() => {
    if (!firestore || !authUser || role !== "candidate") return null;
    return query(
      collection(firestore, "matchScores"),
      where("userProfileId", "==", authUser.id)
    );
  }, [firestore, authUser, role]);
  const { data: matchScores } = useCollection<MatchScore>(matchScoresQuery);

  // Job listings for employers
  const companyProfile = role === "employer" ? (profile as Company | null) : null;
  const jobListingsQuery = useMemoFirebase(() => {
    if (!firestore || !companyProfile?.id || role !== "employer") return null;
    return query(
      collection(firestore, "jobListings"),
      where("companyId", "==", companyProfile.id)
    );
  }, [firestore, companyProfile?.id, role]);
  const { data: jobListings } = useCollection<JobPosting>(jobListingsQuery);

  // Match scores for employer's open jobs (applicants)
  const openJobIds = useMemo(() => {
    if (!jobListings) return [];
    return jobListings.filter(j => j.status === "open").map(j => j.id);
  }, [jobListings]);

  // Firestore 'in' queries require a non-empty array with max 30 elements
  const applicantsQuery = useMemoFirebase(() => {
    if (!firestore || role !== "employer" || openJobIds.length === 0) return null;
    const queryIds = openJobIds.slice(0, 30);
    return query(
      collection(firestore, "matchScores"),
      where("jobListingId", "in", queryIds)
    );
  }, [firestore, role, openJobIds]);
  const { data: applicantMatches } = useCollection<MatchScore>(applicantsQuery);

  // Recent conversations for the Activity Overview (sorted client-side since we already have them)
  const recentConversations = useMemo(() => {
    if (!conversations) return [];
    return [...conversations]
      .filter(c => c.lastMessage?.timestamp)
      .sort((a, b) => {
        const tsA = a.lastMessage?.timestamp?.seconds ?? 0;
        const tsB = b.lastMessage?.timestamp?.seconds ?? 0;
        return tsB - tsA;
      })
      .slice(0, 5);
  }, [conversations]);

  // --- Compute stats ---

  const conversationCount = conversations?.length ?? 0;

  // Candidate: profile completion calculation
  const profileCompletion = useMemo(() => {
    if (role !== "candidate" || !profile) return 0;
    const p = profile as UserProfile;
    const fields: boolean[] = [
      !!p.fullName || !!p.anonymizedName,
      !!p.location,
      !!p.locationPreference,
      !!p.experienceSummary || !!p.anonymizedExperienceSummary,
      (p.skills?.length ?? 0) > 0,
      (p.profileTags?.length ?? 0) > 0,
      !!p.mbti,
      !!p.bigFive,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [role, profile]);

  const matchCount = matchScores?.length ?? 0;
  const openJobCount = openJobIds.length;
  const applicantCount = applicantMatches?.length ?? 0;

  // --- Routing / loading ---

  useEffect(() => {
    if (!isLoading && authUser && !profile) {
      router.push("/onboarding");
    }
  }, [isLoading, authUser, profile, router]);

  if (isLoading || !authUser || !role) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /> <p>Loading dashboard...</p></div>;
  }

  if (!profile) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /> <p>Redirecting to onboarding...</p></div>;
  }

  // --- Build stats arrays from real data ---

  const candidateStats = [
    { title: "Active Conversations", value: String(conversationCount), icon: MessageSquare, href: "/candidate/messages" },
    { title: "New Job Matches", value: String(matchCount), icon: Search, href: "/candidate/matches" },
    { title: "Profile Completion", value: `${profileCompletion}%`, icon: User, href: "/candidate/profile" },
  ];

  const employerStats = [
    { title: "Active Conversations", value: String(conversationCount), icon: MessageSquare, href: "/employer/messages" },
    { title: "Active Job Postings", value: String(openJobCount), icon: Briefcase, href: "/employer/jobs" },
    { title: "New Applicants", value: String(applicantCount), icon: User, href: "/employer/jobs" },
  ];

  const stats = role === "candidate" ? candidateStats : employerStats;
  const quickLinks = role === "candidate"
    ? [
      { label: "Update Your Profile", href: "/candidate/profile", icon: User },
      { label: "Take Skill Challenge", href: "/candidate/skill-challenges", icon: Trophy },
      { label: "View Job Matches", href: "/candidate/matches", icon: Search },
      { label: "Check Messages", href: "/candidate/messages", icon: MessageSquare },
      { label: "Browse Public Jobs", href: "/jobs", icon: Globe },
    ]
    : [
      { label: "Manage Company Profile", href: "/employer/profile", icon: Briefcase },
      { label: "View Job Postings", href: "/employer/jobs", icon: FileText },
      { label: "Post a New Job", href: "/employer/jobs/new", icon: FileText },
      { label: "Check Messages", href: "/employer/messages", icon: MessageSquare },
    ];

  const formatTimestamp = (ts: any): string => {
    if (!ts) return "";
    const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">
          Welcome to Your {role === "candidate" ? "Talent" : "Builder"} Dashboard
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your activity on TalentOS.
        </p>
      </div>

      <Card className="mb-8 bg-gradient-to-r from-primary/80 to-accent/80 text-primary-foreground shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><Gift className="mr-2 h-6 w-6" /> Join Our Growth Engine</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            As an early adopter, you are a partner in our success. Invite qualified {role === 'candidate' ? 'talent' : 'companies'} to TalentOS and earn rewards.
          </p>
          <Button variant="secondary" onClick={() => router.push('/settings')}>
            Get Your Referral Link
          </Button>
        </CardContent>
      </Card>


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <GlassCard key={stat.title} variant="neon" className="hover:scale-[1.02] transition-transform">
            <GlassHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b-0">
              <h3 className="text-sm font-medium text-gray-400">{stat.title}</h3>
              <stat.icon className="h-4 w-4 text-primary" />
            </GlassHeader>
            <GlassContent>
              <div className="text-3xl font-bold text-white">{stat.value}</div>
              <Link href={stat.href} className="text-xs text-primary hover:text-primary/80 transition-colors mt-1 block">
                View Details &rarr;
              </Link>
            </GlassContent>
          </GlassCard>
        ))}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Quick Actions</CardTitle>
          <CardDescription>Quickly access important sections of the platform.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map(link => (
            <Button key={link.label} variant="outline" asChild className="justify-start text-left h-auto py-3">
              <Link href={link.href} className="flex items-center gap-3">
                <link.icon className="h-5 w-5 text-accent" />
                <span className="font-medium">{link.label}</span>
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Activity Overview</CardTitle>
          <CardDescription>Recent conversations and updates.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentConversations.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No recent activity yet.</p>
              <p className="text-xs mt-1">Start a conversation or scan for matches to see activity here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentConversations.map((convo) => {
                const messagesHref = role === "candidate" ? `/candidate/messages` : `/employer/messages`;
                const jobTitle = convo.jobPostingSnapshot?.title ?? "Unknown Role";
                const preview = convo.lastMessage?.content
                  ? convo.lastMessage.content.length > 80
                    ? convo.lastMessage.content.slice(0, 80) + "..."
                    : convo.lastMessage.content
                  : "No messages yet";
                return (
                  <Link
                    key={convo.id}
                    href={messagesHref}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <MessageSquare className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{jobTitle}</p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(convo.lastMessage?.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{preview}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


export default function DashboardPage() {
  return <DashboardContent />;
}
