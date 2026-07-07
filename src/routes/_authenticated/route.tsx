import { createFileRoute, Outlet, redirect, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Dumbbell, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

const tabs = [
  { to: "/app", label: "Início", icon: Home },
  { to: "/app/treinos", label: "Treinos", icon: Dumbbell },
  { to: "/app/coach", label: "Coach", icon: Sparkles },
  { to: "/app/perfil", label: "Perfil", icon: User },
] as const;

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-24">
      <Outlet />
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}>
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = to === "/app" ? location.pathname === "/app" : location.pathname.startsWith(to);
            return (
              <button
                key={to}
                onClick={() => navigate({ to })}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "text-accent")} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
      <Link to="/app" className="sr-only">Início</Link>
    </div>
  );
}
