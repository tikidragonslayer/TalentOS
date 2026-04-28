"use client";

import { useUser } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { authUser, isLoading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !authUser) {
            router.push('/login');
        }
    }, [isLoading, authUser, router]);

    if (isLoading) {
        return <div className="h-screen w-full flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    // Admin allowlist is env-driven. Set NEXT_PUBLIC_TALENTOS_ADMIN_EMAILS
    // to a comma-separated list (e.g. "alice@example.com,bob@example.com").
    // Empty by default, which means the admin route is locked out until
    // an operator opts in. This is intentional for self-hosted deployments.
    const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_TALENTOS_ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    const isAdmin = !!authUser?.email && ADMIN_EMAILS.includes(authUser.email.toLowerCase());
    if (!isAdmin) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center gap-4 text-center p-4">
                <ShieldAlert className="h-16 w-16 text-destructive" />
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground">You do not have permission to view the God Mode dashboard.</p>
                <Button onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur top-0 z-50 sticky px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldAlert className="text-red-500 h-5 w-5" />
                    <span className="font-bold text-lg tracking-wider font-mono text-red-500">GOD MODE</span>
                </div>
                <div className="text-xs font-mono text-slate-500">
                    TalentOS Systems Administration
                </div>
            </nav>
            <main className="p-6">
                {children}
            </main>
        </div>
    );
}
