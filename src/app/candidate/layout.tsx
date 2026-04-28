// src/app/candidate/layout.tsx
'use client'

import { useUser } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && role && role !== 'candidate') {
      router.push('/dashboard'); // Or some other appropriate page
    }
  }, [role, isLoading, router]);

  if (isLoading || (role && role !== 'candidate')) {
    return <div className="flex h-screen items-center justify-center"><p>Loading...</p></div>;
  }
  
  return <>{children}</>;
}
