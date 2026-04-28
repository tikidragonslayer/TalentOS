// src/app/blog/page.tsx
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { blogPosts, BlogPost } from '@/app/blog/posts';
import { BookOpen } from 'lucide-react';
import Image from 'next/image';

export default function BlogPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-primary flex items-center justify-center">
          <BookOpen className="mr-3 h-10 w-10" /> The TalentOS Blog
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Insights on strategic hiring, career management, and the new economics of talent.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {blogPosts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} passHref>
            <Card className="flex flex-col h-full shadow-lg hover:shadow-2xl transition-shadow duration-300 cursor-pointer">
              <CardHeader className="p-0">
                <div className="relative w-full h-48">
                  <Image
                    src={post.imageUrl}
                    alt={post.title}
                    fill
                    className="object-cover rounded-t-lg"
                    data-ai-hint={post.imageAiHint}
                  />
                </div>
              </CardHeader>
              <div className="p-6 flex flex-col flex-grow">
                <CardTitle className="text-xl font-semibold text-primary leading-tight mb-2">{post.title}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground flex-grow">
                  {post.summary}
                </CardDescription>
                <div className="mt-4 text-xs text-muted-foreground">
                  <span>{new Date(post.date).toLocaleDateString()}</span>
                  <span className="mx-2">&bull;</span>
                  <span>{post.author}</span>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
