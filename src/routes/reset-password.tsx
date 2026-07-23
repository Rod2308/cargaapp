import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dumbbell, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { passwordSchema } from "@/lib/validation";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha · Carga" },
      { name: "description", content: "Defina uma nova senha para sua conta Carga." },
      { property: "og:title", content: "Redefinir senha · Carga" },
      { property: "og:description", content: "Defina uma nova senha para sua conta Carga." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase envia tokens no hash (#access_token=...&type=recovery). O client detecta e cria a sessão.
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setReady(true);
    };
    // Aguarda um tick para o detectSessionInUrl processar
    const t = setTimeout(check, 300);
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(!!session);
        setReady(true);
      }
    });
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Senha inválida.");
    if (password !== confirm) return toast.error("As senhas não coincidem.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    setBusy(false);
    if (error) return toast.error(error.message || "Não foi possível redefinir a senha.");
    toast.success("Senha redefinida! Você já está conectado.");
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 self-start">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Dumbbell className="size-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Carga</span>
        </Link>

        <h1 className="text-2xl font-bold">Redefinir senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">Escolha uma nova senha para sua conta.</p>

        {!ready ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Validando link…
          </div>
        ) : !hasSession ? (
          <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Link inválido ou expirado</p>
            <p className="mt-1 text-muted-foreground">
              Solicite um novo link de redefinição na página de login.
            </p>
            <Link to="/auth" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input
                type={show ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={busy} className="h-11 w-full">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
