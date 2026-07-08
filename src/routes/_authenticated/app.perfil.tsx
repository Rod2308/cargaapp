import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthedRoute } from "./route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

function calcAge(birth?: string | null) {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}


export const Route = createFileRoute("/_authenticated/app/perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { user, isTrainer } = AuthedRoute.useRouteContext();
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
    <div className="app-container max-w-2xl pt-8 sm:max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

      {isTrainer ? (
        <div className="card-soft mt-5 flex items-center gap-3 p-4">
          <div className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground text-lg">👨‍🏫</div>
          <div className="flex-1">
            <p className="font-semibold">Você é professor(a)</p>
            <p className="text-xs text-muted-foreground">Acesse a aba <b>Alunos</b> para vincular e enviar treinos.</p>
          </div>
        </div>
      ) : (
        profile.invite_code && (
          <div className="card-soft mt-5 p-4">
            <p className="text-eyebrow text-muted-foreground">Seu código de convite</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="font-display text-2xl font-black tracking-widest">{profile.invite_code}</p>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(profile.invite_code!);
                  toast.success("Código copiado");
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
              >
                Copiar
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Envie ao seu professor para receber treinos direto no app.</p>
          </div>
        )
      )}


      <div className="card-soft mt-6 space-y-5 p-5">
        <div className="space-y-1.5">
          <Label>Como podemos te chamar?</Label>
          <Input
            defaultValue={profile.display_name ?? ""}
            onBlur={(e) => e.target.value !== (profile.display_name ?? "") && update.mutate({ display_name: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Sexo biológico</Label>
            <Select value={profile.sex ?? undefined} onValueChange={(v) => update.mutate({ sex: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="feminino">Feminino</SelectItem>
                <SelectItem value="outro">Outro / prefiro não dizer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data de nascimento{profile.birth_date ? ` · ${calcAge(profile.birth_date)} anos` : ""}</Label>
            <Input
              type="date"
              defaultValue={profile.birth_date ?? ""}
              max={new Date().toISOString().slice(0, 10)}
              onBlur={(e) => e.target.value !== (profile.birth_date ?? "") && update.mutate({ birth_date: e.target.value || null })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Altura (cm)</Label>
            <Input
              type="number"
              step="0.1"
              min={100}
              max={250}
              defaultValue={profile.height_cm ?? ""}
              onBlur={(e) => {
                const n = e.target.value ? Number(e.target.value) : null;
                if (n !== profile.height_cm && (n === null || (n >= 100 && n <= 250))) update.mutate({ height_cm: n });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Peso (kg)</Label>
            <Input
              type="number"
              step="0.1"
              min={30}
              max={300}
              defaultValue={profile.weight_kg ?? ""}
              onBlur={(e) => {
                const n = e.target.value ? Number(e.target.value) : null;
                if (n !== profile.weight_kg && (n === null || (n >= 30 && n <= 300))) update.mutate({ weight_kg: n });
              }}
            />
          </div>
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
          <Label>Nível de atividade fora do treino</Label>
          <Select value={profile.activity_level ?? undefined} onValueChange={(v) => update.mutate({ activity_level: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sedentario">Sedentário (trabalho parado, pouca caminhada)</SelectItem>
              <SelectItem value="leve">Leve (caminhadas ocasionais)</SelectItem>
              <SelectItem value="moderado">Moderado (em pé / andando boa parte do dia)</SelectItem>
              <SelectItem value="ativo">Ativo (trabalho físico ou muitos passos)</SelectItem>
              <SelectItem value="muito_ativo">Muito ativo (trabalho braçal pesado)</SelectItem>
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
        <div className="space-y-1.5">
          <Label>Lesões, dores ou limitações</Label>
          <Textarea
            rows={3}
            placeholder="Ex.: dor lombar, tendinite no ombro direito, joelho sensível a agachamento profundo…"
            defaultValue={profile.injuries ?? ""}
            onBlur={(e) => e.target.value !== (profile.injuries ?? "") && update.mutate({ injuries: e.target.value || null })}
          />
          <p className="text-xs text-muted-foreground">O coach evita movimentos que agravem essas áreas.</p>
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
