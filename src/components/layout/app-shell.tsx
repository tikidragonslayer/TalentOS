// src/components/layout/app-shell.tsx
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { TalentOSLogo } from "@/components/icons";
import { useUser } from "@/contexts/user-context";
import { useUser as useFirebaseUser } from "@/firebase";
import { sendEmailVerification } from "firebase/auth";
import { Home, User, Briefcase, LogOut, LayoutDashboard, UserCog, Search, MessageSquare, Library, MessageCircleQuestion, Settings, Bell, Globe, BookOpen, Zap, Loader2, ShieldCheck, MailWarning } from "lucide-react";
import React, { useEffect, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: ('candidate' | 'employer' | 'guest')[];
  group: 'main' | 'candidate' | 'employer' | 'public';
}

const navItems: NavItem[] = [
  // --- Main (for logged in users) ---
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["candidate", "employer"], group: 'main' },

  // --- Candidate Specific ---
  { href: "/candidate/profile", label: "My Profile", icon: User, roles: ["candidate"], group: 'candidate' },
  { href: "/candidate/matches", label: "Job Matches", icon: Search, roles: ["candidate"], group: 'candidate' },
  { href: "/candidate/messages", label: "Messages", icon: MessageSquare, roles: ["candidate"], group: 'candidate' },
  { href: "/candidate/verify-skills", label: "Verify Skills", icon: ShieldCheck, roles: ["candidate"], group: 'candidate' },

  // --- Employer Specific ---
  { href: "/employer/profile", label: "Company Profile", icon: UserCog, roles: ["employer"], group: 'employer' },
  { href: "/employer/jobs", label: "Manage Jobs", icon: Briefcase, roles: ["employer"], group: 'employer' },
  { href: "/employer/messages", label: "Messages", icon: MessageSquare, roles: ["employer"], group: 'employer' },

  // --- Public / For Everyone ---
  { href: "/", label: "Home", icon: Home, roles: ["guest"], group: 'public' },
  { href: "/jobs", label: "Public Jobs", icon: Globe, roles: ["guest", "candidate", "employer"], group: 'public' },
  { href: "/resources", label: "Local Resources", icon: Library, roles: ["guest", "candidate", "employer"], group: 'public' },
  { href: "/community/forum", label: "Community Forum", icon: MessageCircleQuestion, roles: ["guest", "candidate", "employer"], group: 'public' },
  { href: "/blog", label: "Blog", icon: BookOpen, roles: ["guest", "candidate", "employer"], group: 'public' },

  // --- Universal Settings ---
  { href: "/settings", label: "Settings", icon: Settings, roles: ["candidate", "employer"], group: 'main' },
];


function EmailVerificationBanner() {
  const { user } = useFirebaseUser();
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerified) return null;
  if (user.isAnonymous) return null;
  if (user.providerData.some((p) => p.providerId === 'google.com')) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="mx-auto flex max-w-6xl items-center gap-3 text-sm text-amber-300">
        <MailWarning className="h-4 w-4 shrink-0 text-amber-400" />
        <span>Please verify your email address. Check your inbox for a verification link.</span>
        <button
          className="ml-auto shrink-0 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          disabled={resending || sent}
          onClick={async () => {
            setResending(true);
            try {
              await sendEmailVerification(user);
              setSent(true);
            } catch {
              // silent
            } finally {
              setResending(false);
            }
          }}
        >
          {sent ? 'Sent!' : resending ? 'Sending...' : 'Resend'}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { authUser, role, isLoading, logout } = useUser();
  const router = useRouter();

  useEffect(() => {
    const publicPages = ['/', '/login', '/jobs', '/blog', '/resources', '/community/forum', '/community/forum/new-post', '/privacy', '/terms'];
    const isPublicPage = publicPages.includes(pathname) || pathname.startsWith('/blog/') || pathname.startsWith('/community/forum/');

    if (!isLoading && !authUser && !isPublicPage) {
      router.push('/login');
    }
  }, [authUser, isLoading, router, pathname]);

  // Don't render the shell on the main homepage for guests
  const publicHomepage = ['/'];
  if (!authUser && publicHomepage.includes(pathname)) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /><p className="ml-2">Initializing Platform...</p></div>;
  }

  const handleLogoutClick = async () => {
    await logout();
    router.push('/');
  };

  const currentRole = authUser ? (role || 'guest') : 'guest';

  const getNavItemsForGroup = (group: NavItem['group']) => navItems.filter(item =>
    item.roles.includes(currentRole as 'candidate' | 'employer' | 'guest')
  );

  const mainNav = getNavItemsForGroup('main');
  const candidateNav = getNavItemsForGroup('candidate');
  const employerNav = getNavItemsForGroup('employer');
  const publicNav = getNavItemsForGroup('public');

  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center justify-between">
            <Link href={authUser ? "/dashboard" : "/"} className="inline-block">
              <TalentOSLogo />
            </Link>
            <div className="flex items-center gap-2">
              {authUser && (
                <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
                  <Bell className="h-5 w-5" />
                  <span className="sr-only">Notifications</span>
                </Button>
              )}
              <SidebarTrigger className="md:hidden" />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {authUser && mainNav.length > 0 && (
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <Link href={item.href} passHref legacyBehavior>
                    <SidebarMenuButton
                      isActive={pathname === item.href}
                      tooltip={item.label}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}

          {authUser && role === 'candidate' && candidateNav.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Talent</SidebarGroupLabel>
              <SidebarMenu>
                {candidateNav.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <Link href={item.href} passHref legacyBehavior>
                      <SidebarMenuButton
                        isActive={pathname.startsWith(item.href)}
                        tooltip={item.label}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )}

          {authUser && role === 'employer' && employerNav.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Builder</SidebarGroupLabel>
              <SidebarMenu>
                {employerNav.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <Link href={item.href} passHref legacyBehavior>
                      <SidebarMenuButton
                        isActive={pathname.startsWith(item.href)}
                        tooltip={item.label}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )}

          {publicNav.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Public</SidebarGroupLabel>
              <SidebarMenu>
                {publicNav.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <Link href={item.href} passHref legacyBehavior>
                      <SidebarMenuButton
                        isActive={pathname.startsWith(item.href) && (item.href !== '/' || pathname === '/')}
                        tooltip={item.label}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )}

        </SidebarContent>
        <SidebarFooter className="p-4">
          {authUser ? (
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogoutClick}>
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </Button>
          ) : (
            <Button variant="outline" className="w-full justify-center" onClick={() => router.push('/login')}>
              Login / Sign Up
            </Button>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <EmailVerificationBanner />
        <main className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-[#050505] min-h-screen text-slate-200">
          {children}
        </main>
        <footer className="border-t border-amber-800/30 bg-amber-950/20 px-4 sm:px-6 py-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-[11px] font-semibold text-amber-300 mb-1">IMPORTANT FCRA NOTICE</p>
            <p className="text-[11px] leading-relaxed text-amber-400/80">
              This tool is not a Consumer Reporting Agency as defined by the Fair Credit Reporting Act (FCRA), 15 U.S.C. &sect;1681 et seq. The information provided by this service may not be used as a factor in establishing a consumer&apos;s eligibility for credit, insurance, employment, or any other purpose authorized under the FCRA. You may not use this service to make decisions about consumer credit, employment, insurance, tenant screening, or any other purpose that would require FCRA compliance.
            </p>
          </div>
          <div className="mt-3 text-center text-[11px] text-slate-500 space-x-3">
            <a href="/privacy" className="hover:text-teal-400 transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-teal-400 transition-colors">Terms of Service</a>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
