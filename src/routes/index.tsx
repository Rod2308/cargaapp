import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Sparkles, Timer, TrendingUp, ArrowRight, Smartphone, Share, MoreVertical } from "lucide-react";
import logoWebp from "@/assets/logo.png?format=webp&quality=80&w=280&imagetools";
import logoPng from "@/assets/logo.png?w=280&imagetools";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [
      { rel: "preload", as: "image", href: logoWebp, type: "image/webp", fetchpriority: "high" },
    ],
  }),
  component: Landing,
});


function Landing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!loading && signedIn) navigate({ to: "/app", replace: true });
  }, [loading, signedIn, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <picture>
            <source srcSet={logoWebp} type="image/webp" />
            <img src={logoPng} alt="Carga" width={140} height={56} className="h-8 w-auto" decoding="async" fetchPriority="high" />
          </picture>
        </Link>


        <div className="flex items-center gap-4">
          <a href="#instalar" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline">
            Instalar app
          </a>
          <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pt-8 pb-24 md:pt-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-accent" /> com coach de IA
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Seu treino de academia,<br />
            <span className="text-muted-foreground">do seu jeito.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
            Monte suas divisões A, B, C. Registre carga e repetições a cada sessão.
            Receba sugestões inteligentes de descanso, progressão e planejamento semanal.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
            >
              Começar grátis <ArrowRight className="size-4" />
            </Link>
            <a href="#recursos" className="inline-flex items-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-secondary">
              Ver recursos
            </a>
            <a href="#instalar" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-secondary">
              <Smartphone className="size-4" /> Instalar como app
            </a>
          </div>
        </div>

        <div id="recursos" className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            { icon: Dumbbell, title: "Biblioteca completa", desc: "Peito, costas, pernas, ombros, braços e mais — exercícios prontos." },
            { icon: Timer, title: "Cronômetro de descanso", desc: "Timer automático entre séries, alinhado ao seu tipo de treino." },
            { icon: TrendingUp, title: "Progressão visível", desc: "Histórico de carga e reps para você saber quando subir o peso." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card-soft p-6">
              <div className="grid size-10 place-items-center rounded-lg bg-secondary">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <section id="instalar" className="mt-20">
          <div className="card-soft p-6 md:p-8">
            <div className="flex items-center gap-2">
              <div className="grid size-10 place-items-center rounded-lg bg-secondary">
                <Smartphone className="size-5" />
              </div>
              <h2 className="text-xl font-semibold md:text-2xl">Instale o Carga como app no seu celular</h2>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              O Carga funciona como um aplicativo direto no seu celular — com ícone na tela inicial,
              abertura em tela cheia e sem precisar baixar nada da loja. É só seguir o passo a passo abaixo, uma única vez.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Smartphone className="size-4" /> No Android (Chrome)
                </h3>
                <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <li>1. Abra este site no navegador <strong>Chrome</strong>.</li>
                  <li>2. Toque no menu <MoreVertical className="inline size-4 align-text-bottom" /> (três pontinhos, no canto superior direito).</li>
                  <li>3. Escolha <strong>“Instalar aplicativo”</strong> ou <strong>“Adicionar à tela inicial”</strong>.</li>
                  <li>4. Confirme. O ícone do Carga vai aparecer na sua tela inicial, como qualquer outro app.</li>
                </ol>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Smartphone className="size-4" /> No iPhone (Safari)
                </h3>
                <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                  <li>1. Abra este site no navegador <strong>Safari</strong> (não funciona pelo Chrome no iPhone).</li>
                  <li>2. Toque no botão <strong>Compartilhar</strong> <Share className="inline size-4 align-text-bottom" /> (quadrado com uma seta para cima, na barra de baixo).</li>
                  <li>3. Role até encontrar <strong>“Adicionar à Tela de Início”</strong> e toque.</li>
                  <li>4. Confirme em <strong>“Adicionar”</strong>. Pronto — o Carga aparece como app no seu iPhone.</li>
                </ol>
              </div>
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              Dica: depois de instalado, abra sempre pelo ícone do Carga para ter a experiência de app em tela cheia.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
