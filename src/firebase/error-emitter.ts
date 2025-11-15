'use client';

// No-op event emitter maintained during migration. Consumers may continue
// to call on/off/emit without requiring the Firebase SDK.
// Error emitter removed during migration. Replace usage with a project event
// bus or Supabase notifications if you still need cross-cutting events.
export {};
