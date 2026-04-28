'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building, Briefcase, Zap, Activity, DollarSign, ShieldAlert, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getPlatformStatsAction, type PlatformStats } from '@/app/actions/admin-actions';
import { GlassCard } from "@/components/ui/glass-card";
import { useUser } from "@/contexts/user-context";
import { useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";

export default function AdminDashboardPage() {
    const { authUser, isLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check if user has admin role via roles_admin collection
    const adminDocRef = useMemoFirebase(
        () => (firestore && authUser?.id) ? doc(firestore, 'roles_admin', authUser.id) : null,
        [firestore, authUser?.id]
    );
    const { data: adminDoc, isLoading: isAdminLoading } = useDoc(adminDocRef);

    const isAdmin = !!adminDoc;
    const isCheckingAuth = isAuthLoading || isAdminLoading;

    useEffect(() => {
        if (!isCheckingAuth && !authUser) {
            router.push('/login');
            return;
        }
        if (!isCheckingAuth && authUser && !isAdmin) {
            router.push('/dashboard');
            return;
        }
    }, [isCheckingAuth, authUser, isAdmin, router]);

    useEffect(() => {
        if (!isAdmin) return;
        async function loadStats() {
            const firebaseAuth = getAuth();
            const idToken = await firebaseAuth.currentUser?.getIdToken();
            if (!idToken) return;
            const res = await getPlatformStatsAction(idToken);
            if (res.success && res.data) {
                setStats(res.data);
            }
            setIsLoading(false);
        }
        loadStats();
    }, [isAdmin]);

    if (isCheckingAuth || !isAdmin) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Verifying access...</span>
            </div>
        );
    }

    const StatCard = ({ title, value, icon: Icon, color }: any) => (
        <GlassCard variant="default" className="relative overflow-hidden">
            <div className={`absolute top-0 right-0 p-4 opacity-10 ${color}`}>
                <Icon className="h-24 w-24" />
            </div>
            <div className="relative z-10 p-6">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{title}</h3>
                <div className="mt-2 flex items-baseline gap-2">
                    {isLoading ? (
                        <div className="h-8 w-24 bg-white/10 animate-pulse rounded" />
                    ) : (
                        <span className="text-4xl font-black text-white">{value}</span>
                    )}
                </div>
            </div>
        </GlassCard>
    );

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl font-light text-white mb-2">System Overview</h1>
                <p className="text-slate-400">Real-time metrics from the TalentOS neural network.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Active Candidates" value={stats?.totalCandidates} icon={Users} color="text-blue-500" />
                <StatCard title="Registered Employers" value={stats?.totalEmployers} icon={Building} color="text-purple-500" />
                <StatCard title="Open Job Bounties" value={stats?.activeJobs} icon={Briefcase} color="text-emerald-500" />
                <StatCard title="Total Matches" value={stats?.totalMatches} icon={Zap} color="text-yellow-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center"><Activity className="mr-2 h-5 w-5 text-primary" /> System Health</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                            <span className="text-sm text-slate-300">Firestore Read Ops</span>
                            <span className="text-xs font-mono text-green-400">NORMAL</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                            <span className="text-sm text-slate-300">AI Latency (Avg)</span>
                            <span className="text-xs font-mono text-yellow-400">1.2s</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                            <span className="text-sm text-slate-300">Indexer Status</span>
                            <span className="text-xs font-mono text-green-400">ONLINE</span>
                        </div>
                    </div>
                </GlassCard>

                <GlassCard className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center"><DollarSign className="mr-2 h-5 w-5 text-primary" /> Economy</h3>
                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-emerald-900/20 to-emerald-800/20 border border-emerald-500/20 p-4 rounded-lg">
                            <p className="text-xs text-emerald-400 uppercase font-bold mb-1">Total Value Locked (Credits)</p>
                            <p className="text-3xl font-mono text-white">{stats?.totalCreditsConsumed?.toLocaleString() || '---'}</p>
                        </div>
                        <p className="text-xs text-slate-500 text-center">
                            *Estimated revenue proxy based on credit consumption.
                        </p>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
