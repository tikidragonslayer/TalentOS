// src/app/community/forum/new-post/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { useFirestore } from "@/firebase";
import { useUser } from "@/contexts/user-context";
import { collection, serverTimestamp } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import type { ForumPost, UserProfile } from "@/types";

const newPostSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(150, "Title must be 150 characters or less"),
  content: z.string().min(20, "Content must be at least 20 characters").max(5000, "Content must be 5000 characters or less"),
  category: z.string().min(1, "Please select a category"),
});

type NewPostFormData = z.infer<typeof newPostSchema>;

const FORUM_CATEGORIES = ["Job Search Strategies", "Interview Prep", "Local Events & Networking", "Industry Trends", "Company Reviews (Anonymous)", "General Discussion"];

export default function NewForumPostPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { authUser, profile, isLoading } = useUser();
  const firestore = useFirestore();

  const form = useForm<NewPostFormData>({
    resolver: zodResolver(newPostSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
    },
  });

  useEffect(() => {
    if (!isLoading && !authUser) {
      toast({ title: "Please sign in to create a post.", variant: "destructive" });
      router.push("/login?role=candidate"); // Default to candidate role for forum access
    }
  }, [authUser, isLoading, router, toast]);

  const onSubmit: SubmitHandler<NewPostFormData> = async (data) => {
    if (!firestore || !authUser || !profile) {
      toast({ title: "Authentication error. Cannot create post.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const postsRef = collection(firestore, 'forumPosts');
    const newPost: Omit<ForumPost, 'id'> = {
      ...data,
      authorId: authUser.id,
      authorAnonymizedName: (profile as UserProfile).anonymizedName || 'Anonymous User',
      timestamp: serverTimestamp(),
      repliesCount: 0,
    };

    addDocumentNonBlocking(postsRef, newPost);

    toast({
      title: "Post Created!",
      description: `Your post has been successfully created.`,
    });

    setIsSubmitting(false);
    router.push("/community/forum");
  };

  return (
    <div className="container mx-auto py-8">
      <Button variant="outline" onClick={() => router.push('/community/forum')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Forum
      </Button>

      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-primary">Create New Forum Post</CardTitle>
          <CardDescription>Share your thoughts, ask questions, or start a discussion with the community.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Post Title</FormLabel>
                    <FormControl><Input placeholder="Enter a clear and concise title" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category for your post" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FORUM_CATEGORIES.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Post Content</FormLabel>
                    <FormControl><Textarea placeholder="Write your post content here..." {...field} rows={10} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isSubmitting || !authUser}>
                {isSubmitting ? "Submitting..." : (<><Send className="mr-2 h-4 w-4" /> Publish Post</>)}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
