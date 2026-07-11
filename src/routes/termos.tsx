import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Carga" },
      {
        name: "description",
        content:
          "Termos e condições de uso do aplicativo Carga: direitos, deveres, uso permitido e limitações de responsabilidade.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: TermsPage,
});

const CONTROLLER = "{{RAZAO_SOCIAL}}";
const CNPJ = "{{CNPJ}}";
const CONTACT_EMAIL = "{{EMAIL_CONTATO}}";
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

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="text-sm font-semibold">← Carga</Link>
        <Link to="/privacidade" className="text-sm text-muted-foreground hover:text-foreground">Privacidade</Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <p className="text-eyebrow">Contrato de adesão</p>
        <h1 className="mt-3 text-4xl leading-tight tracking-tight md:text-5xl">Termos de Uso</h1>
        <p className="mt-3 text-sm text-muted-foreground">Última atualização: {UPDATED_AT}</p>

        <Section n="1" title="Aceitação">
          <p>
            Ao criar uma conta ou usar o Carga você declara ter lido e aceito estes
            Termos e a nossa <Link to="/privacidade" className="underline underline-offset-2 text-foreground">Política de Privacidade</Link>.
            Se você não concorda com qualquer cláusula, não utilize o serviço.
          </p>
        </Section>

        <Section n="2" title="Quem oferece o serviço">
          <p>
            O Carga é operado por <strong className="text-foreground">{CONTROLLER}</strong>,
            CNPJ <strong className="text-foreground">{CNPJ}</strong>. Contato:{" "}
            <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </Section>

        <Section n="3" title="O que o Carga faz (e o que não faz)">
          <p>
            O Carga é uma ferramenta de organização e registro de treinos. As sugestões de
            intensidade, descanso e recuperação são apoios informativos gerados a partir
            dos dados que você mesmo insere — <strong className="text-foreground">não substituem</strong> avaliação
            médica, prescrição profissional de exercício ou orientação nutricional.
          </p>
          <p>
            Consulte sempre um profissional habilitado (médico e/ou educador físico)
            antes de iniciar ou modificar seu treino. Você é responsável pelas decisões
            que tomar com base nas informações do app.
          </p>
        </Section>

        <Section n="4" title="Sua conta">
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Você deve fornecer informações verdadeiras e mantê-las atualizadas.</li>
            <li>Você é responsável por manter sua senha em segurança e por toda atividade realizada na sua conta.</li>
            <li>O Carga é destinado a maiores de 16 anos.</li>
          </ul>
        </Section>

        <Section n="5" title="Uso permitido">
          <p>Ao usar o Carga, você concorda em <strong className="text-foreground">não</strong>:</p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>Enviar conteúdo ilegal, difamatório, discriminatório, obsceno ou que viole direitos de terceiros.</li>
            <li>Assediar, ameaçar ou enganar outros usuários por meio das mensagens do app.</li>
            <li>Tentar burlar mecanismos de segurança, acessar contas alheias ou raspar dados em massa.</li>
            <li>Reutilizar o serviço para criar produto concorrente sem autorização.</li>
          </ul>
          <p>Podemos suspender ou encerrar contas que violem estas regras, sem aviso prévio quando necessário.</p>
        </Section>

        <Section n="6" title="Relação aluno ↔ treinador">
          <p>
            Quando um aluno se vincula a um treinador (via código CRG-XXXX), ambos passam
            a ter acesso mútuo às informações necessárias para o acompanhamento — treinos
            registrados, mensagens e alguns campos do perfil. O vínculo pode ser desfeito
            a qualquer momento pelo aluno, na tela de Perfil.
          </p>
          <p>
            O Carga não é parte de qualquer relação comercial entre aluno e treinador. Não
            respondemos por serviços contratados fora da plataforma.
          </p>
        </Section>

        <Section n="7" title="Propriedade intelectual">
          <p>
            A marca "Carga", o código-fonte do aplicativo, layouts, textos e demais
            elementos gráficos pertencem a {CONTROLLER}. Os dados que você insere
            continuam sendo seus — nós apenas armazenamos e processamos conforme a
            Política de Privacidade.
          </p>
        </Section>

        <Section n="8" title="Disponibilidade e limitações">
          <p>
            Fazemos esforços razoáveis para manter o serviço disponível, mas o Carga é
            oferecido "no estado em que se encontra", sem garantia de operação
            ininterrupta ou livre de erros. Podemos alterar, suspender ou descontinuar
            funcionalidades a qualquer momento.
          </p>
        </Section>

        <Section n="9" title="Limitação de responsabilidade">
          <p>
            Na máxima extensão permitida por lei, {CONTROLLER} não responderá por danos
            indiretos, lucros cessantes, perda de dados, lesões físicas ou consequências
            decorrentes do uso das sugestões do app sem acompanhamento profissional
            adequado.
          </p>
        </Section>

        <Section n="10" title="Rescisão">
          <p>
            Você pode encerrar sua conta a qualquer momento solicitando exclusão pelo
            e-mail acima. Após a confirmação, seus dados são eliminados nos prazos
            descritos na Política de Privacidade.
          </p>
        </Section>

        <Section n="11" title="Foro e legislação">
          <p>
            Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da
            Comarca do estabelecimento principal de {CONTROLLER} para dirimir eventuais
            controvérsias, com renúncia a qualquer outro por mais privilegiado que seja.
          </p>
        </Section>

        <div className="mt-14 flex items-center justify-between text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Voltar</Link>
          <Link to="/privacidade" className="hover:text-foreground">Política de Privacidade →</Link>
        </div>
      </main>
    </div>
  );
}
