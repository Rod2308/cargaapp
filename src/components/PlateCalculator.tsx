import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { calcPlates, DEFAULT_BAR_KG } from "@/lib/plates";
import { Calculator } from "lucide-react";

const BAR_OPTIONS = [20, 15, 10, 7];

export function PlateCalculator({
  targetWeight,
  trigger,
}: {
  targetWeight?: number | null;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(String(targetWeight ?? ""));
  const [bar, setBar] = useState(String(DEFAULT_BAR_KG));

  const result = useMemo(() => {
    const t = Number(target.replace(",", "."));
    const b = Number(bar.replace(",", "."));
    if (!target.trim()) return null;
    return calcPlates(t, Number.isFinite(b) ? b : DEFAULT_BAR_KG);
  }, [target, bar]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && targetWeight) setTarget(String(targetWeight));
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" type="button">
            <Calculator className="size-4" />
            Anilhas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Calculadora de anilhas</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Peso alvo (kg)</Label>
            <Input
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Ex.: 80"
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs">Barra (kg)</Label>
            <div className="mt-1 flex gap-2">
              {BAR_OPTIONS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBar(String(b))}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    bar === String(b)
                      ? "border-primary bg-primary/10 font-semibold text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {b}
                </button>
              ))}
              <Input
                inputMode="decimal"
                value={bar}
                onChange={(e) => setBar(e.target.value)}
                className="h-8 w-20"
                aria-label="Peso da barra"
              />
            </div>
          </div>

          {result && (
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              {result.error ? (
                <p className="text-sm text-muted-foreground">{result.error}</p>
              ) : (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    De cada lado
                  </p>
                  {result.perSide.length === 0 ? (
                    <p className="text-sm">Só a barra ({bar} kg).</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {result.perSide.flatMap(({ plate, count }) =>
                        Array.from({ length: count }, (_, i) => (
                          <span
                            key={`${plate}-${i}`}
                            className="rounded-md bg-primary/10 px-2 py-1 text-sm font-bold text-primary"
                          >
                            {String(plate).replace(".", ",")}
                          </span>
                        )),
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Total montado: <strong>{String(result.achieved).replace(".", ",")} kg</strong>
                    {!result.exact && result.diff !== 0 && (
                      <> — faltam {String(Math.abs(result.diff)).replace(".", ",")} kg para o alvo</>
                    )}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
