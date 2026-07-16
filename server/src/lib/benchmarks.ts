// The benchmark engine: honest, SOURCED lines about where other people quit.
// Static content, rotated one per day. HARD RULE: never display a benchmark
// without a real published source — if we ever lack one, callers show an
// effort-affirming line instead (see keepgoing-copy.ts). Do NOT add lines
// with fabricated numbers.

export interface BenchmarkLine {
  id: string;
  text: string;
  sourceName: string;
  sourceUrl: string;
  tags: string[];
}

export const BENCHMARKS: BenchmarkLine[] = [
  {
    id: "apps-3day",
    text: "The average app loses about 77% of its daily users within the first 3 days.",
    sourceName: "Quettra mobile retention data, via Andrew Chen",
    sourceUrl: "https://andrewchen.com/new-data-shows-why-losing-80-of-your-mobile-users-is-normal/",
    tags: ["apps", "early"],
  },
  {
    id: "apps-30day",
    text: "By day 30, the average app keeps fewer than 1 in 10 of its new users.",
    sourceName: "Quettra mobile retention data, via Andrew Chen",
    sourceUrl: "https://andrewchen.com/new-data-shows-why-losing-80-of-your-mobile-users-is-normal/",
    tags: ["apps", "month"],
  },
  {
    id: "exercise-6mo",
    text: "About half of the people who start an exercise program stop within six months.",
    sourceName: "Robison & Rogers, Sports Medicine (1994)",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/8153498/",
    tags: ["fitness"],
  },
  {
    id: "resolutions-6mo",
    text: "Fewer than half of New Year's resolutions are still standing after six months.",
    sourceName: "Norcross, Mrykalo & Blagys, Journal of Clinical Psychology (2002)",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/11920693/",
    tags: ["resolutions"],
  },
  {
    id: "resolutions-2yr",
    text: "Only about 1 in 5 New Year's resolutions survives two years.",
    sourceName: "Norcross & Vangarelli, Journal of Substance Abuse (1988)",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/2980864/",
    tags: ["resolutions", "long"],
  },
  {
    id: "habit-66days",
    text: "On average a new habit takes 66 days to feel automatic — the range runs 18 to 254.",
    sourceName: "Lally et al., European Journal of Social Psychology (2010)",
    sourceUrl: "https://onlinelibrary.wiley.com/doi/10.1002/ejsp.674",
    tags: ["habits"],
  },
  {
    id: "mooc-completion",
    text: "Around 3% of the people who enroll in a free online course ever complete it.",
    sourceName: "Reich & Ruipérez-Valiente, Science (2019)",
    sourceUrl: "https://www.science.org/doi/10.1126/science.aav7958",
    tags: ["courses"],
  },
  {
    id: "smoking-unaided",
    text: "Fewer than 1 in 20 unaided attempts to quit smoking lasts a full year.",
    sourceName: "Hughes, Keely & Naud, Addiction (2004)",
    sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/14678060/",
    tags: ["quitting", "long"],
  },
];

/**
 * The benchmark shown on a given goal day (deterministic rotation, so a day
 * always shows the same line). Returns null only if the table is ever empty —
 * callers must then show an effort-affirming line, never an unsourced stat.
 */
export function benchmarkForDay(day: number): BenchmarkLine | null {
  if (BENCHMARKS.length === 0) return null;
  return BENCHMARKS[(Math.max(1, day) - 1) % BENCHMARKS.length];
}
