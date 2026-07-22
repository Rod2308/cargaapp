import { createFileRoute, Outlet, redirect, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, Dumbbell, MessageCircle, User, History, Users, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { ensureWebPushSubscribed } from "@/lib/web-push-client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { next: "" } });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const isTrainer = (roles ?? []).some((r: { role: string }) => r.role === "trainer");
    return { user: data.user, isTrainer };
  },
  component: Layout,
});

function Layout() {
  const { user, isTrainer } = Route.useRouteContext();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    // initial unread count
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .is("read_at", null)
      .then(({ count }) => {
        if (active && typeof count === "number") setUnread(count);
      });

    const channel = supabase
      .channel(`msgs-notify-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
        async (payload) => {
          const msg = payload.new as { sender_id: string; content: string };
          // fetch sender name
          const { data: sender } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", msg.sender_id)
            .maybeSingle();
          const name = sender?.display_name ?? "Alguém";
          const onMessagesPage = location.pathname.startsWith("/app/mensagens");
          if (!onMessagesPage) {
            setUnread((n) => n + 1);
            toast(`Nova mensagem de ${name}`, {
              description: msg.content.slice(0, 80),
              action: {
                label: "Abrir",
                onClick: () => navigate({ to: "/app/mensagens" }),
              },
            });
          }
          queryClient.invalidateQueries();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
        () => {
          // refresh unread count when messages get marked read
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("receiver_id", user.id)
            .is("read_at", null)
            .then(({ count }) => {
              if (typeof count === "number") setUnread(count);
            });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user.id, location.pathname, navigate, queryClient]);

  // clear badge when navigating to messages
  useEffect(() => {
    if (location.pathname.startsWith("/app/mensagens")) setUnread(0);
  }, [location.pathname]);

  const tabs = [
    { to: "/app", label: "Início", icon: Home },
    { to: "/app/treinos", label: "Treinos", icon: Dumbbell },
    ...(isTrainer ? [{ to: "/app/alunos", label: "Alunos", icon: Users }] : []),
    { to: "/app/historico", label: "Histórico", icon: History },
    { to: "/app/grupos", label: "Grupos", icon: Trophy },
    { to: "/app/mensagens", label: "Mensagens", icon: MessageCircle },
    { to: "/app/perfil", label: "Perfil", icon: User },
  ] as const;
  return (
    <div className="min-h-screen bg-background pb-28">
      <Outlet />
      <ThemeToggleButton
        className="fixed right-3 z-40"
      />
      <style>{`.fixed.right-3.z-40{top:calc(env(safe-area-inset-top, 0px) + 12px);}`}</style>
      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 sm:px-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}>
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-1 rounded-full border border-border bg-card/95 p-1.5 shadow-lift backdrop-blur-md sm:max-w-lg">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = to === "/app" ? location.pathname === "/app" : location.pathname.startsWith(to);
            const showBadge = to === "/app/mensagens" && unread > 0;
            return (
              <button
                key={to}
                onClick={() => navigate({ to })}
                className={cn(
                  "relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold transition-all",
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-4 shrink-0" />
                  {showBadge && (
                    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
                {active && <span className="font-display">{label}</span>}
              </button>
            );
          })}
        </div>
      </nav>
      <Link to="/app" className="sr-only">Início</Link>
    </div>
  );
}
