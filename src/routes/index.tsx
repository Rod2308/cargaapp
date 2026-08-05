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
      <div className="hidden">{`Execute esta instrucao no projeto: # Sincronização de Treinos Registrados da Plataforma Vercel para Lovable

## Contexto

Os treinos são atualmente registrados e gerenciados na plataforma **Vercel**, que é considerada a fonte primária e oficial dos dados (source of truth). É crucial que esses registros sejam espelhados e estejam visíveis na plataforma **Lovable**, permitindo que os usuários visualizem e acompanhem seu progresso de forma consolidada.

## Problema Atual

Os usuários estão registrando seus treinos na interface ou no backend da plataforma Vercel. No entanto, esses treinos não estão sendo automaticamente sincronizados ou exibidos na plataforma Lovable. O relato do usuário é claro: "sincronize os treinos registrados no vercel, marquei por la e nao aparece aqui no lovable".

## Objetivo

Implementar um mecanismo robusto e amigável para sincronizar treinos registrados em Vercel para Lovable, garantindo a consistência e a disponibilidade dos dados para o usuário final.

## Funcionalidade Desejada e Melhorias de UI/UX e Web Design

### 1. Gatilho de Sincronização (UI/UX)

*   **Botão de Ação:** Adicionar um botão ou opção de menu clara no painel do usuário em Lovable, intitulado "Sincronizar Treinos do Vercel" ou "Atualizar Meus Treinos".
    *   **Localização:** Posicionar o botão de forma intuitiva, idealmente na seção de "Meus Treinos" ou "Configurações da Conta".
    *   **Acessibilidade:** Garantir que o botão seja fácil de encontrar e usar, com um bom contraste e texto legível.
*   **Sincronização Automática (Opcional):** Considerar a implementação de sincronização automática em intervalos regulares (e.g., diariamente, semanalmente) ou ao fazer login no Lovable para reduzir a necessidade de intervenção manual.

### 2. Feedback Visual e Mensagens ao Usuário (UI/UX)

*   **Estado de Carregamento:** Ao ativar a sincronização, exibir um indicador visual claro (ex: spinner de carregamento, barra de progresso) e uma mensagem informativa como "Sincronizando treinos com Vercel...".
*   **Mensagem de Sucesso:** Após a conclusão bem-sucedida, exibir uma notificação ou toast de confirmação (ex: "Treinos sincronizados com sucesso!" com um ícone de verificação) que desapareça automaticamente ou possa ser dispensado.
*   **Mensagem de Erro:** Em caso de falha na sincronização, apresentar uma mensagem de erro clara e acionável (ex: "Erro ao sincronizar treinos. Verifique sua conexão ou tente novamente mais tarde." ou "Não foi possível conectar ao Vercel. Verifique suas credenciais de integração.").
    *   **Detalhes do Erro:** Se possível e seguro, fornecer detalhes técnicos básicos para depuração, acessíveis apenas a desenvolvedores ou via console.

### 3. Lógica de Sincronização (Web Design / Backend)

*   **API Endpoint Dedicado:** Desenvolver um endpoint na API de Lovable (ex: \`POST /api/v1/sync/workouts-from-vercel\`) que será acionado pelo frontend.
*   **Autenticação e Autorização:**
    *   Garantir que apenas usuários autenticados e autorizados possam iniciar a sincronização para seus próprios dados.
    *   Se Vercel for um serviço externo, implementar um fluxo de autenticação seguro (ex: OAuth 2.0, chaves de API) para acessar os dados do usuário.
*   **Idempotência:** A lógica de sincronização deve ser idempotente. Isso significa que executar a sincronização várias vezes com os mesmos dados de origem não deve resultar em duplicatas.
    *   **Identificação Única:** Usar um identificador único fornecido por Vercel (ex: \`vercel_workout_id\`) para cada treino.
    *   **Verificação:** Antes de inserir um treino, verificar se um registro com o \`vercel_workout_id\` correspondente já existe no banco de dados de Lovable.
*   **Atualização vs. Inserção:**
    *   Se um treino com o \`vercel_workout_id\` já existe em Lovable, o registro existente deve ser atualizado com os dados mais recentes de Vercel.
    *   Caso contrário, o treino deve ser inserido como um novo registro.
*   **Tratamento de Conflitos:** Considerando que Vercel é a fonte da verdade, as alterações em Vercel sempre devem sobrescrever quaisquer dados conflitantes em Lovable, se aplicável.
*   **Mapeamento de Dados:** Definir um mapeamento claro e robusto entre os campos de dados de treino de Vercel e os campos correspondentes em Lovable (ex: \`date\`, \`duration\`, \`type\`, \`distance\`, \`calories_burned\`).
    *   Armazenar \`source_platform\` (e.g., 'Vercel') e \`source_id\` (o \`vercel_workout_id\`) em Lovable para rastreabilidade.
*   **Tratamento de Erros no Backend:** Implementar logging detalhado de erros e mecanismos de retry para chamadas à API de Vercel em caso de falhas transitórias.

### 4. Escalabilidade e Performance (Web Design / Backend)

*   A solução deve ser projetada para lidar com um volume crescente de treinos e usuários sem degradação significativa de performance.
*   Considerar paginação para buscar grandes conjuntos de dados de treinos da API de Vercel, evitando o carregamento de todos os dados de uma vez.
*   O processamento de dados (verificação de duplicatas, inserção/atualização) deve ser otimizado.

### 5. Notificações e Monitoramento (Opcional, UI/UX & Backend)

*   **Notificações de Falha:** Considerar enviar notificações ao usuário (ex: e-mail, notificação no aplicativo) se a sincronização automática falhar por um período prolongado.
*   **Monitoramento:** Implementar monitoramento no backend para rastrear o sucesso/falha das sincronizações e alertar a equipe de desenvolvimento sobre problemas sistêmicos.

## Exemplo de Fluxo de Interação

1.  **Usuário:** Navega até a seção "Meus Treinos" em Lovable.
2.  **Usuário:** Clica no botão "Sincronizar Treinos do Vercel".
3.  **Frontend (Lovable):** Exibe um spinner de carregamento e a mensagem "Sincronizando treinos com Vercel...".
4.  **Frontend (Lovable):** Faz uma requisição \`POST\` para \`/api/v1/sync/workouts-from-vercel\`.
5.  **Backend (Lovable):**
    *   Autentica a requisição do usuário.
    *   Faz chamadas à API de Vercel para buscar os treinos do usuário (possivelmente com filtros de data para otimização).
    *   Itera sobre os treinos recebidos:
        *   Para cada treino, verifica se \`vercel_workout_id\` já existe em Lovable.
        *   Se existe, atualiza o registro. Se não, insere um novo registro.
    *   Retorna um status (200 OK para sucesso, 4xx/5xx para erro).
6.  **Frontend (Lovable):**
    *   **Sucesso:** Oculta o spinner e exibe uma notificação "Treinos sincronizados com sucesso!".
    *   **Erro:** Oculta o spinner e exibe a mensagem de erro apropriada.
7.  **Usuário:** Visualiza os treinos atualizados na sua lista em Lovable.
`}</div>
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

