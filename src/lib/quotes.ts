// Repertório de frases motivacionais — foco em treino, disciplina e progresso.
export const quotes: { text: string; author: string }[] = [
  { text: "A dor que você sente hoje é a força que você sente amanhã.", author: "Arnold Schwarzenegger" },
  { text: "Não pare quando estiver cansado. Pare quando terminar.", author: "David Goggins" },
  { text: "Ninguém vai bater tão forte quanto a vida. Mas não se trata de quão forte você bate — é sobre o quanto você aguenta apanhar e seguir em frente.", author: "Rocky Balboa" },
  { text: "A disciplina é a ponte entre metas e conquistas.", author: "Jim Rohn" },
  { text: "O corpo alcança o que a mente acredita.", author: "Napoleon Hill" },
  { text: "Você é o que você repetidamente faz. A excelência não é um ato, é um hábito.", author: "Aristóteles" },
  { text: "Não conte os dias, faça os dias contarem.", author: "Muhammad Ali" },
  { text: "Sua única competição é quem você foi ontem.", author: "Anônimo" },
  { text: "A força não vem do que você consegue fazer. Vem de superar o que achava que não podia.", author: "Rikki Rogers" },
  { text: "Disciplina é escolher entre o que você quer agora e o que você quer mais.", author: "Abraham Lincoln" },
  { text: "Quando você quiser desistir, lembre-se por que começou.", author: "Anônimo" },
  { text: "O único treino ruim é aquele que não aconteceu.", author: "Anônimo" },
  { text: "Grandes coisas nunca vêm da zona de conforto.", author: "Neil Strauss" },
  { text: "A motivação te tira do sofá. A disciplina te mantém em movimento.", author: "Jim Rohn" },
  { text: "Você é mais forte do que pensa e capaz de mais do que imagina.", author: "Roy T. Bennett" },
  { text: "Se está difícil, é porque está funcionando.", author: "Anônimo" },
  { text: "Todo campeão já foi um iniciante que se recusou a desistir.", author: "Jackie Joyner-Kersee" },
  { text: "A dor é temporária. A desistência dura para sempre.", author: "Lance Armstrong" },
  { text: "Não deseje que fosse mais fácil. Deseje ser melhor.", author: "Jim Rohn" },
  { text: "A última repetição é a que constrói o músculo — e o caráter.", author: "Anônimo" },
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { text: "Se você quer algo que nunca teve, precisa fazer algo que nunca fez.", author: "Thomas Jefferson" },
  { text: "Falhar em se preparar é se preparar para falhar.", author: "Benjamin Franklin" },
  { text: "Não é sobre ter tempo. É sobre criar tempo.", author: "Charles Buxton" },
  { text: "Vá com tudo ou vá pra casa.", author: "Anônimo" },
  { text: "O ferro nunca mente pra você.", author: "Henry Rollins" },
  { text: "Cuide do seu corpo. É o único lugar em que você tem para viver.", author: "Jim Rohn" },
  { text: "O que não te desafia, não te transforma.", author: "Fred DeVito" },
  { text: "Suar hoje, brilhar amanhã.", author: "Anônimo" },
  { text: "A jornada de mil quilômetros começa com um único passo.", author: "Lao Tzu" },
  { text: "Foco. Consistência. Resultado.", author: "Anônimo" },
  { text: "Você não precisa ser extremo. Só precisa ser consistente.", author: "Anônimo" },
  { text: "Fortes não são os que sempre vencem, mas os que não desistem quando perdem.", author: "Anônimo" },
  { text: "O impossível é apenas uma opinião.", author: "Paulo Coelho" },
  { text: "Comece onde você está. Use o que você tem. Faça o que você pode.", author: "Arthur Ashe" },
  { text: "Um dia ou o dia um. Você decide.", author: "Anônimo" },
  { text: "Não pare até se orgulhar.", author: "Anônimo" },
  { text: "Treine o corpo. Fortaleça a mente. Domine o dia.", author: "Anônimo" },
];

export function getDailyQuote(date: Date = new Date()) {
  // Dia do ano — muda deterministicamente a cada dia, igual pra todos.
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return quotes[dayOfYear % quotes.length];
}
