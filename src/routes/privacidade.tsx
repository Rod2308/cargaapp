import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Carga" },
      {
        name: "description",
        content:
          "Como o Carga coleta, usa, armazena e protege seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD).",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: PrivacyPage,
});

const CONTROLLER = "{{RAZAO_SOCIAL}}"; // ex.: "Carga Tecnologia LTDA"
const CNPJ = "{{CNPJ}}"; // ex.: "00.000.000/0001-00"
const DPO_EMAIL = "{{EMAIL_ENCARREGADO}}"; // ex.: "privacidade@cargaapp.com"

const UPDATED_AT = "11 de julho de 2026";

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold tracking-tight md:text-2xl">
        <span className="text-muted-foreground">{n}.</span> {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
        {children}
      </div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="text-sm font-semibold">← Carga</Link>
        <Link to="/termos" className="text-sm text-muted-foreground hover:text-foreground">Termos</Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <p className="text-eyebrow">LGPD · Lei 13.709/2018</p>
        <h1 className="mt-3 text-4xl leading-tight tracking-tight md:text-5xl">
          Política de Privacidade
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Última atualização: {UPDATED_AT}</p>

        <Section n="1" title="Quem somos">
          <p>
            O Carga é operado por <strong className="text-foreground">{CONTROLLER}</strong>,
            inscrita no CNPJ <strong className="text-foreground">{CNPJ}</strong>, atuando
            como <em>controladora</em> dos dados pessoais tratados nesta aplicação, nos
            termos do art. 5º, VI da LGPD.
          </p>
          <p>
            Encarregado pelo tratamento de dados (DPO):{" "}
            <a className="underline underline-offset-2" href={`mailto:${DPO_EMAIL}`}>
              {DPO_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section n="2" title="Quais dados coletamos">
          <p>Coletamos apenas o que é necessário para o funcionamento do serviço:</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong className="text-foreground">Cadastro:</strong> nome, e-mail e senha (ou identificação Google, se você optar por esse login).
            </li>
            <li>
              <strong className="text-foreground">Perfil de treino:</strong> sexo biológico, data de nascimento, altura, peso, cidade, contato profissional (opcional para treinadores).
            </li>
            <li>
              <strong className="text-foreground">Dados de saúde e bem-estar</strong> (categoria "sensível", art. 5º II LGPD): registros de treino, carga, repetições, sono, dor ou limitação relatada, fase do ciclo menstrual (opcional).
            </li>
            <li>
              <strong className="text-foreground">Comunicação:</strong> mensagens trocadas entre aluno e treinador dentro da plataforma.
            </li>
            <li>
              <strong className="text-foreground">Arquivos importados:</strong> se você importar treinos de dispositivos (.fit, .gpx, .tcx), extraímos duração, distância, frequência cardíaca média e calorias — a leitura é feita no seu navegador; nunca enviamos o arquivo bruto para nossos servidores.
            </li>
            <li>
              <strong className="text-foreground">Dados técnicos mínimos:</strong> identificador de sessão de autenticação (armazenado no seu próprio navegador via <code>localStorage</code>), registros de erro anonimizados para depuração.
            </li>
          </ul>
          <p>
            <strong className="text-foreground">Não usamos</strong> cookies de rastreamento, pixels de anúncio, Google Analytics, Meta Pixel ou ferramentas similares.
          </p>
        </Section>

        <Section n="3" title="Para que usamos seus dados">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Executar o contrato — permitir o uso das funcionalidades do app (base legal: art. 7º V LGPD).</li>
            <li>Gerar sugestões de recuperação, descanso e intensidade com base nos seus dados (execução de contrato + consentimento para dados sensíveis, art. 11 II "a").</li>
            <li>Vincular aluno e treinador quando ambos concordarem por meio do código de convite.</li>
            <li>Segurança, prevenção a fraudes e cumprimento de obrigações legais (art. 7º II e VI).</li>
          </ul>
          <p>
            <strong className="text-foreground">Não usamos</strong> seus dados para publicidade, criação de perfil comportamental para terceiros ou venda de qualquer natureza.
          </p>
        </Section>

        <Section n="4" title="Com quem compartilhamos">
          <p>Contamos com <em>operadores</em> (art. 5º VII LGPD) para prestar o serviço:</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong className="text-foreground">Supabase (Supabase Inc.)</strong> — hospedagem do banco de dados, autenticação e armazenamento de arquivos.
            </li>
            <li>
              <strong className="text-foreground">Cloudflare</strong> — CDN e execução de código na borda para servir o app.
            </li>
          </ul>
          <p>
            Podemos transferir dados para fora do Brasil, hipótese em que adotamos as garantias previstas nos arts. 33 a 36 da LGPD.
          </p>
        </Section>

        <Section n="5" title="Por quanto tempo guardamos">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Dados de conta e treino: enquanto sua conta existir.</li>
            <li>Mensagens: mantidas até que você ou seu contato as apaguem, ou até a exclusão da conta.</li>
            <li>Registros mínimos exigidos por lei (ex.: logs de acesso — art. 15 do Marco Civil da Internet): até 6 meses.</li>
          </ul>
        </Section>

        <Section n="6" title="Seus direitos">
          <p>A qualquer momento você pode, sem custo (art. 18 LGPD):</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Confirmar a existência do tratamento e acessar seus dados.</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados — direto na tela de <Link to="/app/perfil" className="underline underline-offset-2 text-foreground">Perfil</Link>.</li>
            <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários.</li>
            <li>Solicitar a portabilidade dos seus dados em formato estruturado.</li>
            <li>Revogar consentimentos e solicitar a exclusão total da conta.</li>
            <li>Ser informado sobre com quem compartilhamos seus dados.</li>
          </ul>
          <p>
            Para exercer qualquer direito, escreva para{" "}
            <a className="underline underline-offset-2" href={`mailto:${DPO_EMAIL}?subject=Solicita%C3%A7%C3%A3o%20LGPD`}>
              {DPO_EMAIL}
            </a>
            . Respondemos em até 15 dias.
          </p>
        </Section>

        <Section n="7" title="Segurança">
          <p>
            Aplicamos criptografia em trânsito (HTTPS/TLS) e em repouso no banco de dados,
            políticas de acesso por linha (RLS) que restringem cada leitura ao seu próprio
            escopo, e autenticação por tokens de curta duração. Nenhum sistema é
            infalível — caso identifique um incidente, escreva imediatamente para o
            e-mail do encarregado acima.
          </p>
        </Section>

        <Section n="8" title="Menores de idade">
          <p>
            O Carga é destinado a maiores de 16 anos. Adolescentes entre 13 e 16 anos
            só podem usar o serviço com consentimento específico e destacado dos
            responsáveis (art. 14 LGPD).
          </p>
        </Section>

        <Section n="9" title="Cookies">
          <p>
            Não utilizamos cookies para publicidade ou análise de audiência. Usamos apenas
            armazenamento local do navegador (<code>localStorage</code>) para manter você
            autenticado — trata-se de mecanismo estritamente necessário ao funcionamento
            do serviço e, portanto, dispensa consentimento prévio (Guia Orientativo da ANPD
            sobre cookies).
          </p>
        </Section>

        <Section n="10" title="Alterações desta política">
          <p>
            Podemos atualizar esta política para refletir novas funcionalidades ou
            exigências legais. Mudanças relevantes serão comunicadas por e-mail ou
            aviso no app com antecedência razoável.
          </p>
        </Section>

        <div className="mt-14 flex items-center justify-between text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Voltar</Link>
          <Link to="/termos" className="hover:text-foreground">Termos de Uso →</Link>
        </div>
      </main>
    </div>
  );
}
