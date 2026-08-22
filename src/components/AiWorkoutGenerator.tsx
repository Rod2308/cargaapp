import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Check, X, Dumbbell, History, Target, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { generateWorkoutPlan } from "@/lib/ai-workout.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const MUSCLE_GROUPS = [
  "Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Pernas", "Glúteos", "Panturrilha", "Abdômen"
];

export function AiWorkoutGenerator({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    goal: "",
    daysPerWeek: 3,
    experienceLevel: "intermediate" as "beginner" | "intermediate" | "advanced",
    priorities: [] as string[],
    equipment: "gym" as "gym" | "dumbbells" | "bodyweight",
  });
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const qc = useQueryClient();

  const generate = useMutation({
    mutationFn: (data: typeof formData) => generateWorkoutPlan({ data }),
    onSuccess: (data) => {
      setGeneratedPlan(data);
      setStep(3);
    },
    onError: (e: any) => toast.error(`Erro ao gerar treino: ${e.message}`),
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!generatedPlan) return;
      
      const { data: workouts } = await supabase
        .from("workouts")
        .select("order_idx")
        .eq("user_id", userId)
        .order("order_idx", { ascending: false });
      
      let lastIdx = (workouts?.[0]?.order_idx ?? -1) + 1;

      for (const w of generatedPlan.workouts) {
        const { data: newWorkout, error: wErr } = await supabase
          .from("workouts")
          .insert({
            user_id: userId,
            name: w.name,
            label: String.fromCharCode(65 + lastIdx), // Simplistic label A, B, C...
            order_idx: lastIdx++,
          })
          .select()
          .single();
        
        if (wErr) throw wErr;

        if (w.exercises?.length) {
          const { error: eErr } = await supabase
            .from("workout_exercises")
            .insert(w.exercises.map((ex: any, idx: number) => ({
              workout_id: newWorkout.id,
              exercise_id: null, // AI provides names, matching can be manual or we could try lookup
              name: ex.name,
              sets: ex.sets,
              reps: String(ex.reps),
              rest_seconds: ex.rest,
              muscle_group: ex.muscle_group,
              order_idx: idx,
            })));
          if (eErr) throw eErr;
        }
      }
    },
    onSuccess: () => {
      toast.success("Plano de treino salvo com sucesso!");
      qc.invalidateQueries({ queryKey: ["workouts", userId] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reset = () => {
    setStep(1);
    setFormData({
      goal: "",
      daysPerWeek: 3,
      experienceLevel: "intermediate",
      priorities: [],
      equipment: "gym",
    });
    setGeneratedPlan(null);
  };

  const handlePriorityToggle = (muscle: string) => {
    setFormData(prev => ({
      ...prev,
      priorities: prev.priorities.includes(muscle)
        ? prev.priorities.filter(m => m !== muscle)
        : [...prev.priorities, muscle]
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2 text-brand">
          <Sparkles className="size-4" /> IA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-brand" /> Montar treino com IA
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Target className="size-4" /> Qual seu objetivo?</Label>
              <Input 
                placeholder="Ex: Hipertrofia, emagrecimento, força..." 
                value={formData.goal}
                onChange={e => setFormData(p => ({ ...p, goal: e.target.value }))}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Calendar className="size-4" /> Dias por semana</Label>
                <Select 
                  value={String(formData.daysPerWeek)} 
                  onValueChange={v => setFormData(p => ({ ...p, daysPerWeek: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7].map(n => <SelectItem key={n} value={String(n)}>{n} dias</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><History className="size-4" /> Nível</Label>
                <Select 
                  value={formData.experienceLevel} 
                  onValueChange={v => setFormData(p => ({ ...p, experienceLevel: v as any }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Iniciante</SelectItem>
                    <SelectItem value="intermediate">Intermediário</SelectItem>
                    <SelectItem value="advanced">Avançado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Dumbbell className="size-4" /> Equipamentos</Label>
              <Select 
                value={formData.equipment} 
                onValueChange={v => setFormData(p => ({ ...p, equipment: v as any }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gym">Academia completa</SelectItem>
                  <SelectItem value="dumbbells">Halteres em casa</SelectItem>
                  <SelectItem value="bodyweight">Peso corporal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full mt-4" onClick={() => setStep(2)} disabled={!formData.goal}>Próximo</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <Label>Priorizar grupos musculares (opcional)</Label>
            <div className="grid grid-cols-2 gap-2">
              {MUSCLE_GROUPS.map(muscle => (
                <div key={muscle} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`muscle-${muscle}`} 
                    checked={formData.priorities.includes(muscle)}
                    onCheckedChange={() => handlePriorityToggle(muscle)}
                  />
                  <Label htmlFor={`muscle-${muscle}`} className="cursor-pointer">{muscle}</Label>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Voltar</Button>
              <Button 
                className="flex-2 gap-2" 
                onClick={() => generate.mutate(formData)}
                disabled={generate.isPending}
              >
                {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Gerar Treino
              </Button>
            </div>
          </div>
        )}

        {step === 3 && generatedPlan && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="font-bold text-lg">{generatedPlan.name}</h3>
              <p className="text-sm text-muted-foreground">{generatedPlan.description}</p>
            </div>
            
            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
              {generatedPlan.workouts.map((w: any, idx: number) => (
                <div key={idx} className="space-y-2">
                  <h4 className="font-semibold border-b pb-1 text-brand">{w.name}</h4>
                  <div className="space-y-1">
                    {w.exercises.map((ex: any, eIdx: number) => (
                      <div key={eIdx} className="text-sm grid grid-cols-[1fr_auto] gap-2 items-center py-1">
                        <div>
                          <p className="font-medium">{ex.name}</p>
                          <p className="text-xs text-muted-foreground">{ex.sets}x{ex.reps} · {ex.rest}s descanso</p>
                        </div>
                        <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground uppercase">
                          {ex.muscle_group}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Tentar outro</Button>
              <Button 
                className="flex-2 gap-2" 
                onClick={() => savePlan.mutate()}
                disabled={savePlan.isPending}
              >
                {savePlan.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Salvar Plano
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
