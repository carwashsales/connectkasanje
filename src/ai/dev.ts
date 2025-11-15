'use server';
/**
 * @fileOverview Development entry point for Genkit.
 *
 * This file should not be included in production builds. It is used to
 * explicitly register all flows for the Genkit development server.
 */

import { config } from 'dotenv';
config();

import '@/ai/flows/automated-content-moderation.ts';
import '@/ai/flows/get-lost-and-found-items.ts';
import '@/ai/flows/get-conversations.ts';
import '@/ai/flows/get-users.ts';
