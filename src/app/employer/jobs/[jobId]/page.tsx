// src/app/employer/jobs/[jobId]/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Wrapper page for /employer/jobs/[jobId].
 * Redirects to the applicants sub-page since that is the primary employer view for a specific job.
 */
export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;

  useEffect(() => {
    if (jobId) {
      router.replace(`/employer/jobs/${jobId}/applicants`);
    }
  }, [jobId, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin mr-2" />
      <p>Redirecting...</p>
    </div>
  );
}
