import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { Trophy, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

const MAX_RETRO_DAYS = 90;

export const CARDIO_SPORT_ACTIVITIES = [
  "Caminhada",
  "Corrida",
  "Esteira",
  "Bicicleta",
  "Bike indoor",
  "Elíptico",
  "Escada",
  "Natação",
  "Futebol",
  "Futsal",
  "Padel",
  "Tênis",
  "Basquete",
  "Vôlei",
  "Cardio da academia",
  "Outro",
] as const;

export type IntensityLevel = "leve" | "moderada" | "intensa" | "";

const INTENSITY_RPE_MAP: Record<string, number> = {
  leve: 3,
  moderada: 6,
  intensa: 9,
};

type Props = {
  userId: string;
  defaultDate?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
};

export function CardioSportForm({
  userId,
  defaultDate,
  onSuccess,
  onCancel,
  onBack,
}: Props) {
  const qc = useQueryClient();

  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const minStr = useMemo(() => format(subDays(new Date(), MAX_RETRO_DAYS), "yyyy-MM-dd"), []);

  const [activity, setActivity] = useState<string>("Esteira");
  const [customName, setCustomName] = useState<string>("");
  const [durationMin, setDurationMin] = useState<string>("30");
  const [dateStr, setDateStr] = useState<string>(defaultDate || todayStr);
  const [distanceKm, setDistanceKm] = useState<string>("");
  const [intensity, setIntensity] = useState<IntensityLevel>("");
  const [notes, setNotes] = useState<string>("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const finalName = activity === "Outro" ? customName.trim() : activity;
      if (!finalName) throw new Error("Informe o nome da atividade");

      const dur = Number(durationMin);
      if (!dur || dur <= 0 || !Number.isFinite(dur)) {
        throw new Error("Informe uma duração válida em minutos");
      }

      if (!dateStr) throw new Error("Selecione a data");
      if (dateStr > todayStr) throw new Error("Não é possível registrar atividades em datas futuras");
      if (dateStr < minStr) throw new Error(`Só é possível registrar atividades dos últimos ${MAX_RETRO_DAYS} dias`);

      const startedAt = new Date(`${dateStr}T12:00:00`);
      const endedAt = new Date(startedAt.getTime() + dur * 60_000);

      const parsedDistance = distanceKm ? parseFloat(distanceKm.replace(",", ".")) : null;
      const distanceM = parsedDistance && Number.isFinite(parsedDistance) && parsedDistance > 0
        ? Math.round(parsedDistance * 1000)
        : null;

      const rpe = intensity ? INTENSITY_RPE_MAP[intensity] ?? null : null;

      // Monta observação estruturada com intensidade se informada
      const intensityLabel = intensity === "leve" ? "Leve" : intensity === "moderada" ? "Moderada" : intensity === "intensa" ? "Intensa" : null;
      const finalNotes = notes.trim()
        ? (intensityLabel ? `${notes.trim()} (Intensidade: ${intensityLabel})` : notes.trim())
        : (intensityLabel ? `Intensidade: ${intensityLabel}` : null);

      // Determina tipo de atividade
      const isSportCategory = ["Futebol", "Futsal", "Padel", "Tênis", "Basquete", "Vôlei"].includes(finalName);
      const activityType = isSportCategory ? "sport" : "cardio";

      const { data: session, error: sErr } = await supabase
        .from("sessions")
        .insert({
          user_id: userId,
          workout_id: null,
          title: finalName,
          activity_type: activityType,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          distance_m: distanceM,
          perceived_effort: rpe,
          notes: finalNotes,
          source: "manual",
        })
        .select()
        .single();

      if (sErr) throw sErr;

      // Vincula opcionalmente em exercises / session_sets para histórico retrocompatível
      try {
        const { data: existingEx } = await supabase
          .from("exercises")
          .select("id")
          .eq("name", finalName)
          .maybeSingle();

        let exerciseId = existingEx?.id;

        if (!exerciseId) {
          const { data: newEx } = await supabase
            .from("exercises")
            .insert({
              name: finalName,
              muscle_group: isSportCategory ? "Esportes" : "Cardio",
              is_default: false,
              created_by: userId,
            })
            .select("id")
            .single();
          exerciseId = newEx?.id;
        }

        if (exerciseId) {
          await supabase.from("session_sets").insert({
            session_id: session.id,
            exercise_id: exerciseId,
            set_number: 1,
            reps: dur,
            completed_at: endedAt.toISOString(),
            rpe: rpe,
            notes: finalNotes,
          });
        }
      } catch (err) {
        console.warn("[CardioSportForm] Falha não impeditiva ao registrar set extra:", err);
      }

      return session;
    },
    onSuccess: () => {
      toast.success("Atividade registrada com sucesso!");
      qc.invalidateQueries({ queryKey: ["recovery"] });
      qc.invalidateQueries({ queryKey: ["recent-sessions"] });
      qc.invalidateQueries({ queryKey: ["month-sessions"] });
      qc.invalidateQueries({ queryKey: ["history-sessions"] });
      qc.invalidateQueries({ queryKey: ["last7-sessions"] });
      qc.invalidateQueries({ queryKey: ["sports"] });
      onSuccess?.();
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao registrar atividade");
    },
  });

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Trocar modalidade
        </button>
      )}

      {/* Atividade */}
      <div>
        <Label className="text-xs font-semibold">Atividade *</Label>
        <Select value={activity} onValueChange={setActivity}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Escolha a atividade" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {CARDIO_SPORT_ACTIVITIES.map((act) => (
              <SelectItem key={act} value={act}>
                {act}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activity === "Outro" && (
        <div>
          <Label className="text-xs font-semibold">Nome da atividade *</Label>
          <Input
            type="text"
            placeholder="Ex: Remo indoor, Muay Thai, etc."
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="mt-1"
          />
        </div>
      )}

      {/* Duração e Data */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold">Duração (min) *</Label>
          <Input
            type="number"
            min={1}
            max={600}
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
            className="mt-1"
            placeholder="30"
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Data *</Label>
          <Input
            type="date"
            value={dateStr}
            min={minStr}
            max={todayStr}
            onChange={(e) => setDateStr(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Distância e Intensidade */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold">Distância (km)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            placeholder="Ex: 3.5"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Intensidade</Label>
          <Select value={intensity} onValueChange={(v) => setIntensity(v as IntensityLevel)}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Opcional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="leve">Leve</SelectItem>
              <SelectItem value="moderada">Moderada</SelectItem>
              <SelectItem value="intensa">Intensa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Observações */}
      <div>
        <Label className="text-xs font-semibold">Observação</Label>
        <Textarea
          placeholder="Ex: 20 min de esteira após o treino, ritmo leve..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 resize-none text-xs"
        />
      </div>

      {/* Ações */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={saveMutation.isPending}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="gap-2 shadow-soft font-semibold"
        >
          <Trophy className="size-4" />
          {saveMutation.isPending ? "Registrando..." : "Registrar atividade"}
        </Button>
      </div>
    </div>
  );
}
