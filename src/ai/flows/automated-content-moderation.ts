'use server';
/**
 * @fileOverview AI content moderation flow.
 *
 * - moderateContent - A function that moderates user-generated content.
 * - ModerateContentInput - The input type for the moderateContent function.
 * - ModerateContentOutput - The return type for the moderateContent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ModerateContentInputSchema = z.object({
  text: z.string().describe('The text content to be moderated.'),
});
export type ModerateContentInput = z.infer<typeof ModerateContentInputSchema>;

const ModerateContentOutputSchema = z.object({
  isAppropriate: z.boolean().describe('Whether the content is appropriate or not.'),
  reason: z.string().describe('The reason for the moderation decision.'),
});
export type ModerateContentOutput = z.infer<typeof ModerateContentOutputSchema>;

export async function moderateContent(input: ModerateContentInput): Promise<ModerateContentOutput> {
  return moderateContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'moderateContentPrompt',
  input: {schema: ModerateContentInputSchema},
  output: {schema: ModerateContentOutputSchema},
  prompt: `You are an AI content moderation tool that automatically scans user-generated content for inappropriate material.

  Your goal is to maintain a safe and respectful community environment.
  Content will be flagged for review, if deemed inappropriate.

  Analyze the following text content and determine if it is appropriate based on community guidelines:

  Text: {{{text}}}

  Respond with a JSON object that contains the following keys:
  - isAppropriate (boolean): true if the content is appropriate, false if it is not.
  - reason (string): A brief explanation for why the content is considered inappropriate, or a confirmation that it is appropriate.
  `,
});

const moderateContentFlow = ai.defineFlow(
  {
    name: 'moderateContentFlow',
    inputSchema: ModerateContentInputSchema,
    outputSchema: ModerateContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
