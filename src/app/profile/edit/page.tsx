'use client';

import React, { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import supabase from '@/supabase/client';
import { getUserId } from '@/lib/getUserId';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { validateUploadFile } from '@/lib/supabase';

export default function ProfileEditPage() {
  const { user: authUser } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const formRef = useRef<HTMLFormElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!authUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    setLoading(true);

    try {
      const form = new FormData(formRef.current);
      const name = (form.get('name') as string) || '';
      const bio = (form.get('bio') as string) || '';

      if (!name.trim()) {
        toast({ title: 'Validation', description: 'Name is required', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const updates: any = { name: name.trim(), bio: bio.trim() };

      const fileInput = formRef.current.querySelector('#avatar') as HTMLInputElement | null;
      if (fileInput?.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const valid = validateUploadFile(file, { maxBytes: 5 * 1024 * 1024, accept: ['image/'] });
        if (!valid.valid) {
          toast({ title: 'Invalid file', description: (valid as any).reason || 'Please choose a valid image.', variant: 'destructive' });
          setLoading(false);
          return;
        }

  // upload via server endpoint to private bucket
        setUploading(true);
        setProgress(0);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/supabase/upload');
          xhr.onload = async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const res = JSON.parse(xhr.responseText);
                const signedUrl = res.url || res.signedUrl || res.signedUrl;
                const path = res.path;
                if (signedUrl) updates.avatar = { url: signedUrl, hint: path };
                resolve();
              } catch (err) {
                reject(err);
              }
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
          };
          const fd = new FormData();
          fd.append('file', file);
          // Let server use the configured default bucket (e.g. 'hub')
          fd.append('folder', 'avatars');
          xhr.send(fd);
        });

        setUploading(false);
        setProgress(0);
      }

      // upsert into Supabase profiles table
  const userId = getUserId(authUser);
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        full_name: updates.name,
        avatar_url: updates.avatar?.url ?? null,
        metadata: { ...(updates as any).metadata ?? {} }
      });
      if (error) throw error;
      toast({ title: 'Profile updated', description: 'Your profile was updated successfully.' });
      router.push('/profile');
    } catch (err) {
      console.error('Profile save failed', err);
      toast({ title: 'Error', description: 'Could not save profile.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardContent>
          <form ref={formRef} onSubmit={handleSubmit} className="grid gap-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input id="name" name="name" placeholder="Your full name" defaultValue={authUser.displayName || ''} required />
            </div>
            <div>
              <label className="text-sm font-medium">Bio</label>
              <Textarea id="bio" name="bio" placeholder="Short bio" />
            </div>
            <div>
              <label className="text-sm font-medium">Avatar</label>
              <input id="avatar" name="avatar" type="file" accept="image/*" />
              {uploading && <div className="mt-2"><Progress value={progress} className="w-48" /></div>}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="bg-primary">{loading ? 'Saving...' : 'Save'}</Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/profile')}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
