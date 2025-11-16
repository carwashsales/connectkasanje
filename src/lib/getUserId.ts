// Utility to consistently extract an ID string from various user/profile shapes
export function getUserId(user: any): string | null {
  if (!user) return null;
  // common shapes: Supabase auth user { id }, legacy { uid }, or profile { id, uid }
  return user.id ?? user.uid ?? user.user_id ?? null;
}

export default getUserId;
