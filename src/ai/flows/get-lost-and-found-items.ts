'use server';
/**
 * @fileOverview A flow for fetching lost and found items from Firestore.
 * This flow acts as a trusted backend service to retrieve data, bypassing client-side security rule limitations on 'list' operations.
 *
 * - getLostAndFoundItems - Fetches all items from the 'lostAndFoundItems' collection.
 * - LostFoundItemOutput - The return type for the items.
 */

import { ai } from '@/ai/genkit';
import supabaseServer from '@/supabase/server-client';
import { z } from 'zod';

// Define the Zod schema for a single item, ensuring timestamps are converted to strings.
const LostFoundItemSchema = z.object({
  id: z.string(),
  type: z.enum(['lost', 'found']),
  name: z.string(),
  description: z.string(),
  location: z.string(),
  contact: z.string(),
  userId: z.string(),
  image: z.object({
    url: z.string(),
    hint: z.string(),
  }),
  createdAt: z.string(), // Timestamps will be converted to ISO strings.
});

// Define the output schema as an array of the item schema.
const GetLostAndFoundItemsOutputSchema = z.array(LostFoundItemSchema);
export type LostFoundItemOutput = z.infer<typeof LostFoundItemSchema>;


// Export the main function that the client will call.
export async function getLostAndFoundItems(): Promise<LostFoundItemOutput[]> {
  return getLostAndFoundItemsFlow();
}

// Define the Genkit flow.
const getLostAndFoundItemsFlow = ai.defineFlow(
  {
    name: 'getLostAndFoundItemsFlow',
    inputSchema: z.void(),
    outputSchema: GetLostAndFoundItemsOutputSchema,
  },
  async () => {
    const { data, error } = await supabaseServer
      .from('posts')
      .select('id, user_id, title, body, media, metadata, created_at')
      .filter('metadata->>type', 'in', `('lost','found')`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const items = (data || []).map((p: any) => ({
      id: p.id,
      type: p.metadata?.type,
      name: p.title,
      description: p.body,
      location: p.metadata?.location ?? '',
      contact: p.metadata?.contact ?? '',
      userId: p.user_id,
      image: { url: p.media?.url ?? '', hint: p.media?.path ?? '' },
      createdAt: new Date(p.created_at).toISOString(),
    })) as LostFoundItemOutput[];
    return items;
  }
);
