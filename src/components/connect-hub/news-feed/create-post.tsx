'use client';

import React, { useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import supabase from '@/supabase/client';
import { getUserId } from '@/lib/getUserId';
import type { UserProfile as User } from '@/lib/types';
import { Paperclip, Send, Loader2 } from 'lucide-react';
import { uploadToSupabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
// Firestore imports removed; this component uses Supabase now.
import { z } from 'zod';
import { moderateContent } from '@/ai/flows/automated-content-moderation';

const CreatePostSchema = z.object({
  content: z.string().min(1, 'Post content cannot be empty.').max(500, 'Post content is too long.'),
});

type CreatePostProps = {
  user: User;
};

export function CreatePost({ user }: CreatePostProps) {
  const { user: authUser } = useUser();
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
    try {
      if (attachedFile) {
        try {
          const uploaded = await uploadToSupabase(attachedFile);
          media = { url: uploaded.publicUrl, path: uploaded.path, mime: attachedFile.type };
        } catch (err) {
          console.error('Upload failed', err);
          toast({ title: 'Upload Error', description: 'Could not upload attachment.', variant: 'destructive' });
          setLoading(false);
          return;
        }
      }
      const moderationResult = await moderateContent({ text: content });
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
      console.error('Error moderating post:', error);
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
      const { error } = await supabase.from('posts').insert([{ 
        user_id: userId,
        body: content,
        media: media ? media : null,
        metadata: { likes: 0, comments: 0 },
        visibility: 'public'
      }]);
      if (error) throw error;
      toast({ title: 'Success', description: 'Post created successfully.' });
      formRef.current?.reset();
    } catch (error) {
      console.error('Error writing post:', error);
      toast({ title: 'Database Error', description: 'Could not save post to the database.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} ref={formRef}>
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
                required
              />
            </div>
          </div>
            <div className="mt-4 flex justify-between items-center">
              <input
                id="post-attachment"
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setAttachedFile(f);
                  if (f) setPreviewUrl(URL.createObjectURL(f));
                }}
              />
              <label htmlFor="post-attachment">
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <Paperclip className="h-5 w-5" />
                  <span className="sr-only">Attach file</span>
                </Button>
              </label>
              {previewUrl && (
                <div className="ml-3">
                  {attachedFile?.type.startsWith('image') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="preview" className="h-12 w-12 object-cover rounded" />
                  ) : (
                    <video src={previewUrl} className="h-12 w-12 object-cover rounded" />
                  )}
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
