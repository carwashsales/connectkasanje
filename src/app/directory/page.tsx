'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import { getUserId } from '@/lib/getUserId';
import supabase from '@/supabase/client';
import type { UserProfile } from "@/lib/types";
import { Loader2, MessageSquare, Search as SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SearchBar } from "@/components/connect-hub/shared/search-bar";
import { useRouter } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Use the server API route to fetch users from the service role instead of
// calling the server action `getUsers()` from the client. Calling server
// actions from the client triggers a POST to the current route and can
// surface server errors (500) in production if server env vars aren't set.
// We fetch `/api/get-users` directly which is safer and more explicit.


function UserCardSkeleton() {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="p-4">
                    <CardContent className="flex flex-col items-center text-center p-0">
                         <div className="h-24 w-24 rounded-full bg-muted animate-pulse" />
                        <div className="h-5 w-3/4 mt-4 bg-muted animate-pulse rounded" />
                        <div className="h-4 w-1/2 mt-2 bg-muted animate-pulse rounded" />
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

function UserCard({ user, onMessage, isMessagingDisabled }: { user: UserProfile; onMessage: (user: UserProfile) => void; isMessagingDisabled: boolean }) {
    const { user: authUser } = useUser();
    const isCurrentUser = authUser?.uid === user.uid;

    const messageButton = (
         <Button 
            size="sm" 
            className="w-full mt-4" 
            onClick={() => onMessage(user)}
            disabled={isCurrentUser || isMessagingDisabled}
        >
            <MessageSquare className="mr-2 h-4 w-4" /> Message
        </Button>
    )

    return (
        <Card className="p-4 transform transition-all hover:scale-105 hover:shadow-xl">
            <CardContent className="flex flex-col items-center text-center p-0">
                <Link href={`/profile?userId=${user.uid}`} className="flex flex-col items-center w-full">
                    <Avatar className="w-24 h-24 border-2 border-primary">
                        <AvatarImage src={user.avatar.url} alt={user.name} data-ai-hint={user.avatar.hint} />
                        <AvatarFallback>{user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <h3 className="mt-4 font-semibold text-lg truncate w-full" title={user.name}>{user.name}</h3>
                    <p className="text-sm text-muted-foreground truncate w-full" title={user.email}>{user.email}</p>
                </Link>
                <TooltipProvider>
                    {isCurrentUser ? null : !authUser ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span tabIndex={0} className="w-full">{messageButton}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Please log in to message users.</p>
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        messageButton
                    )}
                </TooltipProvider>
            </CardContent>
        </Card>
    );
}

export default function DirectoryPage() {
    const { user: authUser } = useUser();
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreatingConversation, setIsCreatingConversation] = useState(false);
    
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);
                                // Call our API route which uses the service role key
                                const res = await fetch('/api/get-users');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                setAllUsers(json.users || []);
            } catch (error) {
                console.error("Failed to fetch users:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        if (!allUsers) return [];
        return allUsers.filter(user => 
            user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allUsers, searchTerm]);
    
    const handleSendMessage = async (targetUser: UserProfile) => {
    const uid = getUserId(authUser);
        if (!authUser || !uid || uid === targetUser.uid) return;

        setIsCreatingConversation(true);
        try {
            // Look for an existing conversation by checking messages between the two users
            const { data: existingMessages, error: msgError } = await supabase
                .from('messages')
                .select('conversation_id')
                .or(`and(sender_id.eq.${uid},recipient_id.eq.${targetUser.uid}),and(sender_id.eq.${targetUser.uid},recipient_id.eq.${uid})`)
                .order('created_at', { ascending: false })
                .limit(1);

            if (msgError) throw msgError;

            if (existingMessages && existingMessages.length > 0 && existingMessages[0].conversation_id) {
                router.push(`/messages?conversationId=${existingMessages[0].conversation_id}`);
            } else {
                const { data: convData, error: convError } = await supabase.from('conversations').insert([{ last_message_text: '', last_message_at: new Date().toISOString() }]).select().single();
                if (convError) throw convError;
                router.push(`/messages?conversationId=${convData.id}`);
            }
        } catch (err) {
            console.error('Failed to start conversation', err);
        } finally {
            setIsCreatingConversation(false);
        }
    };

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold font-headline">User Directory</h1>
                <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder="Search for users..." />
            </div>

            {loading ? <UserCardSkeleton /> : (
                <>
                {filteredUsers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {filteredUsers.map(user => (
                            <UserCard key={user.uid} user={user} onMessage={handleSendMessage} isMessagingDisabled={isCreatingConversation} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                      <SearchIcon className="mx-auto h-16 w-16 text-muted-foreground/50" />
                      <h3 className="mt-4 text-lg font-semibold">No Users Found</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        No users match your search term.
                      </p>
                    </div>
                )}
                </>
            )}

            {isCreatingConversation && (
                <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="ml-4">Starting conversation...</p>
                </div>
            )}
        </div>
    );
}
