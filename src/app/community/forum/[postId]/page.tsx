// src/app/community/forum/[postId]/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, MessageSquare, Loader2 } from "lucide-react";
import type { ForumPost, ForumReply, UserProfile } from "@/types";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirestore, useDoc, useCollection, useMemoFirebase } from "@/firebase";
import { useUser } from "@/contexts/user-context";
import { doc, collection, query, orderBy, serverTimestamp, runTransaction } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

export default function ForumPostPage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { authUser, profile } = useUser();
  const { toast } = useToast();
  const postId = params.postId as string;
  const [newReply, setNewReply] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const postRef = useMemoFirebase(() => {
    if (!firestore || !postId) return null;
    return doc(firestore, 'forumPosts', postId);
  }, [firestore, postId]);

  const { data: post, isLoading: isPostLoading } = useDoc<ForumPost>(postRef);

  const repliesQuery = useMemoFirebase(() => {
    if (!postRef) return null;
    return query(collection(postRef, 'replies'), orderBy('timestamp', 'asc'));
  }, [postRef]);

  const { data: replies, isLoading: areRepliesLoading } = useCollection<ForumReply>(repliesQuery);

  const getTimestamp = (timestamp: any) => {
    if (!timestamp) return "";
    if (timestamp.toDate) { // It's a Firestore Timestamp
      return timestamp.toDate().toLocaleString();
    }
    return new Date(timestamp).toLocaleString();
  }

  const handleReplySubmit = async () => {
    if (!newReply.trim() || !postRef || !firestore || !authUser || !profile) {
      toast({ title: "You must be logged in to reply.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const repliesColRef = collection(postRef, 'replies');
    const newReplyData: Omit<ForumReply, 'id' | 'postId'> = {
      content: newReply,
      authorId: authUser.id,
      authorAnonymizedName: (profile as UserProfile).anonymizedName || "Anonymous",
      timestamp: serverTimestamp(),
    };

    try {
      await runTransaction(firestore, async (transaction) => {
        // Add the new reply
        const newReplyRef = doc(collection(firestore, 'forumPosts', postId, 'replies'));
        transaction.set(newReplyRef, newReplyData);

        // Update the repliesCount on the parent post
        const postDoc = await transaction.get(postRef);
        const currentRepliesCount = postDoc.data()?.repliesCount || 0;
        transaction.update(postRef, { repliesCount: currentRepliesCount + 1 });
      });

      setNewReply("");
      toast({ title: "Reply posted!" });
    } catch (e) {
      console.error("Error posting reply:", e);
      toast({ title: "Error", description: "Could not post reply.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isPostLoading || areRepliesLoading;

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading post...</p></div>;
  }

  if (!post) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Post Not Found</h1>
        <p className="text-muted-foreground mb-6">The forum post you're looking for doesn't exist or may have been removed.</p>
        <Button onClick={() => router.push('/community/forum')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forum
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" onClick={() => router.push('/community/forum')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forum
      </Button>

      <Card className="mb-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold text-primary">{post.title}</CardTitle>
          <div className="flex items-center text-xs text-muted-foreground mt-2">
            <Avatar className="h-6 w-6 mr-2">
              <AvatarImage src={`https://picsum.photos/seed/${post.authorAnonymizedName}/40`} alt={post.authorAnonymizedName} data-ai-hint="abstract user" />
              <AvatarFallback>{post.authorAnonymizedName.substring(0, 1)}</AvatarFallback>
            </Avatar>
            <span>Posted by {post.authorAnonymizedName} &bull; {getTimestamp(post.timestamp)} &bull; Category: {post.category}</span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-foreground/90 whitespace-pre-wrap">{post.content}</p>
        </CardContent>
      </Card>

      <h2 className="text-xl font-semibold text-primary mb-4">Replies ({replies?.length || 0})</h2>
      <div className="space-y-6 mb-8">
        {replies && replies.length > 0 ? (
          replies.map(reply => (
            <Card key={reply.id} className="shadow-md bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Avatar className="h-6 w-6 mr-2">
                    <AvatarImage src={`https://picsum.photos/seed/${reply.authorAnonymizedName}/40`} alt={reply.authorAnonymizedName} data-ai-hint="abstract user" />
                    <AvatarFallback>{reply.authorAnonymizedName.substring(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span>{reply.authorAnonymizedName} &bull; {getTimestamp(reply.timestamp)}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{reply.content}</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-muted-foreground">No replies yet. Be the first to respond!</p>
        )}
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-primary flex items-center"><MessageSquare className="mr-2 h-5 w-5" /> Post a Reply</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Write your reply here..."
            value={newReply}
            onChange={(e) => setNewReply(e.target.value)}
            rows={5}
            className="mb-4"
            disabled={!authUser}
          />
          <Button onClick={handleReplySubmit} disabled={!newReply.trim() || isSubmitting || !authUser}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Reply'}
          </Button>
          {!authUser && <p className="text-xs text-muted-foreground mt-2">You must be signed in to post a reply.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
