// Repertório de frases motivacionais — foco em treino, disciplina e progresso.
export const quotes: { text: string; author: string }[] = [
  { text: "A dor que você sente hoje é a força que você sente amanhã.", author: "Arnold Schwarzenegger" },
  { text: "Não conte os dias, faça os dias contarem.", author: "Muhammad Ali" },
  { text: "O corpo alcança o que a mente acredita.", author: "Napoleon Hill" },
  { text: "Suor é gordura chorando.", author: "Anônimo" },
  { text: "Disciplina é escolher entre o que você quer agora e o que você quer mais.", author: "Abraham Lincoln" },
  { text: "Nada que vale a pena vem fácil.", author: "Theodore Roosevelt" },
  { text: "O único treino ruim é aquele que não aconteceu.", author: "Anônimo" },
  { text: "Você é mais forte do que pensa.", author: "Christopher Robin" },
  { text: "A força não vem do que você consegue fazer, vem de superar o que você achava que não podia.", author: "Rikki Rogers" },
  { text: "Comece agora. Comece onde você está. Comece com medo. Só comece.", author: "Anônimo" },
  { text: "Todo campeão já foi um iniciante que não desistiu.", author: "Jackie Joyner-Kersee" },
  { text: "Se ainda não dói, não terminou.", author: "Anônimo" },
  { text: "Sua única competição é quem você foi ontem.", author: "Anônimo" },
  { text: "Grandes coisas nunca vêm da zona de conforto.", author: "Neil Strauss" },
  { text: "A motivação te tira do sofá. A disciplina te mantém em movimento.", author: "Jim Rohn" },
  { text: "Treine insano ou continue o mesmo.", author: "Anônimo" },
  { text: "Não pare quando estiver cansado. Pare quando terminar.", author: "David Goggins" },
  { text: "Fortes não são aqueles que sempre vencem, mas os que não desistem quando perdem.", author: "Anônimo" },
  { text: "Você não afoga por cair na água. Afoga por ficar lá.", author: "Edwin Louis Cole" },
  { text: "Uma repetição de cada vez. Um dia de cada vez.", author: "Anônimo" },
  { text: "Suar hoje, sorrir amanhã.", author: "Anônimo" },
  { text: "A jornada de mil quilômetros começa com um único passo.", author: "Lao Tzu" },
  { text: "Se está difícil, é porque está funcionando.", author: "Anônimo" },
  { text: "Sonhos não têm prazo, mas metas têm.", author: "Anônimo" },
  { text: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", author: "Robert Collier" },
  { text: "Cuide do seu corpo. É o único lugar em que você tem para viver.", author: "Jim Rohn" },
  { text: "Quem transpira, conquista.", author: "Anônimo" },
  { text: "O treino de hoje é o resultado de amanhã.", author: "Anônimo" },
  { text: "Não espere pela oportunidade. Crie ela.", author: "George Bernard Shaw" },
  { text: "A dor é temporária. A desistência dura pra sempre.", author: "Lance Armstrong" },
  { text: "Foco. Consistência. Resultado.", author: "Anônimo" },
];

export function getDailyQuote(date: Date = new Date()) {
  // Dia do ano — muda deterministicamente a cada dia, igual pra todos.
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return quotes[dayOfYear % quotes.length];
}
