'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Home, Store, Search, MessageSquare, UserCircle2, Settings, Users } from 'lucide-react';
import React from 'react';
import Link from 'next/link';

const routeTitles: { [key: string]: { title: string; icon: React.ElementType } } = {
  '/': { title: 'News Feed', icon: Home },
  '/marketplace': { title: 'Marketplace', icon: Store },
  '/lost-and-found': { title: 'Lost & Found', icon: Search },
  '/messages': { title: 'Messages', icon: MessageSquare },
  '/directory': { title: 'Directory', icon: Users },
  '/profile': { title: 'Profile', icon: UserCircle2 },
  '/settings': { title: 'Settings', icon: Settings },
};

export function Header({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  let pageInfo = routeTitles[pathname] || { title: 'Connect Hub', icon: Home };

  if (pathname === '/profile' && searchParams.has('userId')) {
    pageInfo = { title: 'User Profile', icon: UserCircle2 };
  }

  const { title, icon: Icon } = pageInfo;

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
            {children}
        </div>
        <div className='flex items-center gap-2'>
            <Icon className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold font-headline">{title}</h1>
        </div>
        <div className="ml-auto">
          <Link href="/profile" className="inline-flex items-center rounded px-2 py-1 hover:bg-secondary/50">
            <UserCircle2 className="h-5 w-5 text-muted-foreground" />
            <span className="sr-only">Profile</span>
          </Link>
        </div>
    </header>
  );
}
