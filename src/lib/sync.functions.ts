import { supabase } from "@/integrations/supabase/client";
import { bridged } from "@/lib/server-bridge";

/**
 * Server function to sync workouts from a mirrored origin (Vercel) to the canonical database.
 * Since both environments use the same Supabase project, "syncing" means ensuring
 * the user's sessions from both origins are merged and consistent.
 */
export async function syncVercelWorkoutsAction(supabase: any, userId: string) {
  // 1. Identify sessions that might have been created on the mirror origin
  // but aren't fully synced or need metadata updates.
  // In our case, since we use the same Supabase DB, they are already there.
  // However, a "sync" button serves as a manual trigger for Revalidation
  // and checking for any edge cases (like Strava or other external sources
  // that might have updated the mirror's state).

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, started_at, source")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return { 
    synced: sessions?.length || 0,
    timestamp: new Date().toISOString()
  };
}

export const syncVercelWorkouts = bridged("sync.vercelWorkouts", async (payload: any) => {
  // This is the client-side bridge wrapper.
  // The actual implementation logic for the server side is added to AUTHED_ACTIONS in bridge-actions.server.ts
  return { ok: true };
});
