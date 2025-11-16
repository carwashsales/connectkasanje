'use client';

import { ChatLayout } from "@/components/connect-hub/messages/chat-layout";
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import type { UserProfile, Conversation as ConversationType } from '@/lib/types';
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { User as UserIcon, MessageSquare } from 'lucide-react';
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getConversations } from '@/ai/flows/get-conversations';
import { Skeleton } from "@/components/ui/skeleton";


function ChatSkeleton() {
  return (
    <div className="flex h-[calc(100vh-4rem)] border-t">
      <div className="w-full md:w-1/3 flex-shrink-0 border-r bg-card md:flex flex-col">
        <div className="p-4 border-b">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex-col hidden md:flex">
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <p>Select a conversation to start chatting</p>
        </div>
      </div>
    </div>
  )
}

export default function MessagesPage() {
  const { user: authUser, isUserLoading: authLoading } = useUser();
  const searchParams = useSearchParams();
  const conversationIdFromUrl = searchParams.get('conversationId');

  const [rawConversations, setRawConversations] = useState<ConversationType[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && authUser) {
      const fetchConversations = async () => {
        try {
          setLoading(true);
          const uid = getUserId(authUser);
          const result = await getConversations({ userId: uid });
          
          // Convert string dates back to Date objects
          const conversationsWithDates = result.conversations.map(c => ({
              ...c,
              lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt) : new Date(0), // Use epoch for sorting if undefined
          })) as unknown as ConversationType[];

          setRawConversations(conversationsWithDates);
          setCurrentUserProfile(result.currentUser);

        } catch (error) {
          console.error("Failed to fetch conversations:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchConversations();
    } else if (!authLoading && !authUser) {
        setLoading(false);
    }
  }, [authUser, authLoading]);

  // Memoized client-side sorting
  const conversations = useMemo(() => {
    const toMillis = (t: any) => {
      if (!t) return 0;
      if (typeof t.getTime === 'function') return t.getTime();
      if (typeof t.toDate === 'function') return t.toDate().getTime();
      if (typeof t === 'number') return t;
      return 0;
    };
    return [...rawConversations].sort((a, b) => toMillis(b.lastMessageAt) - toMillis(a.lastMessageAt));
  }, [rawConversations]);
  

  if (authLoading || loading) {
    return <ChatSkeleton />;
  }
  
  if (!authUser) {
    return (
      <div className="container mx-auto py-8 px-4 text-center h-full flex items-center justify-center">
          <Card className="max-w-md mx-auto p-8">
              <UserIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">Please Log In</h2>
              <p className="mt-2 text-muted-foreground">You need to be logged in to view your messages.</p>
              <Button asChild className="mt-6">
                  <Link href="/login">Log In</Link>
              </Button>
          </Card>
      </div>
    );
  }

  if(!currentUserProfile && !loading) {
     return (
        <div className="container mx-auto py-8 px-4 text-center h-full flex items-center justify-center">
             <Card className="max-w-md mx-auto p-8">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">Could not load profile</h2>
              <p className="mt-2 text-muted-foreground">There was an issue loading your user data.</p>
          </Card>
        </div>
     );
  }
  
  return (
    <div className="h-[calc(100vh-4rem)]">
        <ChatLayout 
            conversations={conversations} 
            currentUser={currentUserProfile!}
            defaultConversationId={conversationIdFromUrl}
        />
    </div>
  );
}
