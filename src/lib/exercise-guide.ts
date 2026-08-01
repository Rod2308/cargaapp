/**
 * Guia de exercícios em máquinas — conteúdo estático (pt-BR).
 * As imagens vêm do free-exercise-db (licença pública), com 2 quadros por
 * exercício (início e fim do movimento) que a UI alterna para simular um GIF.
 */

export const GUIDE_IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

export type GuideMuscle =
  | "Peito"
  | "Costas"
  | "Pernas"
  | "Panturrilhas"
  | "Ombros"
  | "Bíceps"
  | "Tríceps"
  | "Abdômen";

export type GuideExercise = {
  slug: string;
  name: string;
  muscle: GuideMuscle;
  machine: string;
  /** pasta no free-exercise-db; a UI monta `${base}/${imageId}/0.jpg` e `/1.jpg` */
  imageId: string;
  setup: string;
  start: string;
  movement: string;
  breathing: string;
  tips: [string, string, string];
  mistakes: [string, string, string];
};

export const GUIDE_MUSCLES: GuideMuscle[] = [
  "Peito",
  "Costas",
  "Pernas",
  "Panturrilhas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Abdômen",
];

export const GUIDE_EXERCISES: GuideExercise[] = [
  // ───────────── Peito ─────────────
  {
    slug: "supino-maquina",
    name: "Supino na Máquina",
    muscle: "Peito",
    machine: "Chest press (supino guiado)",
    imageId: "Machine_Bench_Press",
    setup:
      "Ajuste o banco de forma que as manoplas fiquem na altura da linha dos mamilos. Escolha uma carga que permita completar todas as repetições com técnica.",
    start:
      "Sente-se com as costas totalmente apoiadas no encosto, pés firmes no chão na largura do quadril, ombros para baixo e para trás, pegada pronada firme nas manoplas.",
    movement:
      "Empurre as manoplas à frente até quase estender os cotovelos (fase concêntrica), sem travar as articulações. Retorne devagar, em 2–3 segundos, até sentir o alongamento do peitoral (fase excêntrica), parando antes que os ombros sejam puxados para frente.",
    breathing:
      "Inspire ao retornar as manoplas em direção ao peito; expire ao empurrar.",
    tips: [
      "Controle e cadência: empurre em ~1 segundo e volte em 2–3 segundos, focando na contração do peitoral.",
      "Amplitude: leve as manoplas até a linha do tronco, sem forçar o ombro além do conforto.",
      "Postura: mantenha nuca, costas e quadril apoiados e o abdômen contraído do início ao fim.",
    ],
    mistakes: [
      "Levantar os ombros do encosto e projetá-los à frente no fim do empurrão.",
      "Travar (hiperestender) os cotovelos com força no final do movimento.",
      "Soltar o peso de volta rápido, perdendo toda a fase excêntrica.",
    ],
  },
  {
    slug: "peck-deck",
    name: "Peck Deck (Crucifixo na Máquina)",
    muscle: "Peito",
    machine: "Peck deck / voador",
    imageId: "Butterfly",
    setup:
      "Regule o assento para que as manoplas fiquem na altura dos ombros e ajuste a abertura inicial dos braços para um alongamento confortável, sem dor.",
    start:
      "Sentado, costas no encosto, pés no chão, cotovelos levemente flexionados e fixos nesse ângulo durante todo o exercício.",
    movement:
      "Aproxime os braços à frente do peito, como se abraçasse alguém, até quase encostar as manoplas; segure a contração por 1 segundo. Abra os braços devagar até o alongamento controlado do peitoral.",
    breathing: "Expire ao fechar os braços; inspire ao abrir.",
    tips: [
      "Controle e cadência: nada de bater as manoplas — feche e segure a contração.",
      "Amplitude: abra até sentir o peitoral esticar, sem levar os cotovelos muito atrás da linha do tronco.",
      "Postura: escápulas encaixadas para baixo, peito aberto, abdômen firme.",
    ],
    mistakes: [
      "Flexionar e estender os cotovelos, transformando o crucifixo em supino.",
      "Usar carga excessiva e puxar o ombro para frente na abertura.",
      "Curvar o tronco à frente, descolando as costas do encosto.",
    ],
  },
  {
    slug: "supino-inclinado-maquina",
    name: "Supino Inclinado na Máquina",
    muscle: "Peito",
    machine: "Incline chest press (articulada)",
    imageId: "Leverage_Incline_Chest_Press",
    setup:
      "Ajuste o encosto entre 30° e 45° e o assento até que as manoplas fiquem próximas da parte alta do peito.",
    start:
      "Costas apoiadas, pés firmes, punhos alinhados aos antebraços, pegada pronada nas manoplas altas.",
    movement:
      "Empurre para cima e à frente até quase estender os cotovelos, contraindo a porção superior do peito. Retorne controlado até a altura da clavícula.",
    breathing: "Inspire na descida das manoplas; expire no empurrão.",
    tips: [
      "Controle e cadência: mantenha tensão contínua, sem pausas relaxadas no meio da série.",
      "Amplitude: desça até o alongamento confortável, sem forçar o ombro.",
      "Postura: quadril apoiado no assento, sem arquear demais a lombar.",
    ],
    mistakes: [
      "Inclinar o banco acima de 45°, transferindo o trabalho para o ombro.",
      "Empurrar com os punhos dobrados para trás.",
      "Impulsionar com o tronco para vencer a carga.",
    ],
  },

  // ───────────── Costas ─────────────
  {
    slug: "puxada-alta",
    name: "Puxada Alta (Pegada Aberta)",
    muscle: "Costas",
    machine: "Pulley alto com barra",
    imageId: "Wide-Grip_Lat_Pulldown",
    setup:
      "Ajuste o apoio de coxas para travar bem as pernas e escolha a carga antes de sentar. Pegada pronada um pouco mais aberta que os ombros.",
    start:
      "Sentado, coxas presas sob o apoio, pés no chão, tronco levemente inclinado para trás (cerca de 10–15°) e peito estufado.",
    movement:
      "Puxe a barra em direção à parte alta do peito, iniciando o movimento pelas escápulas (deprimir e retrair) e depois pelos cotovelos, apontados para baixo. Segure 1 segundo e suba a barra devagar até estender os braços e sentir o dorsal alongar.",
    breathing: "Expire ao puxar a barra para baixo; inspire ao subir.",
    tips: [
      "Controle e cadência: pense em 'puxar com os cotovelos', não com as mãos.",
      "Amplitude: suba até quase a extensão total dos cotovelos a cada repetição.",
      "Postura: coluna neutra, sem balançar o tronco para frente e para trás.",
    ],
    mistakes: [
      "Puxar a barra atrás da nuca, o que estressa o ombro.",
      "Usar impulso de tronco (transformar em remada deitada).",
      "Encurtar a subida, trabalhando só metade da amplitude.",
    ],
  },
  {
    slug: "remada-baixa",
    name: "Remada Baixa Sentada",
    muscle: "Costas",
    machine: "Pulley baixo com triângulo",
    imageId: "Seated_Cable_Rows",
    setup:
      "Regule o apoio dos pés para que os joelhos fiquem levemente flexionados e o cabo saia na linha do abdômen.",
    start:
      "Sentado, tronco ereto, peito aberto, braços estendidos segurando o triângulo e escápulas soltas à frente.",
    movement:
      "Puxe o triângulo até a região do umbigo, aproximando as escápulas no final. Segure 1 segundo e volte devagar, deixando as escápulas se afastarem sem curvar a lombar.",
    breathing: "Expire ao puxar; inspire ao retornar.",
    tips: [
      "Controle e cadência: retorno lento é onde a maior parte do estímulo acontece.",
      "Amplitude: estenda bem os braços no fim, mantendo o tronco parado.",
      "Postura: cotovelos rentes ao corpo e coluna neutra sempre.",
    ],
    mistakes: [
      "Jogar o tronco para trás e para frente usando a lombar como alavanca.",
      "Encolher os ombros em direção às orelhas durante a puxada.",
      "Arredondar as costas ao devolver o peso.",
    ],
  },
  {
    slug: "remada-articulada-alta",
    name: "Remada Alta Articulada",
    muscle: "Costas",
    machine: "High row (articulada, peito apoiado)",
    imageId: "Leverage_High_Row",
    setup:
      "Ajuste o assento para que as manoplas fiquem à altura dos ombros e o peito encoste no apoio.",
    start:
      "Peito no apoio, braços estendidos à frente e acima, pegada firme, pés estáveis.",
    movement:
      "Puxe as manoplas para baixo e para trás, levando os cotovelos além da linha do tronco e retraindo as escápulas. Retorne até o alongamento completo do dorsal.",
    breathing: "Expire na puxada; inspire ao estender os braços.",
    tips: [
      "Controle e cadência: 1 segundo de contração no final de cada repetição.",
      "Amplitude: deixe as escápulas 'viajarem' à frente na volta.",
      "Postura: peito colado no apoio, sem se afastar para puxar mais carga.",
    ],
    mistakes: [
      "Descolar o peito do apoio e usar o tronco como impulso.",
      "Puxar só com os bíceps, sem retrair as escápulas.",
      "Carga alta demais, encurtando a amplitude.",
    ],
  },
  {
    slug: "puxada-pegada-fechada",
    name: "Puxada com Pegada Fechada (Triângulo)",
    muscle: "Costas",
    machine: "Pulley alto com triângulo",
    imageId: "Close-Grip_Front_Lat_Pulldown",
    setup:
      "Prenda o triângulo no pulley alto e trave as coxas sob o apoio, com a carga ajustada antes de sentar.",
    start:
      "Sentado e travado, braços estendidos acima, tronco quase vertical e peito estufado.",
    movement:
      "Puxe o triângulo até a parte alta do peito, com os cotovelos descendo colados ao corpo. Segure e retorne controlado até a extensão total.",
    breathing: "Expire ao puxar; inspire ao retornar.",
    tips: [
      "Controle e cadência: 2–3 segundos na subida do peso.",
      "Amplitude: encoste (ou quase) o triângulo no esterno.",
      "Postura: abdômen contraído para evitar balanço.",
    ],
    mistakes: [
      "Deitar o tronco para trás para puxar mais carga.",
      "Puxar apenas com as mãos, sem ativar o dorsal.",
      "Soltar o peso de forma brusca no retorno.",
    ],
  },

  // ───────────── Pernas ─────────────
  {
    slug: "leg-press",
    name: "Leg Press 45°",
    muscle: "Pernas",
    machine: "Leg press inclinado",
    imageId: "Leg_Press",
    setup:
      "Ajuste o encosto para que o quadril fique bem apoiado. Posicione os pés na plataforma na largura dos ombros, à meia altura, com as pontas levemente para fora.",
    start:
      "Costas e quadril totalmente apoiados, mãos nas alavancas laterais, joelhos alinhados com a direção dos pés. Destrave a máquina.",
    movement:
      "Desça a plataforma flexionando os joelhos até formar cerca de 90° (ou até um pouco antes de a lombar sair do apoio), em 2–3 segundos. Empurre pelo meio do pé até quase estender os joelhos.",
    breathing: "Inspire na descida; expire ao empurrar a plataforma.",
    tips: [
      "Controle e cadência: descida lenta e sem quicar no fim do movimento.",
      "Amplitude: desça o máximo que conseguir mantendo o quadril colado no assento.",
      "Postura: joelhos acompanhando a linha dos pés, sem cair para dentro.",
    ],
    mistakes: [
      "Descolar o quadril (lombar arredondada) na parte baixa do movimento.",
      "Travar os joelhos com força na extensão.",
      "Apoiar os pés só na ponta ou muito baixo na plataforma.",
    ],
  },
  {
    slug: "cadeira-extensora",
    name: "Cadeira Extensora",
    muscle: "Pernas",
    machine: "Extensora",
    imageId: "Leg_Extensions",
    setup:
      "Alinhe o eixo da máquina com o joelho e regule o rolo logo acima do tornozelo. O encosto deve deixar o joelho livre na borda do assento.",
    start:
      "Sentado, costas apoiadas, mãos nas alavancas laterais, pés na largura do quadril.",
    movement:
      "Estenda os joelhos até quase a extensão total, contraindo o quadríceps por 1 segundo. Desça controlado em 2–3 segundos, sem deixar o peso bater na pilha.",
    breathing: "Expire ao estender as pernas; inspire ao descer.",
    tips: [
      "Controle e cadência: pausa curta no topo em vez de balançar o peso.",
      "Amplitude: use toda a faixa confortável, sem travar o joelho com força.",
      "Postura: quadril colado no assento durante toda a série.",
    ],
    mistakes: [
      "Levantar o quadril e jogar o tronco para trás para vencer a carga.",
      "Descer rápido demais e bater as placas.",
      "Rolo mal posicionado, pressionando a canela ou o pé.",
    ],
  },
  {
    slug: "mesa-flexora",
    name: "Mesa Flexora (Deitada)",
    muscle: "Pernas",
    machine: "Flexora deitada",
    imageId: "Lying_Leg_Curls",
    setup:
      "Deite de bruços com o joelho alinhado ao eixo da máquina e o rolo apoiado logo acima do calcanhar.",
    start:
      "Quadril colado no apoio, mãos nas alças, pernas estendidas e pés em posição neutra.",
    movement:
      "Flexione os joelhos levando os calcanhares em direção aos glúteos, contraindo os posteriores. Retorne devagar até quase estender as pernas.",
    breathing: "Expire ao flexionar; inspire ao estender.",
    tips: [
      "Controle e cadência: 2–3 segundos na volta, é aí que o posterior mais trabalha.",
      "Amplitude: suba o máximo possível sem levantar o quadril.",
      "Postura: mantenha o quadril pressionado contra o apoio.",
    ],
    mistakes: [
      "Levantar o quadril do banco no fim da flexão.",
      "Usar impulso com um solavanco inicial.",
      "Amplitude curta, sem estender as pernas na volta.",
    ],
  },
  {
    slug: "cadeira-flexora",
    name: "Cadeira Flexora (Sentada)",
    muscle: "Pernas",
    machine: "Flexora sentada",
    imageId: "Seated_Leg_Curl",
    setup:
      "Ajuste o encosto, trave o apoio sobre as coxas e posicione o rolo logo acima dos calcanhares.",
    start:
      "Sentado com as costas apoiadas, pernas estendidas à frente e coxas presas pelo apoio.",
    movement:
      "Flexione os joelhos puxando o rolo para baixo e para trás até o limite confortável; segure 1 segundo. Retorne controlado à posição inicial.",
    breathing: "Expire ao flexionar; inspire ao retornar.",
    tips: [
      "Controle e cadência: sem impulso de tronco, só as pernas trabalham.",
      "Amplitude: retorne até quase estender, mantendo tensão.",
      "Postura: costas no encosto e abdômen firme.",
    ],
    mistakes: [
      "Deslizar o quadril para frente no assento.",
      "Apoio de coxas frouxo, permitindo que as pernas subam.",
      "Carga alta com meia amplitude.",
    ],
  },
  {
    slug: "hack-machine",
    name: "Agachamento no Hack",
    muscle: "Pernas",
    machine: "Hack machine",
    imageId: "Hack_Squat",
    setup:
      "Ajuste as ombreiras à sua altura e posicione os pés na plataforma na largura dos ombros, ligeiramente à frente do quadril.",
    start:
      "Costas e quadril colados no encosto, ombros sob as almofadas, abdômen contraído. Destrave a máquina.",
    movement:
      "Desça flexionando joelhos e quadril até cerca de 90° (ou o quanto sua mobilidade permitir com a lombar apoiada). Suba empurrando pelo meio do pé, sem travar os joelhos.",
    breathing: "Inspire na descida; expire na subida.",
    tips: [
      "Controle e cadência: 2–3 segundos descendo, subida firme.",
      "Amplitude: profundidade máxima em que a lombar permanece apoiada.",
      "Postura: joelhos na direção das pontas dos pés.",
    ],
    mistakes: [
      "Descolar o calcanhar da plataforma.",
      "Deixar os joelhos colapsarem para dentro.",
      "Perder o apoio da lombar no fundo do agachamento.",
    ],
  },
  {
    slug: "abdutora",
    name: "Cadeira Abdutora",
    muscle: "Pernas",
    machine: "Abdutora",
    imageId: "Thigh_Abductor",
    setup:
      "Ajuste os apoios laterais para uma posição inicial confortável (joelhos próximos) e regule a carga.",
    start:
      "Sentado, costas no encosto, joelhos e tornozelos apoiados nas almofadas laterais.",
    movement:
      "Afaste as pernas contraindo os glúteos até o limite confortável; segure 1 segundo. Volte devagar controlando a resistência.",
    breathing: "Expire ao abrir as pernas; inspire ao fechar.",
    tips: [
      "Controle e cadência: nada de abrir e soltar; a volta é lenta.",
      "Amplitude: abra até onde não haja desconforto no quadril.",
      "Postura: tronco levemente inclinado à frente enfatiza o glúteo médio.",
    ],
    mistakes: [
      "Bater as almofadas ao fechar as pernas.",
      "Usar as mãos empurrando os joelhos.",
      "Balançar o tronco para ganhar impulso.",
    ],
  },
  {
    slug: "adutora",
    name: "Cadeira Adutora",
    muscle: "Pernas",
    machine: "Adutora",
    imageId: "Thigh_Adductor",
    setup:
      "Regule a abertura inicial dos apoios para um alongamento confortável da parte interna da coxa.",
    start:
      "Sentado, costas apoiadas, pernas afastadas com joelhos nas almofadas.",
    movement:
      "Junte as pernas de forma controlada até as almofadas quase se tocarem; segure 1 segundo e abra devagar até o alongamento inicial.",
    breathing: "Expire ao fechar; inspire ao abrir.",
    tips: [
      "Controle e cadência: 2 segundos para abrir, sem soltar o peso.",
      "Amplitude: aumente a abertura aos poucos, respeitando a mobilidade.",
      "Postura: quadril e costas apoiados durante toda a série.",
    ],
    mistakes: [
      "Abrir demais logo na primeira série, sem aquecimento.",
      "Fechar com solavanco.",
      "Elevar o quadril do assento.",
    ],
  },

  // ───────────── Panturrilhas ─────────────
  {
    slug: "panturrilha-sentado",
    name: "Panturrilha Sentado",
    muscle: "Panturrilhas",
    machine: "Panturrilha sentada",
    imageId: "Seated_Calf_Raise",
    setup:
      "Regule o apoio para que fique sobre a parte inferior das coxas, com a ponta dos pés na plataforma e os calcanhares livres.",
    start:
      "Sentado, coxas presas, antepé apoiado, calcanhares abaixados no alongamento. Destrave a máquina.",
    movement:
      "Eleve os calcanhares o máximo possível, contraindo a panturrilha por 1–2 segundos no topo. Desça devagar até o alongamento completo.",
    breathing: "Expire ao subir; inspire ao descer.",
    tips: [
      "Controle e cadência: pausa no topo e descida de 2–3 segundos.",
      "Amplitude: sempre até o alongamento máximo confortável.",
      "Postura: joelhos a ~90°, sem tirar as coxas do apoio.",
    ],
    mistakes: [
      "Quicar usando o reflexo do tendão.",
      "Amplitude curta, só na parte de cima.",
      "Apoiar o pé inteiro na plataforma.",
    ],
  },
  {
    slug: "panturrilha-em-pe",
    name: "Panturrilha em Pé",
    muscle: "Panturrilhas",
    machine: "Panturrilha em pé (gêmeos)",
    imageId: "Standing_Calf_Raises",
    setup:
      "Ajuste as ombreiras para que você fique em pé com o corpo alinhado e o antepé na plataforma.",
    start:
      "Ombros sob as almofadas, tronco ereto, joelhos levemente flexionados, calcanhares abaixados.",
    movement:
      "Suba na ponta dos pés até a contração máxima; segure 1–2 segundos. Desça controlado até alongar a panturrilha.",
    breathing: "Expire na subida; inspire na descida.",
    tips: [
      "Controle e cadência: subir rápido, descer lento.",
      "Amplitude: use todo o curso do tornozelo.",
      "Postura: coluna neutra, olhar à frente, abdômen contraído.",
    ],
    mistakes: [
      "Flexionar e estender os joelhos para impulsionar.",
      "Inclinar o tronco à frente.",
      "Pouca amplitude por excesso de carga.",
    ],
  },

  // ───────────── Ombros ─────────────
  {
    slug: "desenvolvimento-maquina",
    name: "Desenvolvimento de Ombros na Máquina",
    muscle: "Ombros",
    machine: "Shoulder press",
    imageId: "Machine_Shoulder_Military_Press",
    setup:
      "Ajuste o assento para que as manoplas fiquem na altura dos ombros ou levemente acima.",
    start:
      "Sentado, costas apoiadas, pés firmes, pegada pronada, punhos alinhados aos antebraços.",
    movement:
      "Empurre as manoplas para cima até quase estender os cotovelos, sem encolher os ombros. Desça controlado até a altura das orelhas.",
    breathing: "Expire ao empurrar para cima; inspire na descida.",
    tips: [
      "Controle e cadência: 2 segundos na descida.",
      "Amplitude: desça até sentir o deltoide alongar, sem dor no ombro.",
      "Postura: lombar apoiada, costelas para baixo, abdômen firme.",
    ],
    mistakes: [
      "Arquear muito a lombar para vencer a carga.",
      "Elevar os trapézios junto com o movimento.",
      "Travar os cotovelos bruscamente no topo.",
    ],
  },
  {
    slug: "crucifixo-inverso-maquina",
    name: "Crucifixo Inverso na Máquina",
    muscle: "Ombros",
    machine: "Peck deck invertido",
    imageId: "Reverse_Machine_Flyes",
    setup:
      "Vire-se de frente para o encosto e ajuste o assento para que as manoplas fiquem na altura dos ombros.",
    start:
      "Peito apoiado, braços estendidos à frente com leve flexão de cotovelos e pegada neutra.",
    movement:
      "Abra os braços para trás em arco, liderando com os cotovelos e retraindo as escápulas. Segure 1 segundo e retorne devagar.",
    breathing: "Expire ao abrir; inspire ao voltar.",
    tips: [
      "Controle e cadência: carga leve e movimento lento funcionam melhor aqui.",
      "Amplitude: pare quando os braços chegarem à linha do tronco.",
      "Postura: peito no apoio e pescoço relaxado.",
    ],
    mistakes: [
      "Usar impulso do tronco para abrir os braços.",
      "Encolher os ombros durante a abertura.",
      "Dobrar e esticar os cotovelos, virando uma remada.",
    ],
  },
  {
    slug: "desenvolvimento-articulado",
    name: "Desenvolvimento Articulado",
    muscle: "Ombros",
    machine: "Leverage shoulder press",
    imageId: "Leverage_Shoulder_Press",
    setup:
      "Ajuste o banco e as alavancas para iniciar com as mãos na altura dos ombros, sem hiperalongar.",
    start:
      "Sentado firme, coluna neutra, pegada pronada ou neutra conforme a máquina.",
    movement:
      "Empurre para cima de forma unilateral ou bilateral até quase estender os cotovelos; desça controlado.",
    breathing: "Expire ao subir; inspire ao descer.",
    tips: [
      "Controle e cadência: mesmo ritmo nos dois lados quando unilateral.",
      "Amplitude: desça só até onde o ombro fica confortável.",
      "Postura: evite girar o tronco para compensar um lado mais forte.",
    ],
    mistakes: [
      "Empurrar mais forte com o lado dominante.",
      "Descolar as costas do encosto.",
      "Prender a respiração em séries longas.",
    ],
  },

  // ───────────── Bíceps ─────────────
  {
    slug: "rosca-maquina",
    name: "Rosca Direta na Máquina",
    muscle: "Bíceps",
    machine: "Máquina de rosca (biceps curl)",
    imageId: "Machine_Bicep_Curl",
    setup:
      "Ajuste o assento para que a axila fique confortável sobre o apoio e o cotovelo alinhado com o eixo da máquina.",
    start:
      "Braços apoiados, pegada supinada nas manoplas, cotovelos levemente flexionados no início.",
    movement:
      "Flexione os cotovelos levando as manoplas em direção aos ombros; contraia 1 segundo no topo. Estenda devagar até quase a extensão total.",
    breathing: "Expire ao subir; inspire ao descer.",
    tips: [
      "Controle e cadência: 2–3 segundos na fase de descida.",
      "Amplitude: estenda quase totalmente, sem deixar a articulação relaxar.",
      "Postura: ombros para baixo, sem projetar o tronco à frente.",
    ],
    mistakes: [
      "Levantar o corpo do assento para vencer a carga.",
      "Descer o peso rápido e bater as placas.",
      "Tirar os cotovelos do apoio durante a subida.",
    ],
  },
  {
    slug: "rosca-scott-maquina",
    name: "Rosca Scott na Máquina",
    muscle: "Bíceps",
    machine: "Banco Scott com carga guiada",
    imageId: "Machine_Preacher_Curls",
    setup:
      "Ajuste altura do assento e do apoio para que o peito toque a borda superior e os braços fiquem inteiramente apoiados.",
    start:
      "Sentado, tríceps colados no apoio inclinado, pegada supinada, braços estendidos sem travar o cotovelo.",
    movement:
      "Flexione os cotovelos até a contração máxima do bíceps; desça em 2–3 segundos até quase a extensão completa.",
    breathing: "Expire na flexão; inspire na extensão.",
    tips: [
      "Controle e cadência: a parte final da descida é a mais importante — não solte.",
      "Amplitude: pare a extensão pouco antes de travar o cotovelo.",
      "Postura: ombros relaxados e punhos firmes, alinhados ao antebraço.",
    ],
    mistakes: [
      "Descer o peso de forma abrupta (risco no cotovelo).",
      "Levantar os cotovelos do apoio.",
      "Usar o tronco para empurrar a carga no início.",
    ],
  },

  // ───────────── Tríceps ─────────────
  {
    slug: "triceps-pulley",
    name: "Tríceps na Polia (Pushdown)",
    muscle: "Tríceps",
    machine: "Pulley alto com barra ou corda",
    imageId: "Triceps_Pushdown",
    setup:
      "Ajuste a polia acima da linha dos ombros e escolha barra reta, V ou corda conforme o conforto do punho.",
    start:
      "Em pé, pés na largura do quadril, tronco levemente inclinado à frente, cotovelos colados ao corpo e flexionados a ~90°.",
    movement:
      "Estenda os cotovelos empurrando a barra para baixo até a extensão quase completa; contraia 1 segundo. Retorne controlado até ~90°, mantendo os cotovelos parados.",
    breathing: "Expire ao empurrar para baixo; inspire ao retornar.",
    tips: [
      "Controle e cadência: só o antebraço se move — o resto fica imóvel.",
      "Amplitude: volte até sentir o tríceps alongar, sem abrir os cotovelos.",
      "Postura: abdômen contraído, joelhos levemente flexionados.",
    ],
    mistakes: [
      "Afastar os cotovelos do corpo, recrutando peito e ombro.",
      "Inclinar o tronco para empurrar a carga com o peso do corpo.",
      "Encurtar o movimento, parando longe da extensão.",
    ],
  },
  {
    slug: "triceps-maquina",
    name: "Extensão de Tríceps na Máquina",
    muscle: "Tríceps",
    machine: "Máquina de tríceps sentado",
    imageId: "Machine_Triceps_Extension",
    setup:
      "Ajuste o assento e o apoio para que os cotovelos fiquem alinhados ao eixo da máquina e apoiados na almofada.",
    start:
      "Sentado, costas apoiadas, cotovelos fixos no apoio, mãos nas manoplas.",
    movement:
      "Estenda os cotovelos até quase a extensão total, contraindo o tríceps. Retorne devagar até a flexão inicial.",
    breathing: "Expire ao estender; inspire ao retornar.",
    tips: [
      "Controle e cadência: 2 segundos na volta, sem deixar o peso cair.",
      "Amplitude: use o curso completo permitido pela máquina.",
      "Postura: ombros baixos e tronco imóvel.",
    ],
    mistakes: [
      "Deslizar os cotovelos do apoio.",
      "Empurrar com o tronco para frente.",
      "Travar os cotovelos com força no final.",
    ],
  },
  {
    slug: "mergulho-maquina",
    name: "Mergulho na Máquina (Dip Machine)",
    muscle: "Tríceps",
    machine: "Dip machine assistida/guiada",
    imageId: "Dip_Machine",
    setup:
      "Ajuste o assento para que as manoplas fiquem na linha do tronco, ao lado do corpo.",
    start:
      "Sentado, costas apoiadas, pegada neutra nas manoplas, cotovelos flexionados junto ao corpo.",
    movement:
      "Empurre para baixo estendendo os cotovelos até quase a extensão total; segure 1 segundo. Volte controlado até a flexão inicial.",
    breathing: "Expire ao empurrar; inspire ao retornar.",
    tips: [
      "Controle e cadência: sem impulso, movimento fluido nos dois sentidos.",
      "Amplitude: volte até sentir o tríceps alongar, sem dor no ombro.",
      "Postura: peito aberto e escápulas encaixadas.",
    ],
    mistakes: [
      "Abrir os cotovelos para os lados.",
      "Curvar os ombros à frente na fase de retorno.",
      "Carga excessiva com amplitude mínima.",
    ],
  },

  // ───────────── Abdômen ─────────────
  {
    slug: "abdominal-maquina",
    name: "Abdominal na Máquina",
    muscle: "Abdômen",
    machine: "Ab crunch machine",
    imageId: "Ab_Crunch_Machine",
    setup:
      "Ajuste o assento para que a almofada fique sobre a parte alta do peito e o eixo da máquina alinhado com a cintura.",
    start:
      "Sentado, pés apoiados, mãos nas manoplas, coluna alongada e abdômen pré-contraído.",
    movement:
      "Flexione o tronco à frente encurtando a distância entre costelas e quadril; segure a contração por 1 segundo. Volte devagar sem relaxar totalmente.",
    breathing: "Expire ao flexionar o tronco; inspire ao retornar.",
    tips: [
      "Controle e cadência: 2–3 segundos no retorno, tensão constante.",
      "Amplitude: movimento curto e concentrado — não é uma flexão de quadril.",
      "Postura: pescoço neutro, sem empurrar a cabeça com as mãos.",
    ],
    mistakes: [
      "Puxar com os braços em vez de contrair o abdômen.",
      "Usar o quadril e as pernas para gerar o movimento.",
      "Prender a respiração durante toda a série.",
    ],
  },
  {
    slug: "abdominal-polia",
    name: "Abdominal na Polia (Cable Crunch)",
    muscle: "Abdômen",
    machine: "Pulley alto com corda",
    imageId: "Cable_Crunch",
    setup:
      "Prenda a corda no pulley alto e ajuste a carga. Ajoelhe-se a cerca de meio metro do aparelho.",
    start:
      "Ajoelhado, corda ao lado da cabeça, quadril estável, coluna alongada e cotovelos flexionados.",
    movement:
      "Enrole a coluna para baixo, aproximando as costelas do quadril, contraindo o abdômen no fim. Retorne devagar desenrolando vértebra por vértebra.",
    breathing: "Expire ao enrolar o tronco; inspire ao subir.",
    tips: [
      "Controle e cadência: o movimento é uma flexão de coluna, lenta e curta.",
      "Amplitude: desça até a contração máxima, sem encostar no chão.",
      "Postura: quadril fixo no lugar durante toda a série.",
    ],
    mistakes: [
      "Puxar a corda com os braços e ombros.",
      "Sentar o quadril para trás (vira uma flexão de quadril).",
      "Usar carga alta e perder a curvatura do movimento.",
    ],
  },
];
