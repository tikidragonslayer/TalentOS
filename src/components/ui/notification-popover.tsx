"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/contexts/user-context";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, ShieldAlert, Zap } from "lucide-react";
import { collection, query, where, orderBy, limit } from "firebase/firestore";
import type { RevealRequest, MatchScore } from "@/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function NotificationPopover() {
    const { authUser, role } = useUser();
    const firestore = useFirestore();
    const [isOpen, setIsOpen] = useState(false);

    // 1. Query for Pending Reveal Requests (where I am the receiver)
    const revealQuery = useMemoFirebase(() => {
        if (!firestore || !authUser) return null;
        return query(
            collection(firestore, 'revealRequests'),
            where('receiverId', '==', authUser.id),
            where('status', '==', 'pending'),
            orderBy('timestamp', 'desc') // Requires index usually, but maybe fine for small datasets
        );
    }, [firestore, authUser]);

    // 2. Query for Recent Matches (Limit 5)
    // For employers: usually they browse, but maybe we show recent high matches?
    // For candidates: new matches found.
    // For now, let's just listen to matches where user is profile.
    const matchQuery = useMemoFirebase(() => {
        if (!firestore || !authUser || role !== 'candidate') return null;
        return query(
            collection(firestore, 'matchScores'),
            where('userProfileId', '==', authUser.id),
            where('score', '>=', 80), // Only high quality matches
            // orderBy('createdAt', 'desc'), // Might need index
            limit(5)
        );
    }, [firestore, authUser, role]);

    const { data: revealRequests } = useCollection<RevealRequest>(revealQuery);
    const { data: matches } = useCollection<MatchScore>(matchQuery);

    const notificationCount = (revealRequests?.length || 0) + (matches?.length || 0);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {notificationCount > 0 && (
                        <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 overflow-hidden bg-background/95 backdrop-blur border-primary/20" align="end">
                <div className="p-4 border-b border-primary/10">
                    <h4 className="font-semibold text-foreground flex items-center">
                        notifications
                        {notificationCount > 0 && <span className="ml-2 bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">{notificationCount}</span>}
                    </h4>
                </div>
                <div className="flex flex-col max-h-[300px] overflow-y-auto">
                    {notificationCount === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            No new notifications.
                        </div>
                    )}

                    {/* Reveal Requests */}
                    {revealRequests?.map(req => (
                        <Link
                            key={req.id}
                            href={`/messages/${req.conversationId}`}
                            onClick={() => setIsOpen(false)}
                            className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors flex items-start gap-3"
                        >
                            <div className="p-2 bg-purple-500/20 rounded-full mt-1">
                                <ShieldAlert className="h-4 w-4 text-purple-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Reveal Request</p>
                                <p className="text-xs text-slate-400">Someone wants to unlock Tier {req.targetTier} info.</p>
                                <p className="text-[10px] text-slate-500 mt-1">Action Required</p>
                            </div>
                        </Link>
                    ))}

                    {/* Matches */}
                    {matches?.map(match => (
                        <Link
                            key={match.id}
                            href="/candidate/matches"
                            onClick={() => setIsOpen(false)}
                            className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors flex items-start gap-3"
                        >
                            <div className="p-2 bg-emerald-500/20 rounded-full mt-1">
                                <Zap className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">{match.score}% Match Found</p>
                                <p className="text-xs text-slate-400 line-clamp-1">{match.jobPostingSnapshot?.title}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
