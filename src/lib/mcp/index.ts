import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listWorkouts from "./tools/list-workouts";
import getWorkout from "./tools/get-workout";
import upsertWorkoutExercise from "./tools/upsert-workout-exercise";
import listRecentSessions from "./tools/list-recent-sessions";
import logSleep from "./tools/log-sleep";
import listSleepLogs from "./tools/list-sleep-logs";

// Direct Supabase issuer (published apps rewrite SUPABASE_URL to the .lovable.cloud
// proxy, which mcp-js rejects). VITE_SUPABASE_PROJECT_ID is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "carga-mcp",
  title: "Carga — Treinos & Recuperação",
  version: "0.1.0",
  instructions:
    "Ferramentas para o app Carga: listar treinos do usuário, ver sessões recentes, e registrar/consultar sono. Todas operam como o usuário autenticado — respeitam as políticas de acesso do banco.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listWorkouts, getWorkout, listRecentSessions, logSleep, listSleepLogs],
});
