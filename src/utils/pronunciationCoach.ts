import type { WordScoreResult } from '../types/curriculum';
import { scoreWordAlignment } from './wordScoring';
import { lookupIpa } from './ipaDictionary';

export interface PronunciationIssue {
  index: number;
  word: string;
  cleanWord: string;
  spoken?: string;
  status: 'near' | 'missing';
  ipa?: string;
  syllables: string;
  tip: string;
}

export interface PronunciationReport {
  words: WordScoreResult[];
  accuracy: number;
  completeness: number;
  correctCount: number;
  nearCount: number;
  missingCount: number;
  totalWords: number;
  grade: 'Xuất sắc' | 'Tốt' | 'Khá' | 'Cần luyện lại';
  issues: PronunciationIssue[];
}

export function splitSyllableHint(rawWord: string): string {
  const clean = rawWord.replace(/^[^\w]+|[^\w]+$/g, '');
  if (!clean) return rawWord;

  // Banking acronyms in all caps (e.g., NIM, CAR, LTV, NPL, API)
  if (/^[A-Z]{2,5}$/.test(clean)) {
    return clean.split('').join('-');
  }

  if (clean.length <= 4) return clean.toLowerCase();

  const lower = clean.toLowerCase();
  const hyphenated = lower
    .replace(/(tion|sion|ment|ness|able|ible|ity|ing|ous|ful)$/g, '-$1')
    .replace(/([aeiouy]+)([^aeiouy]{2,})([aeiouy])/g, (_, v, c, v2) => {
      const mid = Math.ceil(c.length / 2);
      return `${v}${c.slice(0, mid)}-${c.slice(mid)}${v2}`;
    })
    .replace(/([aeiouy])([^aeiouy])([aeiouy])/g, '$1-$2$3')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '');

  return hyphenated;
}

function buildCoachingTip(cleanWord: string, spoken: string | undefined, status: 'near' | 'missing'): string {
  const lower = cleanWord.toLowerCase();

  if (status === 'missing') {
    if (/^[A-Z]{2,5}$/.test(cleanWord)) {
      return `Từ viết tắt chuyên ngành — hãy đọc rõ từng chữ cái (${cleanWord.split('').join(' - ')}) thay vì lướt qua.`;
    }
    if (lower.length >= 9) {
      return `Từ dài nhiều âm tiết — bấm nghe chậm 0.75x và tách nhịp đọc theo cụm "${splitSyllableHint(cleanWord)}".`;
    }
    return 'Bạn bị bỏ sót hoặc đọc quá nhỏ từ này — hãy mở khẩu hình rõ hơn và đọc nối chậm lại.';
  }

  // Status === 'near'
  if (spoken && lower.endsWith('s') && !spoken.endsWith('s')) {
    return `Bạn bị nuốt âm cuối "-s" (máy nghe thành "${spoken}"). Hãy bật nhẹ hơi gió /s/ hoặc /z/ ở cuối từ.`;
  }
  if (spoken && lower.endsWith('ed') && !spoken.endsWith('ed') && !spoken.endsWith('d') && !spoken.endsWith('t')) {
    return `Bạn bị thiếu âm cuối "-ed" (máy nghe thành "${spoken}"). Hãy bật nhẹ âm /t/ hoặc /d/ ở cuối từ.`;
  }
  if (lower.includes('th')) {
    return `Từ có âm "th" — đặt nhẹ đầu lưỡi giữa hai hàm răng và đẩy hơi (máy đang nghe thành "${spoken ?? ''}").`;
  }
  if (lower.includes('r') || lower.includes('l')) {
    return `Chú ý phân biệt rõ âm /r/ (cuộn lưỡi) và /l/ (chạm lưỡi vòm trên) — máy nghe gần giống "${spoken ?? ''}".`;
  }
  return `Phát âm gần đúng (máy nghe thành "${spoken ?? ''}") — nghe mẫu chậm 0.75x và nhấn rõ trọng âm của từ này.`;
}

export function analyzePronunciation(
  expectedSentence: string,
  spokenTranscript: string
): PronunciationReport {
  const { words, accuracy } = scoreWordAlignment(expectedSentence, spokenTranscript);
  const totalWords = words.length;
  const correctCount = words.filter((w) => w.status === 'correct').length;
  const nearCount = words.filter((w) => w.status === 'near').length;
  const missingCount = words.filter((w) => w.status === 'missing').length;
  const completeness =
    totalWords === 0 ? 0 : Math.round(((correctCount + nearCount) / totalWords) * 100);

  const grade: PronunciationReport['grade'] =
    accuracy >= 90
      ? 'Xuất sắc'
      : accuracy >= 75
        ? 'Tốt'
        : accuracy >= 55
          ? 'Khá'
          : 'Cần luyện lại';

  const issues: PronunciationIssue[] = [];
  words.forEach((w, index) => {
    if (w.status === 'correct') return;
    const cleanWord = w.expected.replace(/^[^\w]+|[^\w]+$/g, '') || w.expected;
    issues.push({
      index,
      word: w.expected,
      cleanWord,
      spoken: w.spoken,
      status: w.status,
      ipa: lookupIpa(cleanWord) ?? undefined,
      syllables: splitSyllableHint(cleanWord),
      tip: buildCoachingTip(cleanWord, w.spoken, w.status),
    });
  });

  return {
    words,
    accuracy,
    completeness,
    correctCount,
    nearCount,
    missingCount,
    totalWords,
    grade,
    issues,
  };
}

export function buildKaraokeReport(
  expectedSentence: string,
  wordStatuses: ('correct' | 'near' | 'missing')[],
  spokenTranscript?: string
): PronunciationReport {
  // If SpeechRecognition captured actual words, blend them for richer feedback
  const speechReport =
    spokenTranscript && spokenTranscript.trim().length > 0
      ? analyzePronunciation(expectedSentence, spokenTranscript)
      : null;

  const rawWords = expectedSentence.trim().split(/\s+/).filter(Boolean);
  const words: WordScoreResult[] = rawWords.map((expected, idx) => {
    const speechWord = speechReport?.words[idx];
    const karaokeStatus = wordStatuses[idx] ?? 'missing';
    const finalStatus =
      speechWord?.status === 'correct'
        ? 'correct'
        : speechWord?.status === 'near'
          ? 'near'
          : karaokeStatus;

    return {
      expected,
      spoken: speechWord?.spoken,
      status: finalStatus,
      similarity: finalStatus === 'correct' ? 1 : finalStatus === 'near' ? 0.65 : 0,
    };
  });

  const totalWords = words.length;
  const correctCount = words.filter((w) => w.status === 'correct').length;
  const nearCount = words.filter((w) => w.status === 'near').length;
  const missingCount = words.filter((w) => w.status === 'missing').length;
  const scoreSum = correctCount + nearCount * 0.6;
  const accuracy = totalWords === 0 ? 0 : Math.round((scoreSum / totalWords) * 100);
  const completeness =
    totalWords === 0 ? 0 : Math.round(((correctCount + nearCount) / totalWords) * 100);

  const grade: PronunciationReport['grade'] =
    accuracy >= 90
      ? 'Xuất sắc'
      : accuracy >= 75
        ? 'Tốt'
        : accuracy >= 55
          ? 'Khá'
          : 'Cần luyện lại';

  const issues: PronunciationIssue[] = [];
  words.forEach((w, index) => {
    if (w.status === 'correct') return;
    const cleanWord = w.expected.replace(/^[^\w]+|[^\w]+$/g, '') || w.expected;
    issues.push({
      index,
      word: w.expected,
      cleanWord,
      spoken: w.spoken,
      status: w.status,
      syllables: splitSyllableHint(cleanWord),
      tip:
        w.status === 'near' && !w.spoken
          ? `Âm lượng hơi nhỏ hoặc hơi trễ nhịp Karaoke ở từ "${cleanWord}" — hãy đọc to, rõ âm tiết "${splitSyllableHint(cleanWord)}".`
          : buildCoachingTip(cleanWord, w.spoken, w.status),
    });
  });

  return {
    words,
    accuracy,
    completeness,
    correctCount,
    nearCount,
    missingCount,
    totalWords,
    grade,
    issues,
  };
}
