import { describe, it, expect } from 'vitest';
import {
  buildListenQuestions,
  buildMatchPairs,
  buildScrambleRounds,
  isScrambleCorrect,
  shuffle,
  xpToLevel,
} from '../games';
import { ALL_LESSONS } from '../../data';

function seededRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('games logic', () => {
  it('shuffle keeps all items', () => {
    const out = shuffle([1, 2, 3, 4, 5], seededRng());
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('builds listen questions with 4 unique options including the answer', () => {
    const qs = buildListenQuestions(ALL_LESSONS.slice(0, 6), 8, seededRng());
    expect(qs).toHaveLength(8);
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options.map((o) => o.toLowerCase())).size).toBe(4);
    }
  });

  it('builds match pairs with EN and VI text', () => {
    const pairs = buildMatchPairs(ALL_LESSONS.slice(0, 3), 4, seededRng());
    expect(pairs).toHaveLength(4);
    expect(pairs.every((p) => p.en && p.vi)).toBe(true);
  });

  it('builds scramble rounds and checks correct order ignoring punctuation/case', () => {
    const rounds = buildScrambleRounds(ALL_LESSONS.slice(0, 4), 3, seededRng());
    expect(rounds).toHaveLength(3);
    const r = rounds[0];
    const correctOrder = r.sentence.en.split(/\s+/);
    expect(isScrambleCorrect(r.sentence.en, correctOrder)).toBe(true);
    expect(isScrambleCorrect(r.sentence.en, [...correctOrder].reverse())).toBe(false);
    // Shuffled tokens must not already be in the original order
    expect(r.tokens.map((t) => t.text).join(' ')).not.toBe(r.sentence.en);
  });

  it('converts XP to level every 200 XP', () => {
    expect(xpToLevel(0).level).toBe(1);
    expect(xpToLevel(199).level).toBe(1);
    expect(xpToLevel(200).level).toBe(2);
    expect(xpToLevel(450)).toEqual({ level: 3, current: 50, next: 200 });
  });
});
