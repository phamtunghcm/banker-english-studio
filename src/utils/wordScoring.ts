import type { WordScoreResult, WordStatus } from '../types/curriculum';

/**
 * Normalize text into lowercase alphanumeric tokens, keeping decimal numbers (e.g. 2.5)
 * while splitting hyphenated compounds (e.g. real-time -> real, time) to match speech output.
 */
export function normalizeWords(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/-/g, ' ');
  const matches = cleaned.match(/[a-z0-9]+(?:\.[a-z0-9]+)*/g);
  return matches ?? [];
}

function splitDisplayTokens(sentence: string): { display: string; norm: string }[] {
  const rawParts = sentence.trim().split(/\s+/).filter(Boolean);
  const result: { display: string; norm: string }[] = [];

  for (const part of rawParts) {
    if (part.includes('-')) {
      const subParts = part.split('-').filter(Boolean);
      for (const sub of subParts) {
        const norms = normalizeWords(sub);
        if (norms.length > 0) {
          result.push({ display: sub, norm: norms[0] });
        }
      }
    } else {
      const norms = normalizeWords(part);
      if (norms.length > 0) {
        result.push({ display: part, norm: norms[0] });
      }
    }
  }
  return result;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/**
 * Aligns spoken or typed words against the expected sentence using DP sequence alignment
 * so skipped/inserted words resynchronize rather than cascading errors.
 */
export function scoreWordAlignment(
  expectedSentence: string,
  spokenTranscript: string
): { words: WordScoreResult[]; accuracy: number } {
  const expectedTokens = splitDisplayTokens(expectedSentence);
  const spokenTokens = normalizeWords(spokenTranscript);

  if (expectedTokens.length === 0) {
    return { words: [], accuracy: 0 };
  }

  if (spokenTokens.length === 0) {
    return {
      words: expectedTokens.map((t) => ({
        expected: t.display,
        status: 'missing' as WordStatus,
        similarity: 0,
      })),
      accuracy: 0,
    };
  }

  const m = expectedTokens.length;
  const n = spokenTokens.length;
  const gapPenalty = -0.35;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) dp[i][0] = i * gapPenalty;
  for (let j = 1; j <= n; j++) dp[0][j] = j * gapPenalty;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sim = wordSimilarity(expectedTokens[i - 1].norm, spokenTokens[j - 1]);
      const matchScore = sim === 1 ? 1.0 : sim >= 0.65 ? 0.55 : -0.5;
      dp[i][j] = Math.max(
        dp[i - 1][j - 1] + matchScore,
        dp[i - 1][j] + gapPenalty,
        dp[i][j - 1] + gapPenalty
      );
    }
  }

  // Backtrack alignment for each expected word
  const aligned: WordScoreResult[] = new Array(m);
  let i = m;
  let j = n;

  while (i > 0) {
    if (j > 0) {
      const sim = wordSimilarity(expectedTokens[i - 1].norm, spokenTokens[j - 1]);
      const matchScore = sim === 1 ? 1.0 : sim >= 0.65 ? 0.55 : -0.5;
      if (Math.abs(dp[i][j] - (dp[i - 1][j - 1] + matchScore)) < 1e-6 && sim >= 0.65) {
        aligned[i - 1] = {
          expected: expectedTokens[i - 1].display,
          spoken: spokenTokens[j - 1],
          status: sim === 1 ? 'correct' : 'near',
          similarity: sim,
        };
        i--;
        j--;
        continue;
      }
    }

    if (j > 0 && Math.abs(dp[i][j] - (dp[i][j - 1] + gapPenalty)) < 1e-6) {
      // Extra spoken word, skip it
      j--;
    } else {
      // Missing expected word
      aligned[i - 1] = {
        expected: expectedTokens[i - 1].display,
        status: 'missing',
        similarity: 0,
      };
      i--;
    }
  }

  const totalScore = aligned.reduce((acc, w) => {
    if (w.status === 'correct') return acc + 1;
    if (w.status === 'near') return acc + 0.6;
    return acc;
  }, 0);

  return {
    words: aligned,
    accuracy: Math.round((totalScore / expectedTokens.length) * 100),
  };
}

export function scoreDictation(
  expectedSentence: string,
  userInput: string
): { words: WordScoreResult[]; accuracy: number } {
  return scoreWordAlignment(expectedSentence, userInput);
}

export function checkClozeAnswer(expectedWord: string, userInput: string): boolean {
  const expectedNorm = normalizeWords(expectedWord).join(' ');
  const userNorm = normalizeWords(userInput).join(' ');
  return expectedNorm.length > 0 && expectedNorm === userNorm;
}
