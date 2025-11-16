'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import type { UserProfile } from "@/lib/types";
import supabase from '@/supabase/client';
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Mail, MessageSquare, Phone, User as UserIcon } from "lucide-react";
import Image from "next/image";
// Firestore imports removed; profile reads/writes use Supabase now.
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { validateUploadFile } from '@/lib/supabase';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { getUserId } from '@/lib/getUserId';


function ProfileSkeleton() {
    return (
        <Card className="overflow-hidden shadow-lg">
            <Skeleton className="h-48 md:h-64 w-full" />
            <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-20 sm:-mt-24 space-y-4 sm:space-y-0 sm:space-x-6">
                    <Skeleton className="h-32 w-32 rounded-full border-4 border-background ring-2 ring-primary" />
                    <div className="flex-1 text-center sm:text-left pt-4 w-full">
                        <Skeleton className="h-9 w-1/2 mx-auto sm:mx-0" />
                        <Skeleton className="h-5 w-3/4 mt-2 mx-auto sm:mx-0" />
                    </div>
                </div>
                <div className="mt-8 border-t pt-6">
                    <Skeleton className="h-6 w-1/3 mb-4" />
                    <div className="space-y-3">
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-5 w-1/2" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function ProfilePage() {
    const { user: authUser, isUserLoading: authLoading } = useUser();
    // Firestore removed during migration; we now read profiles from Supabase
    const router = useRouter();
    const searchParams = useSearchParams();
    const [targetUserId, setTargetUserId] = useState<string | null>(null);

    useEffect(() => {
        const userIdFromQuery = searchParams.get('userId');
        if (userIdFromQuery) {
            setTargetUserId(userIdFromQuery);
        } else if (authUser) {
            setTargetUserId(authUser.uid);
        }
    }, [searchParams, authUser]);

        const [user, setUser] = useState<UserProfile | null>(null);
        const [userLoading, setUserLoading] = useState(true);

        useEffect(() => {
            let mounted = true;
            const loadProfile = async () => {
                if (!targetUserId) return;
                setUserLoading(true);
                try {
                    const { data, error } = await supabase.from('profiles').select('id, username, full_name, avatar_url, bio, metadata').eq('id', targetUserId).single();
                    if (error) throw error;
                    if (!mounted) return;
                    const mapped: UserProfile = {
                        id: data.id,
                        uid: data.id,
                        name: data.full_name ?? data.username ?? '',
                        email: data.metadata?.email,
                        avatar: { url: data.avatar_url ?? '', hint: '' },
                        bio: data.bio ?? ''
                    };
                    setUser(mapped);
                } catch (err) {
                    console.error('Failed to load profile', err);
                    setUser(null);
                } finally {
                    if (mounted) setUserLoading(false);
                }
            };
            loadProfile();
            return () => { mounted = false; };
        }, [targetUserId]);
    
    const coverImage = PlaceHolderImages.find(img => img.id === 'profile-cover');

    const handleSendMessage = async () => {
        if (!authUser || !user || (authUser as any).id === user.uid) return;
        try {
          const { data, error } = await supabase.from('conversations').insert([{ subject: '', last_message_text: '', last_message_at: new Date().toISOString() }]).select('id').single();
          if (error) throw error;
          router.push(`/messages?conversationId=${data.id}`);
        } catch (err) {
          console.error('Error creating conversation', err);
          toast({ title: 'Error', description: 'Could not start conversation.', variant: 'destructive' });
        }
    };
    
    const isOwnProfile = !!(authUser && user && authUser.uid === user.uid);
    const { toast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const messageButton = (
         <Button onClick={handleSendMessage} disabled={!authUser || isOwnProfile}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Message
        </Button>
    );

    if (authLoading || (targetUserId && userLoading)) {
        return (
             <div className="container mx-auto py-8 px-4">
                <ProfileSkeleton />
            </div>
        );
    }

    if (!authUser && !targetUserId) {
        return (
            <div className="container mx-auto py-8 px-4 text-center">
                <Card className="max-w-md mx-auto p-8">
                    <UserIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold">Please Log In</h2>
                    <p className="mt-2 text-muted-foreground">You need to be logged in to view your profile.</p>
                    <Button asChild className="mt-6">
                        <Link href="/login">Log In</Link>
                    </Button>
                </Card>
            </div>
        );
    }

    if (!user) {
         return (
             <div className="container mx-auto py-8 px-4 text-center">
                <p>Could not load user profile. The user may not exist.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4">
            <Card className="overflow-hidden shadow-lg">
                <div className="relative h-48 md:h-64 w-full">
                    {coverImage && (
                         <Image 
                            src={coverImage.imageUrl} 
                            alt="Profile cover" 
                            fill
                            className="object-cover"
                            data-ai-hint={coverImage.imageHint}
                        />
                    )}
                    <div className="absolute inset-0 bg-black/30" />
                </div>
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-20 sm:-mt-24">
                        <div className="relative">
                                                        <div>
                                                            <Avatar className="h-32 w-32 border-4 border-background ring-2 ring-primary">
                                                                    <AvatarImage src={user.avatar.url} alt={user.name} data-ai-hint={user.avatar.hint} />
                                                                    <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                                                            </Avatar>

                                                            {isOwnProfile && (
                                                                <div className="mt-2 text-center">
                                                                    <label htmlFor="avatar-upload" className="cursor-pointer text-sm text-primary hover:underline">Change avatar</label>
                                                                    <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                                                        const f = e.target.files?.[0];
                                                                        if (!f) return;
                                                                        const valid = validateUploadFile(f, { maxBytes: 5 * 1024 * 1024, accept: ['image/'] });
                                                                        if (!valid.valid) {
                                                                            toast({ title: 'Invalid file', description: (valid as any).reason || 'Please choose a smaller image.' , variant: 'destructive'});
                                                                            return;
                                                                        }

                                                                        try {
                                                                            setUploading(true);
                                                                            setProgress(0);

                                                                            // Upload to server endpoint to store in bucket and return signed URL
                                                                            const form = new FormData();
                                                                            form.append('file', f);
                                                                            form.append('bucket', 'ft');
                                                                            form.append('folder', 'avatars');

                                                                            // Use XMLHttpRequest to track progress
                                                                            await new Promise<void>((resolve, reject) => {
                                                                                const xhr = new XMLHttpRequest();
                                                                                xhr.open('POST', '/api/supabase/upload');
                                                                                xhr.onload = async () => {
                                                                                    if (xhr.status >= 200 && xhr.status < 300) {
                                                                                        const res = JSON.parse(xhr.responseText);
                                                                                        const signedUrl = res.url;
                                                                                        const path = res.path;
                                                                                                                                                                                // Upsert profile avatar in Supabase
                                                                                                                                                                                try {
                                                                                                                                                                                    const userId = getUserId(authUser);
                                                                                                                                                                                    if (userId) {
                                                                                                                                                                                        const { error: upsertError } = await supabase.from('profiles').upsert({ id: userId, avatar_url: signedUrl });
                                                                                                                                                                                        if (upsertError) console.error('Profile upsert error', upsertError);
                                                                                                                                                                                        toast({ title: 'Success', description: 'Avatar updated.' });
                                                                                                                                                                                    }
                                                                                                                                                                                } catch (e) {
                                                                                                                                                                                    console.error('Profile upsert failed', e);
                                                                                                                                                                                }
                                                                                        setProgress(100);
                                                                                        resolve();
                                                                                    } else {
                                                                                        reject(new Error(`Upload failed: ${xhr.status}`));
                                                                                    }
                                                                                };
                                                                                xhr.onerror = () => reject(new Error('Network error'));
                                                                                xhr.upload.onprogress = (ev) => {
                                                                                    if (ev.lengthComputable) {
                                                                                        const p = Math.round((ev.loaded / ev.total) * 100);
                                                                                        setProgress(p);
                                                                                    }
                                                                                };
                                                                                xhr.send(form);
                                                                            });

                                                                        } catch (err) {
                                                                            console.error('Avatar upload failed', err);
                                                                            toast({ title: 'Upload Error', description: 'Could not upload avatar.', variant: 'destructive' });
                                                                        } finally {
                                                                            setUploading(false);
                                                                            setProgress(0);
                                                                        }
                                                                    }} />

                                                                    {uploading && (
                                                                        <div className="mt-2">
                                                                            <Progress value={progress} className="w-40" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                        </div>

                        <div className="flex-1 flex flex-col sm:flex-row justify-between items-center w-full mt-4 sm:mt-0 sm:ml-6">
                            <div className="text-center sm:text-left">
                                <h1 className="text-3xl font-bold font-headline">{user.name}</h1>
                                <p className="text-muted-foreground mt-1">{user.bio || 'No bio yet.'}</p>
                            </div>

                            <div className="mt-4 sm:mt-0">
                                {isOwnProfile ? (
                                    <Button asChild>
                                        <Link href="/profile/edit">Edit profile</Link>
                                    </Button>
                                ) : (
                                    <TooltipProvider>
                                        {!authUser ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span tabIndex={0}>{messageButton}</span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Please log in to message this user.</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            messageButton
                                        )}
                                    </TooltipProvider>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 border-t pt-6">
                        <h2 className="text-xl font-headline font-semibold">Contact Information</h2>
                        <div className="mt-4 space-y-3 text-sm">
                            <div className="flex items-center gap-3">
                                <Mail className="h-5 w-5 text-accent" />
                                <a href={`mailto:${user.email}`} className="text-primary hover:underline">{user.email}</a>
                            </div>
                            <div className="flex items-center gap-3">
                                <Phone className="h-5 w-5 text-accent" />
                                <span>(123) 456-7890</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
