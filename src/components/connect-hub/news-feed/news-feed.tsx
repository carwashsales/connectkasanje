'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { CreatePost } from "@/components/connect-hub/news-feed/create-post";
import { PostCard } from "@/components/connect-hub/news-feed/post-card";
import { AdBanner } from "@/components/connect-hub/shared/ad-banner";
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import supabase from '@/supabase/client';
import type { Post, UserProfile as User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Newspaper } from 'lucide-react';
import { useSupabaseRealtime } from '@/lib/use-supabase-realtime';

function PostSkeleton() {
  return (
    <div className="p-4 rounded-lg border bg-card space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-5/6 rounded" />
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-8 w-20 rounded" />
        <Skeleton className="h-8 w-20 rounded" />
        <Skeleton className="h-8 w-20 rounded" />
      </div>
    </div>
  )
}

export function NewsFeed() {
  const { user: authUser } = useUser();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      if (!authUser) { setCurrentUser(null); return; }
      try {
        const { data, error } = await supabase.from('profiles').select('id, username, full_name, avatar_url, bio, metadata').eq('id', (authUser as any).id ?? (authUser as any).uid).single();
        if (error) throw error;
        if (!mounted) return;
        const mapped: User = {
          id: data.id,
          uid: data.id,
          name: data.full_name ?? data.username ?? '',
          email: data.metadata?.email,
          avatar: { url: data.avatar_url ?? '', hint: '' },
          bio: data.bio ?? ''
        };
        setCurrentUser(mapped);
      } catch (err) {
        console.error('Failed to load current user profile', err);
        setCurrentUser(null);
      }
    }
    loadProfile();
    return () => { mounted = false; };
  }, [authUser]);

  useEffect(() => {
    let mounted = true;
    async function loadPosts() {
      setLoadingPosts(true);
      try {
        const { data, error } = await supabase.from('posts').select('id, user_id, body, title, media, metadata, created_at').order('created_at', { ascending: false }).eq('visibility', 'public');
        if (error) throw error;
        if (!mounted) return;
        const mapped: Post[] = (data || []).map((p: any) => ({
          id: p.id,
          authorId: p.user_id,
          content: p.body ?? p.title ?? '',
          image: p.media ? { url: p.media.url, hint: p.media.path } : undefined,
          createdAt: { toDate: () => new Date(p.created_at) } as any,
          likes: p.metadata?.likes ?? 0,
          likedBy: p.metadata?.likedBy ?? [],
          comments: p.metadata?.comments ?? 0,
        }));
        setPosts(mapped);
      } catch (err) {
        console.error('Failed to load posts', err);
        setPosts([]);
      } finally {
        if (mounted) setLoadingPosts(false);
      }
    }
    loadPosts();
    return () => { mounted = false; };
  }, []);

  // Realtime subscription to posts
  useSupabaseRealtime('posts', (payload) => {
    const ev = payload.eventType || payload.event;
    const record = payload.record;
    if (!record) return;
    setPosts((prev) => {
      const current = prev || [];
      if (ev === 'INSERT') {
        const p: Post = {
          id: record.id,
          authorId: record.user_id,
          content: record.body ?? record.title ?? '',
          image: record.media ? { url: record.media.url, hint: record.media.path } : undefined,
          createdAt: { toDate: () => new Date(record.created_at) } as any,
          likes: record.metadata?.likes ?? 0,
          likedBy: record.metadata?.likedBy ?? [],
          comments: record.metadata?.comments ?? 0,
        };
        return [p, ...current];
      }
      if (ev === 'UPDATE') {
        return current.map((x) => x.id === record.id ? { ...x, content: record.body ?? record.title ?? '', likes: record.metadata?.likes ?? x.likes } : x);
      }
      if (ev === 'DELETE') {
        return current.filter((x) => x.id !== record.id);
      }
      return current;
    });
  });

  return (
    <div className="space-y-8">
      {currentUser && <CreatePost user={currentUser} />}
      <div className="space-y-6">
        {loadingPosts ? (
           Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
        ) : (
          posts?.map((post, index) => (
            <React.Fragment key={post.id}>
              {index === 2 && <AdBanner id="news-feed-ad" />}
              <PostCard post={post} />
            </React.Fragment>
          ))
        )}
         {!loadingPosts && posts?.length === 0 && (
            <div className="text-center py-20">
              <Newspaper className="mx-auto h-16 w-16 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">The News Feed is Quiet</h3>
              <p className="mt-2 text-sm text-muted-foreground">There are no posts yet. Why not be the first to share something?</p>
            </div>
          )}
      </div>
    </div>
  );
}
