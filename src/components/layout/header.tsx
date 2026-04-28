// src/components/layout/header.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, UserCircle, LogOut, LogIn } from "lucide-react";
import { TalentOSLogo } from "@/components/icons";
import { useUser } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import { NotificationPopover } from "@/components/ui/notification-popover";

const navItems = [
  { label: "Dashboard", href: "/dashboard", roles: ["candidate", "employer"] },
  { label: "My Profile", href: "/candidate/profile", roles: ["candidate"] },
  { label: "Job Matches", href: "/candidate/matches", roles: ["candidate"] },
  { label: "My Jobs", href: "/employer/jobs", roles: ["employer"] },
  { label: "Employer Profile", href: "/employer/profile", roles: ["employer"] },
];

export function AppHeader() {
  const { authUser, role, logout } = useUser();
  const router = useRouter();

  const handleLoginAsCandidate = () => {
    router.push("/login?role=candidate");
  };

  const handleLoginAsEmployer = () => {
    router.push("/login?role=employer");
  };

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const filteredNavItems = navItems.filter(item => authUser && role && item.roles.includes(role));

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <TalentOSLogo />
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            {filteredNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Mobile Nav */}
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="md:hidden">
            <Link href="/" className="mb-6 flex items-center">
              <TalentOSLogo />
            </Link>
            <nav className="flex flex-col gap-4">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="transition-colors hover:text-foreground/80 text-foreground/60"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 items-center justify-end space-x-2">
          {authUser ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                Logged in as: {role}
              </span>
              <NotificationPopover />
              <Button variant="ghost" size="icon" onClick={() => router.push(role === 'candidate' ? '/candidate/profile' : '/employer/profile')}>
                <UserCircle className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={handleLoginAsCandidate}>Login as Candidate</Button>
              <Button variant="outline" onClick={handleLoginAsEmployer}>Login as Employer</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
