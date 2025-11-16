'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { getUserId } from '@/lib/getUserId';
import { Textarea } from '@/components/ui/textarea';
import type { UserProfile } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import supabase from '@/supabase/client';

function SettingsSkeleton() {
    return (
        <Card className="mx-auto max-w-2xl">
            <CardHeader>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-48 mt-1" />
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-24 w-full" />
                </div>
                <div className="flex justify-end">
                    <Skeleton className="h-10 w-24" />
                </div>
            </CardContent>
        </Card>
    );
}

export default function SettingsPage() {
    const { user: authUser, isUserLoading: authLoading } = useUser();
    const { toast } = useToast();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [userLoading, setUserLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        async function loadProfile() {
            setUserLoading(true);
            const uid = getUserId(authUser);
            if (!uid) {
                setUser(null);
                setUserLoading(false);
                return;
            }
            try {
                const { data, error } = await supabase.from('profiles').select('id, username, full_name, avatar_url, bio, metadata').eq('id', uid).single();
                if (error) throw error;
                if (!mounted) return;
                const mapped: UserProfile = {
                    uid: data.id,
                    id: data.id,
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
        }
        loadProfile();
        return () => { mounted = false; };
    }, [authUser]);

    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setBio(user.bio || '');
        }
    }, [user]);

    const handleSaveChanges = async () => {
        const uid = (authUser as any)?.id ?? (authUser as any)?.uid;
        if (!uid) return;
        setIsSaving(true);
        try {
            const { error } = await supabase.from('profiles').update({ full_name: name, bio }).eq('id', uid);
            if (error) throw error;
            toast({ title: 'Success!', description: 'Your profile has been updated.' });
        } catch (error: any) {
            toast({ title: 'Error updating profile', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (authLoading || userLoading) {
        return (
             <div className="container mx-auto py-8 px-4">
                <SettingsSkeleton />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4">
            <Card className="mx-auto max-w-2xl">
                <CardHeader>
                    <CardTitle className="font-headline">Profile Settings</CardTitle>
                    <CardDescription>Update your name and bio.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                            id="bio"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Tell us a little about yourself"
                            className="min-h-[100px]"
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleSaveChanges} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
