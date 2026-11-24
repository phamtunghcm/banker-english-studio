import type { Lesson, LessonSentence } from '../types/curriculum';
import { normalizeWords } from './wordScoring';

export type Rng = () => number;

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function collectSentences(lessons: Lesson[]): LessonSentence[] {
  return lessons.flatMap((l) => l.sentences);
}

export interface ListenQuestion {
  sentence: LessonSentence;
  options: string[];
  answer: string;
}

export function buildListenQuestions(
  lessons: Lesson[],
  count: number,
  rng: Rng = Math.random
): ListenQuestion[] {
  const sentences = collectSentences(lessons);
  const uniqueWords = Array.from(
    new Map(sentences.map((s) => [s.clozeWord.toLowerCase(), s.clozeWord])).values()
  );
  if (uniqueWords.length < 4) return [];

  return shuffle(sentences, rng)
    .slice(0, count)
    .map((sentence) => {
      const distractors = shuffle(
        uniqueWords.filter((w) => w.toLowerCase() !== sentence.clozeWord.toLowerCase()),
        rng
      ).slice(0, 3);
      return {
        sentence,
        answer: sentence.clozeWord,
        options: shuffle([sentence.clozeWord, ...distractors], rng),
      };
    });
}

export interface MatchPair {
  id: string;
  en: string;
  vi: string;
}

export function buildMatchPairs(lessons: Lesson[], count: number, rng: Rng = Math.random): MatchPair[] {
  return shuffle(collectSentences(lessons), rng)
    .slice(0, count)
    .map((s) => ({ id: s.id, en: s.en, vi: s.vi }));
}

export interface ScrambleRound {
  sentence: LessonSentence;
  tokens: { id: string; text: string }[];
}

export function buildScrambleRounds(
  lessons: Lesson[],
  count: number,
  rng: Rng = Math.random
): ScrambleRound[] {
  const pool = collectSentences(lessons).filter((s) => s.en.split(/\s+/).length <= 14);
  return shuffle(pool, rng)
    .slice(0, count)
    .map((sentence) => {
      const original = sentence.en
        .split(/\s+/)
        .filter(Boolean)
        .map((text, i) => ({ id: `${sentence.id}-t${i}`, text }));
      let tokens = shuffle(original, rng);
      const sameOrder = tokens.map((t) => t.text).join(' ') === sentence.en;
      if (original.length > 1 && sameOrder) {
        tokens = [...tokens.slice(1), tokens[0]];
      }
      return { sentence, tokens };
    });
}

export function isScrambleCorrect(sentenceEn: string, arranged: string[]): boolean {
  return normalizeWords(sentenceEn).join(' ') === normalizeWords(arranged.join(' ')).join(' ');
}

export function xpToLevel(xp: number): { level: number; current: number; next: number } {
  const safe = Math.max(0, xp);
  return { level: Math.floor(safe / 200) + 1, current: safe % 200, next: 200 };
}
