// src/app/messages/[chatId]/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/contexts/user-context';
import type { Conversation, Message, RevealRequest, Offer } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, ShieldQuestion, Info, User, Briefcase, Lock, Unlock, Loader2, Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTierInfo, getUpgradeCost, MAX_TIER } from '@/lib/reveal-tiers';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { RevealRequestModal } from '@/components/modals/reveal-request-modal';
import { requestRevealAction, approveRevealAction, rejectRevealAction } from '@/app/actions/reveal-actions';
import { sendMessageAction } from '@/app/actions/message-actions';
import { withdrawOfferAction } from '@/app/actions/offer-actions';
import { SendOfferModal } from '@/components/employer/send-offer-modal';
import { OfferBanner } from '@/components/candidate/offer-banner';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { authUser, role, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();
  const chatId = params.chatId as string;
  const firestore = useFirestore();

  const chatRef = useMemoFirebase(() => {
    if (!firestore || !chatId) return null;
    return doc(firestore, 'conversations', chatId);
  }, [firestore, chatId]);

  const { data: chat, isLoading: isChatLoading } = useDoc<Conversation>(chatRef);

  const messagesQuery = useMemoFirebase(() => {
    if (!chatRef) return null;
    return query(collection(chatRef, 'messages'), orderBy('timestamp', 'asc'));
  }, [chatRef]);

  const { data: messages, isLoading: areMessagesLoading } = useCollection<Message>(messagesQuery);

  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [isRevealModalOpen, setIsRevealModalOpen] = useState(false);
  const [isProcessingReveal, setIsProcessingReveal] = useState(false);

  // Query for active reveal requests
  const requestsQuery = useMemoFirebase(() => {
    if (!chatId || !firestore) return null;
    return query(
      collection(firestore, 'revealRequests'),
      where('conversationId', '==', chatId),
      where('status', '==', 'pending')
    );
  }, [chatId, firestore]);

  const { data: revealRequests } = useCollection<RevealRequest>(requestsQuery);

  const pendingRequest = revealRequests && revealRequests.length > 0 ? revealRequests[0] : null;
  const isIncomingRequest = pendingRequest && pendingRequest.requesterId !== authUser?.id;
  const isOutgoingRequest = pendingRequest && pendingRequest.requesterId === authUser?.id;

  // Query for offers in this conversation (participantIds filter satisfies Firestore rules)
  const offersQuery = useMemoFirebase(() => {
    if (!chatId || !firestore || !authUser?.id) return null;
    return query(
      collection(firestore, 'offers'),
      where('conversationId', '==', chatId),
      where('participantIds', 'array-contains', authUser.id),
    );
  }, [chatId, firestore, authUser?.id]);

  const { data: offers } = useCollection<Offer>(offersQuery);
  const pendingOffer = offers?.find(o => o.status === 'pending') || null;
  const acceptedOffer = offers?.find(o => o.status === 'accepted') || null;

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);

  const getIdToken = async () => {
    const firebaseAuth = getAuth();
    const token = await firebaseAuth.currentUser?.getIdToken();
    if (!token) throw new Error('Not authenticated');
    return token;
  };

  const handleRequestReveal = async () => {
    if (!authUser || !chat) return;
    setIsProcessingReveal(true);
    try {
      const idToken = await getIdToken();
      const result = await requestRevealAction(idToken, chat.id, chat.currentMessagingTier + 1);

      if (result.success) {
        setIsRevealModalOpen(false);
        toast({ title: "Request Sent", description: "Waiting for the other party to approve." });
      } else {
        toast({ variant: "destructive", title: "Request Failed", description: result.message || result.error });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
    setIsProcessingReveal(false);
  };

  const handleApproveReveal = async () => {
    if (!pendingRequest || !authUser) return;
    setIsProcessingReveal(true);
    try {
      const idToken = await getIdToken();
      const result = await approveRevealAction(idToken, pendingRequest.id);

      if (result.success) {
        toast({ title: "Reveal Approved!", description: "Tier upgraded successfully." });
      } else {
        toast({ variant: "destructive", title: "Approval Failed", description: result.error });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
    setIsProcessingReveal(false);
  };

  const handleRejectReveal = async () => {
    if (!pendingRequest) return;
    setIsProcessingReveal(true);
    try {
      const idToken = await getIdToken();
      const result = await rejectRevealAction(idToken, pendingRequest.id);
      if (result.success) {
        toast({ title: "Request Rejected" });
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
    setIsProcessingReveal(false);
  };

  const handleWithdrawOffer = async () => {
    if (!pendingOffer) return;
    try {
      const idToken = await getIdToken();
      const result = await withdrawOfferAction(idToken, pendingOffer.id);
      if (result.success) {
        toast({ title: 'Offer Withdrawn', description: 'Your offer has been withdrawn.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages?.length]);


  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !chat || !authUser || isSending) return;

    const messageContent = newMessage.trim();
    setNewMessage(''); // Optimistic clear
    setIsSending(true);

    try {
      const firebaseAuth = getAuth();
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      if (!idToken) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please sign in again.' });
        setNewMessage(messageContent); // Restore on failure
        return;
      }

      const result = await sendMessageAction(idToken, chat.id, messageContent);
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Send Failed', description: result.error });
        setNewMessage(messageContent); // Restore on failure
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Send Failed', description: error.message || 'Could not send message' });
      setNewMessage(messageContent); // Restore on failure
    } finally {
      setIsSending(false);
    }
  };

  const isLoading = isUserLoading || isChatLoading || areMessagesLoading;

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin mr-2" /> <p>Loading chat...</p></div>;
  }

  if (!chat) {
    return <div className="flex h-screen items-center justify-center"><p>Chat not found or you do not have access.</p></div>
  }

  const otherPartyAnonymizedName = role === 'candidate'
    ? chat.jobPostingSnapshot?.anonymizedCompanyName
    : chat.candidateProfileSnapshot?.anonymizedName;

  const getTimestamp = (timestamp: any) => {
    if (!timestamp) return "";
    if (timestamp?.toDate) {
      return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return "sending...";
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-muted/20">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center p-4 border-b bg-background">
          <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10 mr-4">
            <AvatarImage src={`https://picsum.photos/seed/${chat.jobId}/100`} data-ai-hint="office user abstract" />
            <AvatarFallback>{otherPartyAnonymizedName?.substring(0, 1) || '?'}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-lg">{otherPartyAnonymizedName}</h2>
            <p className="text-sm text-muted-foreground">Regarding: {chat.jobPostingSnapshot?.title}</p>
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-6">
            {messages?.map(message => {
              // System messages (offers, etc.)
              if (message.senderId === 'system') {
                return (
                  <div key={message.id} className="flex justify-center">
                    <div className="max-w-sm md:max-w-md rounded-lg p-3 text-xs text-center bg-muted/50 border border-dashed text-muted-foreground">
                      <p>{message.content}</p>
                      <p className="text-xs mt-1 opacity-70">{getTimestamp(message.timestamp)}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-end gap-2",
                    message.senderId === authUser?.id ? "justify-end" : "justify-start"
                  )}
                >
                  {message.senderId !== authUser?.id && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`https://picsum.photos/seed/${chat.jobId}/100`} />
                      <AvatarFallback>{otherPartyAnonymizedName?.substring(0, 1)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-xs md:max-w-md lg:max-w-lg rounded-xl p-3 text-sm break-words",
                      message.senderId === authUser?.id
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-background text-foreground rounded-bl-none border"
                    )}
                  >
                    <p>{message.content}</p>
                    <p className={cn("text-xs mt-2 text-right", message.senderId === authUser?.id ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
                      {getTimestamp(message.timestamp)}
                    </p>
                  </div>
                  {message.senderId === authUser?.id && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={authUser?.id ? `https://picsum.photos/seed/${authUser.id}/100` : ''} data-ai-hint="abstract user" />
                      <AvatarFallback>You</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Offer Banner — shown to candidates when there's a pending offer */}
        {pendingOffer && role === 'candidate' && (
          <OfferBanner offer={pendingOffer} jobTitle={chat.jobPostingSnapshot?.title || 'Position'} />
        )}

        {/* Accepted offer notice */}
        {acceptedOffer && (
          <div className="mx-4 mb-2 p-3 rounded-lg border border-green-500/30 bg-green-500/10 text-center text-sm font-medium text-green-600">
            Offer accepted! A Commitment Agreement is in place for this position.
          </div>
        )}

        {/* Employer pending offer notice */}
        {pendingOffer && role === 'employer' && (
          <div className="mx-4 mb-2 p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between">
            <span className="text-sm font-medium text-primary">Offer pending candidate response...</span>
            <Button variant="outline" size="sm" className="text-red-500 border-red-500/50 hover:bg-red-500/10" onClick={handleWithdrawOffer}>
              Withdraw Offer
            </Button>
          </div>
        )}

        {/* Input */}
        <footer className="p-4 border-t bg-background">
          <div className="relative">
            <Textarea
              placeholder="Type your message here..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={2}
              className="pr-20 min-h-[50px]"
            />
            <Button
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </footer>
      </div>

      {/* Sidebar */}
      <aside className="w-80 hidden lg:flex flex-col border-l bg-background">
        <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center"><Info className="mr-2" />Conversation Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            <div>
              <h4 className="font-semibold flex items-center"><Briefcase className="mr-2 h-4 w-4" />Job</h4>
              <p className="text-sm text-muted-foreground">{chat.jobPostingSnapshot?.title}</p>
              <p className="text-xs text-muted-foreground">{chat.jobPostingSnapshot?.location}</p>
            </div>
            <div>
              <h4 className="font-semibold flex items-center"><User className="mr-2 h-4 w-4" />
                {role === 'candidate' ? 'Hiring Company' : 'Candidate'}
              </h4>
              <p className="text-sm text-muted-foreground">{otherPartyAnonymizedName}</p>
            </div>
            <div>
              <h4 className="font-semibold flex items-center"><ShieldQuestion className="mr-2 h-4 w-4" />Current Reveal Tier</h4>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-bold text-primary">{chat.currentMessagingTier}</p>
                <span className="text-sm font-semibold text-primary/80">{getTierInfo(chat.currentMessagingTier).name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{getTierInfo(chat.currentMessagingTier).description}</p>
              <ul className="mt-2 space-y-1">
                {getTierInfo(chat.currentMessagingTier).reveals.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-center">
                    <Unlock className="h-3 w-3 mr-1.5 text-green-500 shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-2 border-t pt-4">
            {isIncomingRequest ? (
              <div className="w-full space-y-2 bg-primary/10 p-3 rounded-lg border border-primary/20">
                <p className="text-sm font-semibold text-primary flex items-center justify-center animate-pulse">
                  <Unlock className="mr-2 h-4 w-4" /> Request Incoming!
                </p>
                <p className="text-xs text-center text-muted-foreground">
                  They want to upgrade to {getTierInfo(pendingRequest.targetTier).name} (Tier {pendingRequest.targetTier}).
                  {getUpgradeCost(chat.currentMessagingTier) > 0 && (
                    <span className="block mt-1 font-medium">Cost: {getUpgradeCost(chat.currentMessagingTier)} OS Credit{getUpgradeCost(chat.currentMessagingTier) !== 1 ? 's' : ''}</span>
                  )}
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" size="sm" onClick={handleApproveReveal} disabled={isProcessingReveal}>
                    Accept
                  </Button>
                  <Button variant="outline" className="flex-1" size="sm" onClick={handleRejectReveal} disabled={isProcessingReveal}>
                    Deny
                  </Button>
                </div>
              </div>
            ) : isOutgoingRequest ? (
              <div className="w-full p-3 rounded-lg border border-dashed text-center">
                <p className="text-sm font-medium text-muted-foreground">Request Pending...</p>
                <Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground" onClick={handleRejectReveal}>Cancel Request</Button>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold">Manage Reveal Level</p>
                <p className="text-xs text-muted-foreground text-center pb-2">Both parties must agree to increase the reveal tier.</p>
                {chat.currentMessagingTier < MAX_TIER ? (
                  <Button className="w-full"
                    onClick={() => setIsRevealModalOpen(true)}
                  >
                    <Unlock className="mr-2" /> Upgrade to {getTierInfo(chat.currentMessagingTier + 1).name}
                    {getUpgradeCost(chat.currentMessagingTier) > 0 && (
                      <span className="ml-1 text-xs opacity-80">({getUpgradeCost(chat.currentMessagingTier)} cr)</span>
                    )}
                  </Button>
                ) : (
                  <p className="text-xs text-center text-green-600 font-medium py-2">Maximum reveal tier reached.</p>
                )}
              </>
            )}

            {!pendingRequest && (
              <Button variant="destructive" className="w-full" disabled={chat.currentMessagingTier <= 1} onClick={() => toast({ title: "Feature coming soon!" })}>
                <Lock className="mr-2" /> Request to Decrease Tier
              </Button>
            )}

            {/* Send Offer button — employer only, no pending or accepted offer */}
            {role === 'employer' && !pendingOffer && !acceptedOffer && (
              <>
                <div className="w-full border-t my-2" />
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setIsOfferModalOpen(true)}
                >
                  <Handshake className="mr-2 h-4 w-4" /> Send Offer
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </aside>
      <RevealRequestModal
        isOpen={isRevealModalOpen}
        onClose={() => setIsRevealModalOpen(false)}
        onRequest={handleRequestReveal}
        currentTier={chat?.currentMessagingTier || 1}
        isProcessing={isProcessingReveal}
      />
      {role === 'employer' && (
        <SendOfferModal
          isOpen={isOfferModalOpen}
          onClose={() => setIsOfferModalOpen(false)}
          conversationId={chatId}
          jobId={chat.jobId}
          jobTitle={chat.jobPostingSnapshot?.title || 'Position'}
          candidateName={chat.candidateProfileSnapshot?.anonymizedName || 'Candidate'}
          defaultBonusAmount={chat.jobPostingSnapshot?.bonusAmount || 100}
        />
      )}
    </div>
  );
}
