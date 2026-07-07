import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { user } = AuthedRoute.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!profile) return <div className="p-8 text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="mx-auto max-w-md px-5 pt-8">
      <h1 className="text-3xl font-bold tracking-tight">Perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

      <div className="card-soft mt-6 space-y-5 p-5">
        <div className="space-y-1.5">
          <Label>Como podemos te chamar?</Label>
          <Input
            defaultValue={profile.display_name ?? ""}
            onBlur={(e) => e.target.value !== (profile.display_name ?? "") && update.mutate({ display_name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Nível de experiência</Label>
          <Select value={profile.experience_level ?? "iniciante"} onValueChange={(v) => update.mutate({ experience_level: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="iniciante">Iniciante (0-1 ano)</SelectItem>
              <SelectItem value="intermediario">Intermediário (1-3 anos)</SelectItem>
              <SelectItem value="avancado">Avançado (3+ anos)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Objetivo principal</Label>
          <Select value={profile.goal ?? "hipertrofia"} onValueChange={(v) => update.mutate({ goal: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hipertrofia">Hipertrofia (ganho de massa)</SelectItem>
              <SelectItem value="forca">Força</SelectItem>
              <SelectItem value="emagrecimento">Emagrecimento</SelectItem>
              <SelectItem value="condicionamento">Condicionamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Frequência semanal (dias)</Label>
          <Input
            type="number"
            min={1}
            max={7}
            defaultValue={profile.weekly_frequency ?? 4}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= 7 && n !== profile.weekly_frequency) update.mutate({ weekly_frequency: n });
            }}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
          <div>
            <p className="text-sm font-medium">Uso recursos ergogênicos</p>
            <p className="text-xs text-muted-foreground">Ajusta as sugestões do coach</p>
          </div>
          <Switch
            checked={!!profile.uses_enhancers}
            onCheckedChange={(v) => update.mutate({ uses_enhancers: v })}
          />
        </div>
      </div>

      <Button variant="outline" onClick={signOut} className="mt-6 w-full">
        <LogOut className="size-4" /> Sair da conta
      </Button>
    </div>
  );
}
