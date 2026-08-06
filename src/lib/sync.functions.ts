import { supabase } from "@/integrations/supabase/client";
import { bridged } from "@/lib/server-bridge";

export async function syncVercelWorkoutsAction(supabase: any, userId: string) {
  // A sincronização real agora é feita no client-side via flush() da fila offline.
  // Esta action apenas confirma conectividade com o backend.
  return { 
    synced: true,
    timestamp: new Date().toISOString(),
    platform: "Vercel -> Lovable"
  };
}

export const syncVercelWorkouts = bridged("sync.vercelWorkouts", async (payload: any) => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  
  const result = await syncVercelWorkoutsAction(supabase, user.id);
  return result;
});
