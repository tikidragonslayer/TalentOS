// src/app/community/forum/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircleQuestion, Search, PlusCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ForumPost } from "@/types";
import { useState, useMemo } from "react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { useUser } from "@/contexts/user-context";
import { collection, query, orderBy } from "firebase/firestore";

export default function CommunityForumPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");
  const firestore = useFirestore();

  const postsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "forumPosts"), orderBy("timestamp", "desc"));
  }, [firestore]);

  const { data: posts, isLoading } = useCollection<ForumPost>(postsQuery);

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    return posts
      .filter(post => selectedCategory === "all" || post.category === selectedCategory)
      .filter(post => post.title.toLowerCase().includes(searchTerm.toLowerCase()) || post.content.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [posts, selectedCategory, searchTerm]);

  const categories = useMemo(() => {
    if (!posts) return ["all"];
    return ["all", ...new Set(posts.map(p => p.category))];
  }, [posts]);

  const getTimestamp = (timestamp: any) => {
    if (!timestamp) return "";
    if (timestamp.toDate) { // It's a Firestore Timestamp
      return timestamp.toDate().toLocaleDateString();
    }
    return new Date(timestamp).toLocaleDateString();
  }


  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-3xl font-bold text-primary flex items-center">
            <MessageCircleQuestion className="mr-3 h-8 w-8" /> Community Forum
          </h1>
          <p className="text-muted-foreground">
            Connect, share, and learn with your local professional community.
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link href="/community/forum/new-post">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Post
          </Link>
        </Button>
      </div>

      <Card className="mb-8 shadow-md">
        <CardContent className="p-4 md:p-6 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-grow w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search forum posts..."
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category === "all" ? "All Categories" : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && filteredPosts.length === 0 && (
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle>No Posts Found</CardTitle>
            <CardDescription>
              Try adjusting your search or filter, or be the first to create a post!
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="space-y-6">
        {filteredPosts.map((post) => (
          <Card key={post.id} className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <Link href={`/community/forum/${post.id}`} className="hover:underline">
                <CardTitle className="text-xl font-semibold text-primary">{post.title}</CardTitle>
              </Link>
              <CardDescription className="text-xs text-muted-foreground">
                Posted by {post.authorAnonymizedName} &bull; {getTimestamp(post.timestamp)} &bull; Category: {post.category}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/80 line-clamp-3">{post.content}</p>
            </CardContent>
            <CardContent className="pt-0">
              <Link href={`/community/forum/${post.id}`} className="text-sm">
                <Button variant="link" className="p-0 h-auto text-primary">
                  View Post & Replies ({post.repliesCount || 0})
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
