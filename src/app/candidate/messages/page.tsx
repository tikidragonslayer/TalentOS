// src/app/candidate/messages/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useUser } from "@/contexts/user-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareDashed, MessageCircle, Users, Info, Loader2 } from "lucide-react";
import type { Conversation } from "@/types";
import { collection, query, where, orderBy } from "firebase/firestore";

export default function CandidateMessagesPage() {
  const { authUser, isLoading: isUserLoading, setRole } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const chatsQuery = useMemoFirebase(() => {
    if (!firestore || !authUser?.id) return null;
    return query(
      collection(firestore, 'conversations'),
      where('participantIds', 'array-contains', authUser.id),
      orderBy('lastMessage.timestamp', 'desc')
    );
  }, [firestore, authUser?.id]);

  const { data: activeChats, isLoading: areChatsLoading } = useCollection<Conversation>(chatsQuery);

  useEffect(() => {
    if (!isUserLoading && authUser) {
      setRole("candidate");
    } else if (!isUserLoading && !authUser) {
      router.push('/login?role=candidate');
    }
  }, [authUser, isUserLoading, router, setRole]);

  const isLoading = isUserLoading || areChatsLoading;

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /> <p>Loading messages...</p></div>;
  }

  const getTimestamp = (timestamp: any) => {
    if (!timestamp) return "";
    if (timestamp.toDate) { // It's a Firestore Timestamp
      return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="w-full mx-auto shadow-lg">
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <CardTitle className="text-2xl font-bold text-primary flex items-center">
                <MessageCircle className="mr-2 h-7 w-7" /> Your Conversations
              </CardTitle>
              <CardDescription>
                Communicate with potential employers securely and anonymously.
              </CardDescription>
            </div>
            <Button className="mt-3 sm:mt-0" onClick={() => router.push('/candidate/matches')}>
              View Job Matches
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {activeChats && activeChats.length === 0 ? (
            <div className="p-10 text-center">
              <MessageSquareDashed className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-2">No active conversations yet.</p>
              <p className="text-sm text-muted-foreground">
                When an employer shows interest in your profile for a match, a conversation will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {activeChats?.map(chat => (
                <li key={chat.id} className="p-4 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => router.push(`/messages/${chat.id}`)}>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={`https://picsum.photos/seed/${chat.jobId}/100`} alt="Employer" data-ai-hint="office building abstract" />
                      <AvatarFallback><Users className="h-6 w-6" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-grow overflow-hidden">
                      <h3 className="font-semibold text-primary truncate">
                        {chat.jobPostingSnapshot?.anonymizedCompanyName || `Conversation for ${chat.jobPostingSnapshot?.title || 'a job'}`}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {chat.lastMessage?.content || "No messages yet."}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {getTimestamp(chat.lastMessage?.timestamp)}
                      </p>
                      <span className="text-xs px-2 py-0.5 bg-accent text-accent-foreground rounded-full mt-1 inline-block">
                        Reveal Tier {chat.currentMessagingTier}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        {activeChats && activeChats.length > 0 && (
          <CardFooter className="border-t p-4 bg-secondary/50">
            <div className="flex items-start text-xs text-muted-foreground">
              <Info className="h-4 w-4 mr-2 mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">Understanding Reveal Tiers in Messaging:</p>
                <ul className="list-disc list-inside pl-1">
                  <li>Each conversation starts at a base anonymity level.</li>
                  <li>As you and the employer mutually decide to proceed, you can move to higher tiers, revealing more information.</li>
                  <li>Small engagement fees may apply to progress to higher tiers to ensure all interactions are meaningful.</li>
                </ul>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
