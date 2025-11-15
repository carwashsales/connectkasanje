'use client';

import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Home, Store, Search, MessageSquare, Settings, LogIn, LogOut, UserPlus, UserCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { AdBanner } from '../connect-hub/shared/ad-banner';
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import { Skeleton } from '../ui/skeleton';

const navItems = [
  { href: '/', label: 'News Feed', icon: Home },
  { href: '/marketplace', label: 'Marketplace', icon: Store },
  { href: '/lost-and-found', label: 'Lost & Found', icon: Search },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/directory', label: 'Directory', icon: Users },
];

export function SidebarNav({ user }: { user: UserProfile | null }) {
  const pathname = usePathname();
  const { isUserLoading: authLoading, signOut } = useUser();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };


  return (
    <>
      <SidebarHeader className='p-4'>
        <Link href="/" className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-primary"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path><path d="M12 12c-3.31 0-6-2.69-6-6s2.69-6 6-6"></path><path d="M12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6"></path></svg>
            <h1 className="text-2xl font-headline font-bold text-primary">Connect Hub</h1>
        </Link>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <SidebarGroup className='mt-4'>
            <AdBanner id="sidebar-ad" />
        </SidebarGroup>

      </SidebarContent>
      <SidebarFooter className='p-2'>
        <Separator className="my-2" />
        <SidebarMenu>
          {authLoading ? (
             <div className="flex items-center gap-3 p-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className='flex flex-col gap-1'>
                 <Skeleton className="h-4 w-20 rounded" />
                 <Skeleton className="h-3 w-16 rounded" />
              </div>
            </div>
          ) : user ? (
             <SidebarMenuItem>
                <div className="flex items-center justify-between w-full">
                    <SidebarMenuButton asChild isActive={pathname.startsWith('/profile')} tooltip="Profile" variant="default" className="flex-1 justify-start h-auto p-1">
                        <Link href="/profile" className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={user.avatar?.url} alt={user.name} data-ai-hint={user.avatar?.hint} />
                                <AvatarFallback>{user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || <UserCircle />}</AvatarFallback>
                            </Avatar>
                             <div className="flex flex-col items-start text-left">
                                <span className="text-sm font-medium">{user.name}</span>
                                <span className="text-xs text-muted-foreground">View Profile</span>
                             </div>
                        </Link>
                    </SidebarMenuButton>
                    <div className="flex items-center">
                        <SidebarMenuButton asChild isActive={pathname === '/settings'} tooltip="Settings" size="sm" variant="default">
                            <Link href="/settings">
                                <Settings />
                            </Link>
                        </SidebarMenuButton>
                        <SidebarMenuButton onClick={handleLogout} tooltip="Log Out" size="sm" variant="default" className="text-destructive hover:text-destructive">
                            <LogOut />
                        </SidebarMenuButton>
                    </div>
                </div>
              </SidebarMenuItem>
          ) : (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/login'} tooltip="Login">
                  <Link href="/login">
                    <LogIn />
                    <span>Login</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/signup'} tooltip="Sign Up">
                  <Link href="/signup">
                    <UserPlus />
                    <span>Sign Up</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
