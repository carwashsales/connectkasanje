
"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Send, ArrowLeft, MessageCircle, Paperclip } from "lucide-react";
import { uploadToSupabase, uploadCancelable } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { getUserId } from '@/lib/getUserId';
import type { Conversation, Message, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSupabaseAuth as useUser } from '@/supabase/AuthProvider';
import supabase from '@/supabase/client';
import { useSupabaseRealtime } from '@/lib/use-supabase-realtime';
import { startPresence, fetchPresence } from '@/lib/presence';
import { formatDistanceToNow } from 'date-fns';

type ChatLayoutProps = {
  conversations: Conversation[];
  currentUser: UserProfile;
  defaultConversationId?: string | null;
};

function ChatMessages({ conversation, currentUser, refreshKey }: { conversation: Conversation, currentUser: UserProfile, refreshKey?: number }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });
      if (!mounted) return;
      if (error) {
        console.error('Error loading messages', error);
        setMessages([]);
      } else {
        setMessages(data ?? []);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [conversation.id, refreshKey]);

  // Realtime subscription for messages in this conversation (INSERT/UPDATE/DELETE)
  useSupabaseRealtime('messages', (payload) => {
    const ev = payload.eventType || payload.event;
    const record = payload.record;
    if (!record || record.conversation_id !== conversation.id) return;
    setMessages((prev) => {
      if (!prev) return prev;
      if (ev === 'INSERT') {
        return [...prev, record];
      }
      if (ev === 'UPDATE') {
        return prev.map((m) => (m.id === record.id ? record : m));
      }
      if (ev === 'DELETE') {
        return prev.filter((m) => m.id !== record.id);
      }
      return prev;
    });
    // scroll into view after adding new message
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, { column: 'conversation_id', value: conversation.id, events: ['INSERT','UPDATE','DELETE'] });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const otherParticipant = Object.values(conversation.participants).find(p => p.uid !== currentUser.uid);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><p>Loading messages...</p></div>
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages && messages.length > 0 ? (
        messages.map((msg) => {
          const sender = (msg as any).sender_id === currentUser.uid ? currentUser : otherParticipant as any;
          const timestamp = (msg as any).created_at ? formatDistanceToNow(new Date((msg as any).created_at), { addSuffix: true }) : 'just now';

          return (
            <div key={(msg as any).id} className={cn('flex gap-3', (msg as any).sender_id === currentUser.uid ? 'justify-end' : 'justify-start')}>
              {(msg as any).sender_id !== currentUser.uid && sender && (
                 <Avatar className="h-8 w-8">
                   <AvatarImage src={sender.avatar.url} alt={sender.name} data-ai-hint={sender.avatar.hint} />
                   <AvatarFallback>{sender.email?.charAt(0).toUpperCase()}</AvatarFallback>
                 </Avatar>
              )}
              <div className={cn(
                'max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-4 py-2',
                (msg as any).sender_id === currentUser.uid ? 'bg-primary text-primary-foreground' : 'bg-secondary'
              )}>
                {(msg as any).file?.url ? (
                  <div className="mb-2">
                    {(msg as any).file.mime?.startsWith('image') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={(msg as any).file.url} alt="attachment" className="max-h-48 w-auto rounded" />
                    ) : (
                      <video src={(msg as any).file.url} controls className="max-h-48 w-auto rounded" />
                    )}
                  </div>
                ) : null}
                <p className="text-sm">{(msg as any).text}</p>
                <p className="text-xs opacity-70 mt-1 text-right">{timestamp}</p>
              </div>
            </div>
          );
        })
      ) : (
         <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-2 font-semibold">No messages yet</h3>
              <p className="text-sm">Be the first to start the conversation!</p>
            </div>
          </div>
      )}
       <div ref={messagesEndRef} />
    </div>
  );
}

export function ChatLayout({ conversations, currentUser, defaultConversationId }: ChatLayoutProps) {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadCancelRef = useRef<(() => void) | null>(null);
  const { toast } = useToast();
  const [messagesRefreshKey, setMessagesRefreshKey] = useState(0);
  const [presenceMap, setPresenceMap] = useState<Record<string, any>>({});

  useEffect(() => {
    if (defaultConversationId) {
      const convo = conversations.find(c => c.id === defaultConversationId);
      if (convo) {
        setSelectedConversation(convo);
      }
    } else if (conversations.length > 0) {
      setSelectedConversation(null);
    }
  }, [defaultConversationId, conversations]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        try { URL.revokeObjectURL(previewUrl); } catch (e) { /* ignore */ }
      }
    };
  }, [previewUrl]);

  // Start presence heartbeat for current user
  useEffect(() => {
    let stopFn: any;
    const uid = (currentUser as any)?.uid ?? (currentUser as any)?.id;
    if (!uid) return;
    (async () => {
      try {
        stopFn = await startPresence(uid, { heartbeatMs: 30_000 });
      } catch (err) {
        console.error('startPresence failed', err);
      }
    })();
    return () => { if (stopFn) stopFn(); };
  }, [currentUser]);

  // Subscribe to presence changes globally and update presenceMap for participants
  useSupabaseRealtime('presence', (payload) => {
    const record = payload.record;
    if (!record) return;
    setPresenceMap((prev) => ({ ...prev, [record.user_id]: { online: record.online, last_seen: record.last_seen } }));
  }, { events: ['INSERT','UPDATE'] });

  // When selectedConversation changes, fetch presence for participants
  useEffect(() => {
    if (!selectedConversation) return;
    const participantIds = Object.values(selectedConversation.participants).map((p:any) => p.uid || p.id).filter(Boolean) as string[];
    (async () => {
      try {
        const pres = await fetchPresence(participantIds);
        const map: Record<string, any> = {};
        (pres || []).forEach((r:any) => { map[r.user_id] = { online: r.online, last_seen: r.last_seen }; });
        setPresenceMap((prev) => ({ ...prev, ...map }));
      } catch (err) {
        console.error('fetchPresence failed', err);
      }
    })();
  }, [selectedConversation]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;
    const messageText = newMessage;
    setNewMessage('');

    let fileMeta: any = null;
    if (attachedFile) {
      try {
        setUploadProgress(0);
        setUploadError(null);
        setIsUploading(true);
        const controller = uploadCancelable(attachedFile, undefined, undefined, (pct) => setUploadProgress(pct));
        uploadCancelRef.current = controller.cancel;
        const uploaded = await controller.promise;
        fileMeta = { url: uploaded.publicUrl, path: uploaded.path, mime: attachedFile.type };
        setUploadProgress(null);
        setIsUploading(false);
        uploadCancelRef.current = null;
      } catch (err) {
        console.error('Attachment upload failed', err);
        const msg = (err as any)?.message || 'Attachment upload failed.';
        setUploadError(msg);
        toast({ title: 'Upload Error', description: msg, variant: 'destructive' });
        setUploadProgress(null);
        setIsUploading(false);
        uploadCancelRef.current = null;
        return;
      }
    }

    try {
      const senderId = getUserId(currentUser);
      const recipient = Object.values(selectedConversation.participants).find((p:any) => (p.uid || p.id) !== senderId);
      const recipientId = getUserId(recipient);
      const { error: insertError } = await supabase.from('messages').insert([{
        conversation_id: selectedConversation.id,
        sender_id: senderId,
        recipient_id: recipientId,
        text: messageText,
        file: fileMeta || null
      }]);
      if (insertError) throw insertError;

      const { error: convError } = await supabase.from('conversations').update({ last_message_text: messageText, last_message_at: new Date().toISOString() }).eq('id', selectedConversation.id);
      if (convError) console.error('Failed to update conversation metadata', convError);

      // trigger child to refetch messages
      setMessagesRefreshKey(k => k + 1);
      // clear attached file & preview after sending
      setAttachedFile(null);
      if (previewUrl) {
        try { URL.revokeObjectURL(previewUrl); } catch (e) { /* ignore */ }
      }
      setPreviewUrl(null);
      if (fileInputRef.current) {
        try { (fileInputRef.current as HTMLInputElement).value = ''; } catch (e) { /* ignore */ }
      }
    } catch (err) {
      console.error('Error sending message', err);
      toast({ title: 'Send Error', description: 'Could not send message.', variant: 'destructive' });
    }
  }
  
  const getOtherParticipant = (convo: Conversation) => {
    return Object.values(convo.participants).find(p => p.uid !== currentUser.uid);
  }

  return (
    <div className="flex h-full border-t">
      <div className={cn(
        "w-full md:w-1/3 flex-shrink-0 border-r bg-card md:flex flex-col",
        selectedConversation && "hidden"
      )}>
        <div className="flex h-full flex-col">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search conversations" className="pl-10" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => {
              const otherUser = getOtherParticipant(conv);
              if (!otherUser) return null;

              const lastAt = conv.lastMessageAt;
              const date = lastAt ? (typeof lastAt === 'string' ? formatDistanceToNow(new Date(lastAt), { addSuffix: true }) : (lastAt as any).toDate ? formatDistanceToNow((lastAt as any).toDate(), { addSuffix: true }) : '') : '';

              return (
                <div
                  key={conv.id}
                  className={cn(
                    "flex items-center gap-3 p-4 cursor-pointer hover:bg-secondary/50",
                    selectedConversation?.id === conv.id && "bg-secondary"
                  )}
                  onClick={() => setSelectedConversation(conv)}
                >
                  <Avatar>
                    <AvatarImage src={otherUser.avatar.url} alt={otherUser.name} data-ai-hint={otherUser.avatar.hint}/>
                    <AvatarFallback>{otherUser.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-semibold truncate">{otherUser.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{conv.lastMessageText}</p>
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0">{date}</div>
                </div>
              );
            })}
             {conversations.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                    <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-2 font-semibold">No Conversations</h3>
                    <p className="text-sm">Contact a seller or another user to start a chat.</p>
                </div>
             )}
          </div>
        </div>
      </div>
      <div className={cn(
        "flex-1 flex-col",
        selectedConversation ? "flex" : "hidden md:flex"
      )}>
        {selectedConversation ? (
          <>
            <div className="flex items-center gap-3 p-4 border-b">
               <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedConversation(null)}>
                  <ArrowLeft className="h-5 w-5" />
               </Button>
              <Avatar>
                <AvatarImage src={getOtherParticipant(selectedConversation)?.avatar.url} alt={getOtherParticipant(selectedConversation)?.name} data-ai-hint={getOtherParticipant(selectedConversation)?.avatar.hint}/>
                <AvatarFallback>{getOtherParticipant(selectedConversation)?.email?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <h2 className="text-lg font-semibold">{getOtherParticipant(selectedConversation)?.name}</h2>
            </div>
            
            <ChatMessages conversation={selectedConversation} currentUser={currentUser} refreshKey={messagesRefreshKey} />

            <div className="p-4 border-t bg-card">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2" onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer?.files?.[0] ?? null; if (f) { setAttachedFile(f); setPreviewUrl(URL.createObjectURL(f)); } }} onDragOver={(e) => e.preventDefault()}>
                <input id="message-file" ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={(e) => { const f = e.target.files?.[0] ?? null; setAttachedFile(f); if (f) setPreviewUrl(URL.createObjectURL(f)); }} />
                <Button type="button" variant="ghost" size="icon" className="text-muted-foreground" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4" />
                </Button>
                {previewUrl && (
                  <div className="ml-2">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Remove attachment"
                      onClick={() => { setAttachedFile(null); if (previewUrl) { try { URL.revokeObjectURL(previewUrl); } catch (e) { } } setPreviewUrl(null); }}
                      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); setAttachedFile(null); if (previewUrl) { try { URL.revokeObjectURL(previewUrl); } catch (e) { } } setPreviewUrl(null); } }}
                      className="h-10 w-10 rounded overflow-hidden ring-1 ring-ring cursor-pointer"
                      title="Click or press Delete to remove attachment"
                    >
                      {attachedFile?.type?.startsWith('image') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewUrl as string} alt="preview" className="h-10 w-10 object-cover" />
                      ) : (
                        <video src={previewUrl as string} className="h-10 w-10 object-cover" controls playsInline muted />
                      )}
                    </div>
                  </div>
                )}
                {uploadProgress !== null && (
                  <div className="ml-2 w-28">
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
                        <Button variant="ghost" size="sm" onClick={() => { setUploadError(null); setUploadProgress(null); }}>
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                <Input 
                  placeholder="Type a message..." 
                  className="flex-1"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <Button type="submit" size="icon" className="bg-accent hover:bg-accent/90" disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="mx-auto h-16 w-16 text-muted-foreground/30"/>
              <h3 className="mt-4 text-lg font-semibold">Select a conversation</h3>
              <p className="mt-1 text-sm">Choose a conversation from the list to start chatting.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
