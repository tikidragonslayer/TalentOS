// src/app/blog/[slug]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { blogPosts, BlogPost } from '@/app/blog/posts';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export default function BlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Post Not Found</h1>
        <p className="text-muted-foreground mb-6">The blog post you&apos;re looking for doesn&apos;t exist.</p>
        <Button onClick={() => router.push('/blog')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Blog
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl px-4">
      <Button variant="outline" onClick={() => router.push('/blog')} className="mb-8">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Posts
      </Button>

      <article className="prose lg:prose-xl max-w-none">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">{post.title}</h1>
          <div className="flex items-center text-sm text-muted-foreground">
            <span>By {post.author}</span>
            <span className="mx-2">&bull;</span>
            <span>{new Date(post.date).toLocaleDateString()}</span>
          </div>
        </div>

        {post.imageUrl && (
          <div className="relative w-full h-64 md:h-96 mb-8 rounded-lg overflow-hidden">
            <Image
              src={post.imageUrl}
              alt={post.title}
              fill
              className="object-cover"
              data-ai-hint={post.imageAiHint}
            />
          </div>
        )}

        {post.content}
      </article>
    </div>
  );
}
