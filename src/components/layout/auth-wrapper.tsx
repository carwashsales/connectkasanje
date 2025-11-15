'use client';

import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useMemo } from 'react';
import { AppLayout } from './app-layout';
import supabase from '@/supabase/client';
import type { UserProfile } from '@/lib/types';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { AlertTriangle } from 'lucide-react';

function FullPageLoader() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-8 w-8 animate-spin text-primary"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>
  );
}

function MissingProfileError() {
  const router = useRouter();

  const handleTryAgain = () => {
    // This could be enhanced to try re-fetching or logging out/in.
    // For now, a simple refresh or redirect is a common strategy.
    router.push('/login');
  };

  return (
     <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md p-6 sm:p-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-4 text-2xl font-headline font-bold">User Profile Not Found</h1>
            <p className="mt-2 text-muted-foreground">
                We could not find a user profile associated with your account. This may be a temporary issue. Please try logging in again.
            </p>
            <Button onClick={handleTryAgain} variant="destructive" className="mt-6">
                Return to Login
            </Button>
        </Card>
     </div>
  );
}


const PUBLIC_PATHS = ['/login', '/signup'];

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user: authUser, isUserLoading: authLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicPage = PUBLIC_PATHS.includes(pathname);
  const [userProfile, setUserProfile] = React.useState<any | null>(null);
  const [userProfileLoading, setUserProfileLoading] = React.useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      setUserProfileLoading(true);
      const uid = (authUser as any)?.id ?? (authUser as any)?.uid;
      if (!uid) {
        setUserProfile(null);
        setUserProfileLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.from('profiles').select('id, username, full_name, avatar_url, bio, metadata').eq('id', uid).single();
        if (error) throw error;
        if (!mounted) return;
        const mapped = {
          uid: data.id,
          id: data.id,
          name: data.full_name ?? data.username ?? '',
          email: data.metadata?.email,
          avatar: { url: data.avatar_url ?? '', hint: '' },
          bio: data.bio ?? ''
        };
        setUserProfile(mapped);
      } catch (err) {
        console.error('Failed to load profile', err);
        setUserProfile(null);
      } finally {
        if (mounted) setUserProfileLoading(false);
      }
    }
    loadProfile();
    return () => { mounted = false; };
  }, [authUser]);

  console.log('[AuthWrapper] Render:', {
      pathname,
      isPublicPage,
      authLoading,
      authUser: !!authUser,
      userProfileLoading,
      userProfile: !!userProfile,
  });


  useEffect(() => {
    console.log('[AuthWrapper Effect] Checking redirects...', {
      authLoading,
      userProfileLoading,
      authUser: !!authUser,
      userProfile: !!userProfile,
      isPublicPage,
    });
    if (authLoading || userProfileLoading) {
      console.log('[AuthWrapper Effect] Still loading, skipping redirects.');
      return; 
    }
    
    if (!authUser && !isPublicPage) {
      console.log('[AuthWrapper Effect] No authUser on protected page. Redirecting to /login.');
      router.push('/login');
    }

    if (authUser && userProfile && isPublicPage) {
      console.log('[AuthWrapper Effect] authUser and profile exist on public page. Redirecting to /.');
      router.push('/');
    }

  }, [authUser, userProfile, authLoading, userProfileLoading, isPublicPage, pathname, router]);


  // 1. While auth is loading, show a loader.
  if (authLoading) {
    console.log('[AuthWrapper] Branch 1: Auth loading...');
    return <FullPageLoader />;
  }

  // 2. If auth is done and there's no user.
  if (!authUser) {
    // If it's a public page, show it.
    if (isPublicPage) {
        console.log('[AuthWrapper] Branch 2a: No authUser, showing public page.');
        return <>{children}</>;
    }
    // Otherwise, we are redirecting, so show a loader.
    console.log('[AuthWrapper] Branch 2b: No authUser, redirecting. Showing loader.');
    return <FullPageLoader />;
  }
  
  // 3. If we have an auth user but are still waiting for their profile, show loader.
  if (authUser && userProfileLoading) {
     console.log('[AuthWrapper] Branch 3: Have authUser, but profile is loading...');
     return <FullPageLoader />;
  }

  // 4. If on a public page (but we have a user and profile), we are redirecting.
  if (isPublicPage) {
      console.log('[AuthWrapper] Branch 4: On public page with user, redirecting. Showing loader.');
      return <FullPageLoader />;
  }

  // 5. If profile loading is finished, but there's no profile, show an error component.
  if (authUser && !userProfile) {
     console.log('[AuthWrapper] Branch 5: Have authUser, but no profile found. Showing error.');
     return <MissingProfileError />;
  }
  
  // 6. If we have both an auth user and their profile, show the app.
  if (authUser && userProfile) {
    console.log('[AuthWrapper] Branch 6: Success! Have authUser and profile. Showing app.');
    return <AppLayout user={userProfile}>{children}</AppLayout>;
  }

  // Fallback state, should ideally not be reached.
  console.log('[AuthWrapper] Fallback: No condition met, showing loader.');
  return <FullPageLoader />;
}
