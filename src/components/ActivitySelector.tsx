import { useState, useMemo } from "react";
import { Search, Plus, Check, Clock, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ACTIVITY_CATEGORIES,
  searchActivities,
  getRecentActivities,
  type ActivityCategory,
  type ActivityItem,
} from "@/lib/activities-catalog";

type Props = {
  selectedActivity: string;
  onSelectActivity: (activityName: string) => void;
  customActivityName?: string;
  onChangeCustomName?: (name: string) => void;
};

export function ActivitySelector({
  selectedActivity,
  onSelectActivity,
  customActivityName = "",
  onChangeCustomName,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | "all">("all");
  const [isCustomMode, setIsCustomMode] = useState(selectedActivity === "Outro" || selectedActivity === "Outra");

  const recents = useMemo(() => getRecentActivities(), []);

  const searchResults = useMemo(() => {
    return searchActivities(searchTerm, selectedCategory);
  }, [searchTerm, selectedCategory]);

  const handleSelect = (name: string) => {
    setIsCustomMode(false);
    onSelectActivity(name);
  };

  const handlePickCustom = () => {
    setIsCustomMode(true);
    onSelectActivity("Outro");
  };

  return (
    <div className="space-y-3">
      {/* Busca Rápida */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          placeholder="Buscar esporte ou cardio (ex: vôlei, esteira, tênis, bike)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 text-xs sm:text-sm bg-background/50 focus-visible:ring-1"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Recentes Rápidos (quando não houver busca ativa) */}
      {!searchTerm && recents.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
            <Clock className="size-3" />
            <span>Mais usados</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recents.map((item) => {
              const isSelected = selectedActivity === item && !isCustomMode;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors border ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-secondary/40 text-foreground border-border/60 hover:bg-secondary hover:border-border"
                  }`}
                >
                  {isSelected && <Check className="size-3 shrink-0" />}
                  <span>{item}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtro por Categorias */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`shrink-0 rounded-full px-2.5 py-1 font-medium transition-colors border ${
            selectedCategory === "all"
              ? "bg-foreground text-background border-foreground font-semibold"
              : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground"
          }`}
        >
          Todas
        </button>
        {ACTIVITY_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors border ${
                active
                  ? "bg-foreground text-background border-foreground font-semibold"
                  : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Lista de Atividades Encontradas */}
      <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-card/40 p-1.5 space-y-0.5">
        {searchResults.map((item) => {
          const isSelected = selectedActivity === item.name && !isCustomMode;
          const catDef = ACTIVITY_CATEGORIES.find((c) => c.id === item.category);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.name)}
              className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-all ${
                isSelected
                  ? "bg-primary/15 text-primary font-semibold border border-primary/30"
                  : "text-foreground hover:bg-secondary/60"
              }`}
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-sm">{catDef?.icon ?? "⚡"}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{catDef?.name}</p>
                </div>
              </div>
              {isSelected ? (
                <Check className="size-4 text-primary shrink-0 ml-2" />
              ) : item.supportsDistance ? (
                <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">km/pace</span>
              ) : null}
            </button>
          );
        })}

        {searchResults.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <p>Nenhuma atividade encontrada para "{searchTerm}".</p>
            <p className="mt-1 text-[11px]">Você pode registrar como atividade personalizada abaixo.</p>
          </div>
        )}
      </div>

      {/* Opção de Atividade Customizada / Outra */}
      <div className="pt-1">
        {!isCustomMode ? (
          <button
            type="button"
            onClick={handlePickCustom}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Plus className="size-3.5" />
            Não encontrou? Criar outra atividade personalizada
          </button>
        ) : (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary flex items-center gap-1">
                <Sparkles className="size-3.5" />
                Atividade personalizada
              </span>
              <button
                type="button"
                onClick={() => setIsCustomMode(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Voltar à lista
              </button>
            </div>
            <Input
              type="text"
              placeholder="Digite o nome da modalidade (ex: Remo de Oceano, Touch Rugby...)"
              value={customActivityName}
              onChange={(e) => onChangeCustomName?.(e.target.value)}
              className="text-xs bg-background"
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  );
}
