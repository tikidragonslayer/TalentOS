// src/app/employer/layout.tsx
'use client';

import { useUser } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && role && role !== 'employer') {
      router.push('/dashboard'); // Or some other appropriate page
    }
  }, [role, isLoading, router]);

  if (isLoading || (role && role !== 'employer')) {
    return <div className="flex h-screen items-center justify-center"><p>Loading...</p></div>;
  }
  
  return <>{children}</>;
}
