'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Post, UserProfile as User } from "@/lib/types";
import { Heart, MessageCircle, Share2, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import supabase from '@/supabase/client';
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import { getUserId } from '@/lib/getUserId';
import { formatDistanceToNow } from 'date-fns';
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";


type PostCardProps = {
  post: Post;
};

function EditPostDialog({ post, isOpen, onOpenChange }: { post: Post; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [content, setContent] = useState(post.content);
    const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      toast({ title: "Error", description: "Post content cannot be empty.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('posts').update({ body: content }).eq('id', post.id);
      if (error) throw error;
      toast({ title: "Success", description: "Post updated successfully." });
      onOpenChange(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update post.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Post</DialogTitle>
                </DialogHeader>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[120px]" />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function PostCard({ post }: PostCardProps) {
  const { user: authUser } = useUser();
  const [author, setAuthor] = useState<User | null>(null);
  
  useEffect(() => {
    let mounted = true;
    async function loadAuthor() {
      if (!post.authorId) return setAuthor(null);
      try {
        const { data, error } = await supabase.from('profiles').select('id, username, full_name, avatar_url, bio, metadata').eq('id', post.authorId).single();
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
        setAuthor(mapped);
      } catch (err) {
        console.error('Failed to load author', err);
        setAuthor(null);
      }
    }
    loadAuthor();
    return () => { mounted = false; };
  }, [post.authorId]);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  const { toast } = useToast();

  const isAuthor = useMemo(() => authUser && ((authUser as any).id ?? (authUser as any).uid) === post.authorId, [authUser, post.authorId]);

  const createdDate = (post.createdAt && typeof post.createdAt === 'string') ? new Date(post.createdAt) : (post.createdAt && (post.createdAt as any).toDate ? (post.createdAt as any).toDate() : (post.createdAt as unknown as Date | undefined));
  const date = createdDate ? formatDistanceToNow(createdDate, { addSuffix: true }) : 'Just now';

  const [localLikes, setLocalLikes] = useState<number>(post.likes ?? 0);
  const [localLikedBy, setLocalLikedBy] = useState<string[]>(post.likedBy ?? []);
  const uid = getUserId(authUser);
  const hasLiked = uid ? localLikedBy.includes(uid) : false;

  const handleLike = async () => {
    if (!uid) return;
    try {
      const newLikedBy = hasLiked ? localLikedBy.filter((x) => x !== uid) : [...(localLikedBy || []), uid];
      const newLikes = newLikedBy.length;
      // Optimistic UI
      setLocalLikedBy(newLikedBy);
      setLocalLikes(newLikes);

  const { error } = await supabase.from('posts').update({ metadata: { ...((post as any).metadata || {}), likedBy: newLikedBy, likes: newLikes } }).eq('id', post.id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to toggle like', err);
      // rollback optimistic
      setLocalLikedBy(post.likedBy ?? []);
      setLocalLikes(post.likes ?? 0);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      if (error) throw error;
      toast({ title: "Success", description: "Post deleted." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete post.", variant: "destructive" });
    }
    setIsDeleteAlertOpen(false);
  }


  return (
    <>
    <Card className="shadow-sm overflow-hidden">
      <CardHeader className="p-4 flex flex-row items-center justify-between gap-3">
        {author ? (
          <Link href={`/profile?userId=${author.uid}`} className="flex items-center gap-3 group flex-1">
            <Avatar>
                <AvatarImage src={author.avatar.url} alt={author.name} data-ai-hint={author.avatar.hint} />
                <AvatarFallback>{author.email?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold group-hover:underline">{author?.name || 'Loading...'}</p>
              <p className="text-xs text-muted-foreground">{date}</p>
            </div>
          </Link>
        ): (
          <div className="flex items-center gap-3 flex-1">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1">
              <div className="h-4 w-24 bg-muted animate-pulse rounded-md" />
              <div className="h-3 w-16 bg-muted animate-pulse rounded-md mt-1" />
            </div>
          </div>
        )}
        {isAuthor && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsDeleteAlertOpen(true)} className="text-destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-2">
        <p className="text-sm whitespace-pre-wrap">{post.content}</p>
      </CardContent>
      {post.image && (
        <div className="relative h-64 md:h-80 w-full mt-2">
          <Image
            src={post.image.url}
            alt="Post image"
            fill
            className="object-cover"
            data-ai-hint={post.image.hint}
          />
        </div>
      )}
      <CardFooter className="p-2 flex justify-between items-center bg-secondary/20">
        <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleLike} disabled={!authUser} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                <Heart className={`h-4 w-4 ${hasLiked ? 'fill-red-500 text-red-500' : ''}`} />
                <span>{post.likes}</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
                <MessageCircle className="h-4 w-4" />
                <span>{post.comments}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsCommentDialogOpen(true)} className="flex items-center gap-2 text-muted-foreground hover:text-primary">
              <MessageCircle className="h-4 w-4" />
              <span>Comment</span>
            </Button>
        </div>
        <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-primary">
            <Share2 className="h-4 w-4" />
            <span>Share</span>
        </Button>
      </CardFooter>
    </Card>

    <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your post.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    {isAuthor && <EditPostDialog post={post} isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} />}
    <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Write a comment</DialogTitle>
        </DialogHeader>
        <Textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} className="min-h-[80px]" />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={async () => {
            if (!commentText.trim()) return;
            if (!authUser) { toast({ title: 'Error', description: 'You must be logged in to comment.', variant: 'destructive' }); return; }
            setCommenting(true);
            try {
              const session = await (supabase as any).auth.getSession();
              const token = session?.data?.session?.access_token;
              const userId = getUserId(authUser);
              const res = await fetch('/api/create-comment', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ post_id: post.id, user_id: userId, body: commentText }) });
              if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
              toast({ title: 'Success', description: 'Comment posted.' });
              // optimistic increment
              (post as any).comments = ((post as any).comments || 0) + 1;
              setCommentText('');
              setIsCommentDialogOpen(false);
            } catch (err) {
              console.error('Failed to post comment', err);
              toast({ title: 'Error', description: (err as any)?.message || 'Could not post comment.', variant: 'destructive' });
            } finally {
              setCommenting(false);
            }
          }} disabled={commenting}>{commenting ? 'Posting...' : 'Post Comment'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
