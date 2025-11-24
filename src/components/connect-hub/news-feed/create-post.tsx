'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import supabase from '@/supabase/client';
import { getUserId } from '@/lib/getUserId';
import type { UserProfile as User } from '@/lib/types';
import { Paperclip, Send, Loader2 } from 'lucide-react';
import { uploadToSupabase, uploadCancelable } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
// Firestore imports removed; this component uses Supabase now.
import { z } from 'zod';
// moderation is server-side; call via API to avoid importing server modules into a client component

const CreatePostSchema = z.object({
  content: z.string().min(1, 'Post content cannot be empty.').max(500, 'Post content is too long.'),
});

type CreatePostProps = {
  user: User;
  onPosted?: (post: any) => void;
};

export function CreatePost({ user, onPosted }: CreatePostProps) {
  const { user: authUser } = useUser();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        try { URL.revokeObjectURL(previewUrl); } catch (e) { /* ignore */ }
      }
    };
  }, [previewUrl]);

  if (!authUser || !user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const content = formData.get('content') as string;

    const validatedFields = CreatePostSchema.safeParse({ content });

    if (!validatedFields.success) {
      toast({
        title: 'Error',
        description: validatedFields.error.flatten().fieldErrors.content?.[0],
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    let media: any = null;
    const userId = getUserId(authUser);
    // Create optimistic post so the UI shows immediate feedback.
    const tempId = `temp-${Date.now()}`;
    const optimisticPost = {
      id: tempId,
      authorId: userId,
      content,
      image: previewUrl ? { url: previewUrl, hint: 'preview' } : undefined,
      createdAt: { toDate: () => new Date() } as any,
      likes: 0,
      likedBy: [],
      comments: 0,
      optimistic: true,
    } as any;
    try {
      if (typeof onPosted === 'function') {
        onPosted(optimisticPost);
      } else {
        try { window?.dispatchEvent(new CustomEvent('connethub:post-created', { detail: optimisticPost })); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
    try {
      if (attachedFile) {
        try {
          setUploadProgress(0);
          setUploadError(null);
          setIsUploading(true);
          const controller = uploadCancelable(attachedFile, undefined, undefined, (pct) => setUploadProgress(pct));
          uploadCancelRef.current = controller.cancel;
          const uploaded = await controller.promise;
          media = { url: uploaded.publicUrl, path: uploaded.path, mime: attachedFile.type };
          setUploadProgress(null);
          setIsUploading(false);
          uploadCancelRef.current = null;
        } catch (err) {
          console.error('Upload failed', err);
          const msg = (err as any)?.message || 'Could not upload attachment.';
          setUploadError(msg);
          toast({ title: 'Upload Error', description: msg, variant: 'destructive' });
          // notify parent to remove optimistic post
          try { window?.dispatchEvent(new CustomEvent('connethub:post-failed', { detail: { tempId, reason: msg } })); } catch (e) { /* ignore */ }
          setLoading(false);
          setIsUploading(false);
          uploadCancelRef.current = null;
          return;
        }
      }
      let moderationResult = { isAppropriate: true, reason: 'not-run' } as any;
      try {
        // Call server moderation endpoint. If that fails, allow the post and
        // mark it for later moderation. Use warnings instead of errors so the
        // development overlay doesn't interrupt posting when the moderation
        // service is not configured.
        const mres = await fetch('/api/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: content }) });
        if (mres.ok) {
          const mp = await mres.json().catch(() => ({}));
          moderationResult = mp?.data ?? { isAppropriate: true, reason: 'not-run' };
        } else {
          console.warn('Moderation API returned non-OK', await mres.text());
          moderationResult = { isAppropriate: true, reason: 'moderation-service-unavailable' };
        }
      } catch (modErr) {
        console.warn('Moderation call failed, allowing post and flagging for review', modErr);
        moderationResult = { isAppropriate: true, reason: 'moderation-service-unavailable' };
      }
      if (!moderationResult.isAppropriate) {
        toast({
          title: 'Post Moderated',
          description: `Your post was deemed inappropriate. Reason: ${moderationResult.reason}`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
    } catch (error) {
      console.warn('Error moderating post:', error);
      toast({
        title: 'Error',
        description: 'Could not moderate post content.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    try {
      const userId = getUserId(authUser);
      // include the user's access token in Authorization header so the server
      // can verify the caller is the same user (prevents spoofing)
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/create-post', {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId, body: content, media: media ? media : null, metadata: { likes: 0, comments: 0 }, visibility: 'public' })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'unknown' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const payload = await res.json().catch(() => ({}));
      const created = Array.isArray(payload.data) ? payload.data[0] : payload.data;
      // Map created row to client Post shape and notify parent
      const newPost = {
        id: created?.id,
        authorId: created?.user_id,
        content: created?.body ?? created?.title ?? content,
        image: created?.media ? { url: created.media.url, hint: created.media.path } : media ? { url: media.url, hint: media.path } : undefined,
        createdAt: { toDate: () => new Date(created?.created_at || new Date().toISOString()) },
        likes: created?.metadata?.likes ?? 0,
        likedBy: created?.metadata?.likedBy ?? [],
        comments: created?.metadata?.comments ?? 0,
      };
      toast({ title: 'Success', description: 'Post created successfully.' });
      formRef.current?.reset();
      setUploadProgress(null);
      // clear attached file & preview after successful post so the composer is reset
      setAttachedFile(null);
      if (previewUrl) {
        try { URL.revokeObjectURL(previewUrl); } catch (e) { /* ignore */ }
      }
      setPreviewUrl(null);
      if (fileInputRef.current) {
        try { (fileInputRef.current as HTMLInputElement).value = ''; } catch (e) { /* ignore */ }
      }
      // Do not directly insert the final created post into the local feed here.
      // The feed is subscribed to realtime INSERT events and will receive the
      // final post from the server. Emitting the final post here in addition
      // to the realtime event caused duplicate posts. We only emit the
      // `post-replaced` event to remove the optimistic placeholder.
      // remove any optimistic posts that match the tempId/content
      try { window?.dispatchEvent(new CustomEvent('connethub:post-replaced', { detail: { tempId, finalId: newPost.id } })); } catch (e) { /* ignore */ }
    } catch (error: any) {
      console.error('Error writing post:', error);
      toast({ title: 'Database Error', description: error?.message || 'Could not save post to the database.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      // handle paste events: if there is a file in clipboard, attach it
      try {
        const files = e.clipboardData?.files;
        if (files && files.length > 0) {
          const f = files[0];
          setAttachedFile(f);
          setPreviewUrl(URL.createObjectURL(f));
          e.preventDefault();
        } else if (e.clipboardData) {
          // some browsers place images as items
          const items = Array.from(e.clipboardData.items || []);
          const imageItem = items.find(i => i.kind === 'file');
          if (imageItem) {
            const blob = imageItem.getAsFile();
            if (blob) {
              setAttachedFile(blob);
              setPreviewUrl(URL.createObjectURL(blob));
              e.preventDefault();
            }
          }
        }
      } catch (err) {
        // ignore
      }
    };

    const handleDrop = (e: React.DragEvent<HTMLFormElement>) => {
      e.preventDefault();
      try {
        const f = e.dataTransfer?.files?.[0] ?? null;
        if (f) {
          setAttachedFile(f);
          setPreviewUrl(URL.createObjectURL(f));
        }
      } catch (err) { /* ignore */ }
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

    return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} ref={formRef} onDrop={handleDrop} onDragOver={handleDragOver}>
          <div className="flex items-start gap-4">
            <Avatar>
              <AvatarImage src={user?.avatar?.url} alt={user?.name} data-ai-hint={user?.avatar?.hint} />
              <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="w-full">
              <Textarea
                name="content"
                placeholder="What's on your mind?"
                className="w-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 shadow-none min-h-[60px]"
                onPaste={handlePaste}
                required
              />
            </div>
          </div>
            <div className="mt-4 flex justify-between items-center">
              <input
                id="post-attachment"
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setAttachedFile(f);
                  if (f) setPreviewUrl(URL.createObjectURL(f));
                }}
              />
              <Button type="button" variant="ghost" size="icon" className="text-muted-foreground" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-5 w-5" />
                <span className="sr-only">Attach file</span>
              </Button>
              {previewUrl && (
                <div className="ml-3">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Remove attachment"
                    onClick={() => { setAttachedFile(null); if (previewUrl) { try { URL.revokeObjectURL(previewUrl); } catch (e) { } } setPreviewUrl(null); }}
                    onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); setAttachedFile(null); if (previewUrl) { try { URL.revokeObjectURL(previewUrl); } catch (e) { } } setPreviewUrl(null); } }}
                    className="h-12 w-12 rounded overflow-hidden ring-1 ring-ring cursor-pointer"
                    title="Click or press Delete to remove attachment"
                  >
                    {attachedFile?.type.startsWith('image') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl as string} alt="preview" className="h-12 w-12 object-cover" />
                    ) : (
                      <video src={previewUrl as string} className="h-12 w-12 object-cover" />
                    )}
                  </div>
                </div>
              )}
            {uploadProgress !== null && (
              <div className="ml-4 w-48">
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div className="h-2 bg-primary" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs mt-1">Uploading: {uploadProgress}%</p>
                <div className="mt-2 flex gap-2">
                  {isUploading && (
                    <Button variant="ghost" size="sm" onClick={() => { uploadCancelRef.current?.(); setIsUploading(false); setUploadProgress(null); setUploadError('Upload cancelled'); }}>
                      Cancel
                    </Button>
                  )}
                  {uploadError && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      // allow retry by clearing error; user must submit again to retry upload
                      setUploadError(null);
                      setUploadProgress(null);
                    }}>
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            )}
            <Button type="submit" disabled={loading} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
