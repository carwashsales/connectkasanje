'use server';
/**
 * @fileOverview A flow for fetching a user's conversations from Firestore.
 * This flow acts as a trusted backend service to retrieve data, bypassing client-side security rule limitations.
 *
 * - getConversations - Fetches all conversations for a given user, along with participant data.
 * - GetConversationsInput - The input type for the getConversations function.
 * - GetConversationsOutput - The return type for the getConversations function.
 */

import { ai } from '@/ai/genkit';
import supabaseServer from '@/supabase/server-client';
import { z } from 'zod';
import type { UserProfile, Conversation } from '@/lib/types';


// == ZOD Schemas for Input/Output and data structures ==

const GetConversationsInputSchema = z.object({
  userId: z.string().describe('The UID of the user whose conversations should be fetched.'),
});
export type GetConversationsInput = z.infer<typeof GetConversationsInputSchema>;

// We use `any` for timestamps because they will be converted to strings.
const UserProfileSchema = z.object({
    id: z.string(),
    uid: z.string(),
    name: z.string(),
    email: z.string(),
    avatar: z.object({ url: z.string(), hint: z.string() }),
    bio: z.string(),
});

const ConversationSchema = z.object({
    id: z.string(),
    participantIds: z.array(z.string()),
    participants: z.record(UserProfileSchema),
    lastMessageText: z.string().optional(),
    lastMessageAt: z.string().optional(), // Timestamps are converted to ISO strings
});

const GetConversationsOutputSchema = z.object({
    currentUser: UserProfileSchema,
    conversations: z.array(ConversationSchema),
});

export type GetConversationsOutput = z.infer<typeof GetConversationsOutputSchema>;


// == Main exported function ==

export async function getConversations(input: GetConversationsInput): Promise<GetConversationsOutput> {
  return getConversationsFlow(input);
}


// == Genkit Flow Definition ==

const getConversationsFlow = ai.defineFlow(
  {
    name: 'getConversationsFlow',
    inputSchema: GetConversationsInputSchema,
    outputSchema: GetConversationsOutputSchema,
  },
  async ({ userId }) => {
    // 1. Fetch current user profile from profiles table.
    const { data: currentProfile, error: profileError } = await supabaseServer.from('profiles').select('id, username, full_name, avatar_url, bio, metadata').eq('id', userId).single();
    if (profileError) throw profileError;
    const currentUser = {
      id: currentProfile.id,
      uid: currentProfile.id,
      name: currentProfile.full_name ?? currentProfile.username ?? '',
      email: currentProfile.metadata?.email,
      avatar: { url: currentProfile.avatar_url ?? '', hint: '' },
      bio: currentProfile.bio ?? ''
    } as any;

    // 2. Fetch recent messages where the user is sender or recipient to discover conversation ids.
    const { data: messagesData, error: messagesError } = await supabaseServer
      .from('messages')
      .select('id, conversation_id, sender_id, recipient_id, text, created_at')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (messagesError) throw messagesError;

    const convoIdSet = new Set<string>();
    (messagesData || []).forEach((m: any) => { if (m.conversation_id) convoIdSet.add(m.conversation_id); });
    const convoIds = Array.from(convoIdSet);

    if (convoIds.length === 0) {
      return {
        currentUser: UserProfileSchema.parse(currentUser),
        conversations: [],
      };
    }

    // 3. Fetch latest message per conversation (we already have messages; group them)
    const msgsByConvo: Record<string, any[]> = {};
    (messagesData || []).forEach((m: any) => {
      if (!m.conversation_id) return;
      msgsByConvo[m.conversation_id] = msgsByConvo[m.conversation_id] || [];
      msgsByConvo[m.conversation_id].push(m);
    });

    // 4. Collect all participant ids across conversations.
    const allParticipantIds = new Set<string>();
    convoIds.forEach((cid) => {
      const msgs = msgsByConvo[cid] || [];
      msgs.forEach((m: any) => { allParticipantIds.add(m.sender_id); allParticipantIds.add(m.recipient_id); });
    });
    const uniqueParticipantIds = Array.from(allParticipantIds).filter(Boolean) as string[];

    // 5. Fetch profiles for participants in bulk.
    const { data: profilesData, error: profilesError } = await supabaseServer.from('profiles').select('id, username, full_name, avatar_url, bio, metadata').in('id', uniqueParticipantIds);
    if (profilesError) throw profilesError;
    const usersMap: Record<string, any> = {};
    (profilesData || []).forEach((p: any) => {
      usersMap[p.id] = {
        id: p.id,
        uid: p.id,
        name: p.full_name ?? p.username ?? '',
        email: p.metadata?.email,
        avatar: { url: p.avatar_url ?? '', hint: '' },
        bio: p.bio ?? ''
      };
    });
    if (!usersMap[userId]) usersMap[userId] = currentUser;

    // 6. Build conversation objects
    const finalConversations = convoIds.map((cid) => {
      const msgs = msgsByConvo[cid] || [];
      // Find latest message by created_at
      const latest = msgs.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const participantIds = Array.from(new Set(msgs.flatMap((m:any) => [m.sender_id, m.recipient_id]).filter(Boolean)));
      const participants: Record<string, any> = {};
      participantIds.forEach((id) => { if (usersMap[id]) participants[id] = usersMap[id]; });
      return {
        id: cid,
        participantIds,
        participants,
        lastMessageText: latest?.text ?? '',
        lastMessageAt: latest?.created_at ? new Date(latest.created_at).toISOString() : undefined,
      } as any;
    });

    return {
      currentUser: UserProfileSchema.parse(usersMap[userId]),
      conversations: z.array(ConversationSchema).parse(finalConversations),
    };
  }
);
