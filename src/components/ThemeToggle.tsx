import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

/**
 * Compact three-way theme switch (light / system / dark).
 * Smooth transitions come from the global `color-scheme` change and CSS
 * variables — no per-element animation needed.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Claro", Icon: Sun },
    { value: "system", label: "Sistema", Icon: Monitor },
    { value: "dark", label: "Escuro", Icon: Moon },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-card/80 p-0.5 backdrop-blur",
        className,
      )}
    >
      {options.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

/** Simple one-shot toggle for compact spots. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { effective, toggle } = useTheme();
  const Icon = effective === "dark" ? Sun : Moon;
  return (
    <button
      onClick={toggle}
      aria-label={effective === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      className={cn(
        "flex size-9 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-soft backdrop-blur transition-all hover:scale-105",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
