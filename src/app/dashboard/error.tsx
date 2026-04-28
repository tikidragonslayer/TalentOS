'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an analytics service
        console.error('Dashboard Error:', error);
    }, [error]);

    return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
            <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Something went wrong!</h2>
            <p className="max-w-[500px] text-muted-foreground font-mono text-xs bg-slate-900 p-4 rounded text-left overflow-auto">
                {error.message}
                {error.digest && <br /> && <span className="text-slate-500">Digest: {error.digest}</span>}
            </p>
            <div className="flex gap-2">
                <Button onClick={() => window.location.href = '/'}>
                    Go Home
                </Button>
                <Button onClick={() => reset()} variant="outline">
                    Try again
                </Button>
            </div>
        </div>
    );
}
