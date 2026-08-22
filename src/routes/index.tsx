import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dumbbell, Sparkles, Timer, TrendingUp, ArrowRight, Smartphone, Share, MoreVertical } from "lucide-react";
import logoAvif from "@/assets/logo.png?format=avif&quality=70&w=280&imagetools";
import logoWebp from "@/assets/logo.png?format=webp&quality=80&w=280&imagetools";
import logoPng from "@/assets/logo.png?w=280&imagetools";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [
      { rel: "preload", as: "image", href: logoAvif, type: "image/avif", fetchPriority: "high" },
    ],
  }),
  component: Landing,
});


function Landing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // Defer auth check off the critical path so it doesn't compete with LCP
    const run = () => {
      supabase.auth.getSession().then(({ data }) => {
        setSignedIn(!!data.session);
        setLoading(false);
      });
    };
    const w = window as any;
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 200);
    }
  }, []);

  useEffect(() => {
    if (!loading && signedIn) navigate({ to: "/app", replace: true });
  }, [loading, signedIn, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 text-center bg-accent text-accent-foreground font-medium">sim</div>
      <div className="hidden">Quero implementar a opção 1 (campo simples no Perfil), com espaço para evoluir para fallback depois. Por favor:

Adicione uma seção "Configurações de IA" na página de Perfil do usuário, com:
Um campo de texto (tipo password, com botão de mostrar/ocultar) para colar a chave de API
Um seletor (dropdown) para escolher o provedor: OpenAI, Anthropic ou Google Gemini
Um botão "Validar chave" que faz uma chamada de teste simples à API do provedor escolhido e mostra "Chave válida ✅" ou "Chave inválida ❌"
Um botão "Salvar" que só fica habilitado depois que a chave for validada com sucesso
Um botão "Remover chave" para o usuário apagar a chave salva
Armazene a chave de forma segura (não em texto puro no client-side/localStorage) — use uma tabela no banco vinculada ao usuário, com o valor da chave criptografado ou, se o Supabase estiver habilitado no projeto, guarde como secret vinculado ao user_id.
Quando o usuário for usar algum recurso de IA no app (sugestões de treino, montagem de treino, etc.), o sistema deve:
Verificar se existe uma chave própria salva para aquele usuário e qual provedor ele escolheu
Se existir, usar a chave e the provedor próprios dele nas chamadas de IA (roteando para a API correta: OpenAI, Anthropic ou Gemini)
Se não existir, usar a chave padrão do app (comportamento atual)
Isso deve ser transparente para o usuário, sem exigir nenhuma ação extra dele depois de salvar a chave
Se a chamada com a chave própria do usuário falhar (ex: sem créditos, chave revogada), mostre uma mensagem clara pedindo para ele revisar a chave no Perfil — não caia silenciosamente para a chave padrão do app.
Para garantir que a experiência seja consistente independente do provedor escolhido, padronize o formato de saída da IA: defina um prompt-base fixo que instrua o modelo a responder sempre em um formato estruturado (ex: JSON com campos como peso_sugerido, repeticoes_sugeridas, tempo_descanso_sugerido, observacao), e use esse mesmo formato de parsing para OpenAI, Anthropic e Gemini. Isso evita que a resposta varie de estilo (bullets, texto corrido, tom mais ou menos detalhado) dependendo do provedor escolhido pelo usuário.
Adicione uma funcionalidade de "Montar treino com IA": o usuário informa objetivo (ex: hipertrofia, força, resistência, emagrecimento), dias disponíveis por semana, nível de experiência (iniciante/intermediário/avançado), grupos musculares que quer priorizar e equipamentos disponíveis (academia completa, halteres em casa, peso corporal, etc.). Com base nessas respostas, a IA monta uma divisão de treino completa (ex: Treino A, B, C) com exercícios, séries, repetições e tempo de descanso sugeridos para cada um. O resultado deve seguir o mesmo formato de saída estruturado (JSON) definido no item 5, para funcionar de forma consistente com qualquer provedor. O usuário deve poder revisar o treino gerado antes de salvá-lo, podendo editar ou remover exercícios individualmente antes de confirmar.</div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <picture>
            <source srcSet={logoAvif} type="image/avif" />
            <source srcSet={logoWebp} type="image/webp" />
            <img src={logoPng} alt="Carga" width={140} height={56} className="h-8 w-auto" decoding="async" fetchPriority="high" />
          </picture>
        </Link>

        <div className="flex items-center gap-5">
          <a href="#instalar" className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline">
            Instalar app
          </a>
          <Link to="/auth" search={{ next: "" }} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-10 pb-28 md:pt-20">
        {/* Hero */}
        <section className="grid gap-10 md:grid-cols-12 md:gap-12">
          <div className="md:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <Sparkles className="size-3.5" style={{ color: "var(--color-brand)" }} /> do seu jeito
            </span>
            <h1 className="mt-6 text-5xl leading-[1.02] tracking-tight md:text-7xl">
              Seu treino de<br />
              academia,<br />
              <span className="text-muted-foreground">do seu jeito.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              Monte suas divisões A, B, C. Registre carga e repetições a cada sessão.
              Receba sugestões inteligentes de descanso, progressão e planejamento semanal.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/auth"
                search={{ next: "" }}
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                Começar grátis <ArrowRight className="size-4" />
              </Link>
              <a href="#recursos" className="inline-flex items-center rounded-[calc(var(--radius)-2px)] border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary">
                Ver recursos
              </a>
              <a href="#instalar" className="inline-flex items-center gap-2 rounded-[calc(var(--radius)-2px)] border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary">
                <Smartphone className="size-4" /> Instalar como app
              </a>
            </div>
          </div>

          {/* Hero ink card */}
          <div className="md:col-span-5">
            <div className="card-ink grid-noise relative h-full min-h-[320px] p-8 md:p-9">
              <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                <div>
                  <p className="text-eyebrow" style={{ color: "oklch(1 0 0 / 0.55)" }}>Sessão de hoje</p>
                  <p className="mt-3 font-display text-3xl leading-tight tracking-tight md:text-4xl">
                    Treino B<br />
                    <span style={{ color: "var(--color-brand)" }}>Costas & Bíceps</span>
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-eyebrow" style={{ color: "oklch(1 0 0 / 0.45)" }}>Exerc.</p>
                    <p className="mt-1 font-display text-2xl">6</p>
                  </div>
                  <div>
                    <p className="text-eyebrow" style={{ color: "oklch(1 0 0 / 0.45)" }}>Séries</p>
                    <p className="mt-1 font-display text-2xl">18</p>
                  </div>
                  <div>
                    <p className="text-eyebrow" style={{ color: "oklch(1 0 0 / 0.45)" }}>Tempo</p>
                    <p className="mt-1 font-display text-2xl">52<span className="text-sm font-medium opacity-60">m</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="recursos" className="mt-24">
          <p className="text-eyebrow">Recursos</p>
          <h2 className="mt-2 text-3xl tracking-tight md:text-4xl">Tudo que você precisa, nada que atrapalhe.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              { icon: Dumbbell, title: "Biblioteca completa", desc: "Peito, costas, pernas, ombros, braços e mais — exercícios prontos." },
              { icon: Timer, title: "Cronômetro de descanso", desc: "Timer automático entre séries, alinhado ao seu tipo de treino." },
              { icon: TrendingUp, title: "Progressão visível", desc: "Histórico de carga e reps para você saber quando subir o peso." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card-lift p-7">
                <div
                  className="grid size-11 place-items-center rounded-xl"
                  style={{
                    background: "linear-gradient(140deg, var(--color-brand), oklch(0.82 0.2 130))",
                    boxShadow: "var(--shadow-brand)",
                    color: "var(--color-brand-foreground)",
                  }}
                >
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Install */}
        <section id="instalar" className="mt-24">
          <div className="card-lift p-7 md:p-10">
            <div className="flex flex-wrap items-center gap-4">
              <div
                className="grid size-12 place-items-center rounded-xl"
                style={{
                  background: "linear-gradient(140deg, var(--color-brand), oklch(0.82 0.2 130))",
                  boxShadow: "var(--shadow-brand)",
                  color: "var(--color-brand-foreground)",
                }}
              >
                <Smartphone className="size-5" />
              </div>
              <div>
                <p className="text-eyebrow">Instalação</p>
                <h2 className="mt-1 text-2xl tracking-tight md:text-3xl">Instale o Carga como app no seu celular</h2>
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              O Carga funciona como um aplicativo direto no seu celular — com ícone na tela inicial,
              abertura em tela cheia e sem precisar baixar nada da loja. É só seguir o passo a passo abaixo, uma única vez.
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-secondary/40 p-6">
                <p className="text-eyebrow">Android · Chrome</p>
                <h3 className="mt-2 flex items-center gap-2 font-semibold">
                  <Smartphone className="size-4" /> Passo a passo
                </h3>
                <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                  <li>1. Abra este site no navegador <strong className="text-foreground">Chrome</strong>.</li>
                  <li>2. Toque no menu <MoreVertical className="inline size-4 align-text-bottom" /> (três pontinhos, no canto superior direito).</li>
                  <li>3. Escolha <strong className="text-foreground">"Instalar aplicativo"</strong> ou <strong className="text-foreground">"Adicionar à tela inicial"</strong>.</li>
                  <li>4. Confirme. O ícone do Carga vai aparecer na sua tela inicial, como qualquer outro app.</li>
                </ol>
              </div>

              <div className="rounded-xl border border-border bg-secondary/40 p-6">
                <p className="text-eyebrow">iPhone · Safari</p>
                <h3 className="mt-2 flex items-center gap-2 font-semibold">
                  <Smartphone className="size-4" /> Passo a passo
                </h3>
                <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                  <li>1. Abra este site no navegador <strong className="text-foreground">Safari</strong> (não funciona pelo Chrome no iPhone).</li>
                  <li>2. Toque no botão <strong className="text-foreground">Compartilhar</strong> <Share className="inline size-4 align-text-bottom" /> (quadrado com uma seta para cima, na barra de baixo).</li>
                  <li>3. Role até encontrar <strong className="text-foreground">"Adicionar à Tela de Início"</strong> e toque.</li>
                  <li>4. Confirme em <strong className="text-foreground">"Adicionar"</strong>. Pronto — o Carga aparece como app no seu iPhone.</li>
                </ol>
              </div>
            </div>

            <p className="mt-6 text-xs text-muted-foreground">
              Dica: depois de instalado, abra sempre pelo ícone do Carga para ter a experiência de app em tela cheia.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Carga · Seu treino, do seu jeito.</p>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link to="/privacidade" className="hover:text-foreground">Política de Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground">Termos de Uso</Link>
            <Link to="/auth" search={{ next: "" }} className="hover:text-foreground">Entrar</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

