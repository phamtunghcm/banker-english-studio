import type { ExamId } from '../data/examStudio';

export interface WritingEvaluation {
  wordCount: number;
  targetMinWords: number;
  sentenceCount: number;
  connectorsFound: string[];
  academicVocabFound: string[];
  scorePercent: number;
  estimatedBandLabel: string;
  strengths: string[];
  improvements: string[];
}

const LINKING_DEVICES = [
  'however',
  'furthermore',
  'moreover',
  'consequently',
  'therefore',
  'nevertheless',
  'in addition',
  'in contrast',
  'on the other hand',
  'whereas',
  'although',
  'despite',
  'for instance',
  'for example',
  'as a result',
  'in conclusion',
  'overall',
  'primarily',
  'specifically',
  'meanwhile',
];

const ACADEMIC_BUSINESS_VOCAB = [
  'sustainability',
  'sustainable',
  'automation',
  'efficiency',
  'productivity',
  'innovation',
  'infrastructure',
  'regulatory',
  'compliance',
  'transparency',
  'accountability',
  'risk',
  'mitigate',
  'mitigation',
  'governance',
  'stakeholder',
  'stakeholders',
  'resilience',
  'digital',
  'transformation',
  'allocation',
  'diversification',
  'implementation',
  'evaluate',
  'assessment',
  'deadline',
  'confirm',
  'clarify',
  'apologize',
  'alternative',
  'schedule',
  'proposal',
  'budget',
  'reimbursement',
  'strategy',
  'strategic',
  'significant',
  'substantial',
  'beneficial',
  'drawback',
  'perspective',
  'evidence',
];

export function formatExamBand(examId: ExamId, percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  if (examId === 'ielts') {
    const raw = 4.0 + (clamped / 100) * 4.5; // 4.0 to 8.5
    const band = Math.round(raw * 2) / 2;
    return `IELTS Band ${band.toFixed(1)}`;
  }
  if (examId === 'toefl') {
    const raw6 = 1.5 + (clamped / 100) * 4.5; // 1.5 to 6.0 (TOEFL iBT 2026 scale)
    const band6 = Math.round(raw6 * 2) / 2;
    const eq120 = Math.round(30 + (clamped / 100) * 86);
    return `TOEFL ${band6.toFixed(1)}/6.0 (~${eq120}/120)`;
  }
  // TOEIC 10–990
  const toeic = Math.round((250 + (clamped / 100) * 720) / 5) * 5;
  return `TOEIC ~${toeic}/990`;
}

export function evaluateWritingResponse(
  text: string,
  examId: ExamId,
  targetMinWords: number,
  topicKeywords: string[] = []
): WritingEvaluation {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const sentences = trimmed
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
  const sentenceCount = sentences.length;
  const lower = trimmed.toLowerCase();

  const connectorsFound = LINKING_DEVICES.filter((c) => lower.includes(c));
  const vocabPool = [...new Set([...ACADEMIC_BUSINESS_VOCAB, ...topicKeywords.map((k) => k.toLowerCase())])];
  const academicVocabFound = vocabPool.filter((v) => new RegExp(`\\b${v}\\b`, 'i').test(lower));

  const uniqueRatio =
    wordCount === 0 ? 0 : new Set(words.map((w) => w.toLowerCase().replace(/[^a-z]/g, ''))).size / wordCount;

  // Component scores (total 100)
  const lengthScore =
    wordCount === 0 ? 0 : Math.min(35, Math.round((wordCount / Math.max(1, targetMinWords)) * 35));
  const connectorScore = Math.min(20, connectorsFound.length * 6);
  const vocabScore = Math.min(25, academicVocabFound.length * 4);
  const structureScore =
    sentenceCount >= 4 && uniqueRatio >= 0.45
      ? 20
      : sentenceCount >= 2
        ? 12
        : wordCount > 0
          ? 5
          : 0;

  const scorePercent = wordCount < 10 ? Math.min(15, wordCount) : Math.min(100, lengthScore + connectorScore + vocabScore + structureScore);

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (wordCount >= targetMinWords) {
    strengths.push(`Đạt đủ độ dài chuẩn (${wordCount}/${targetMinWords} từ).`);
  } else {
    improvements.push(`Cần viết thêm ít nhất ${targetMinWords - wordCount} từ để đạt mốc ${targetMinWords} từ.`);
  }

  if (connectorsFound.length >= 2) {
    strengths.push(`Dùng tốt từ nối mạch lạc: ${connectorsFound.slice(0, 4).join(', ')}.`);
  } else {
    improvements.push('Thêm 2–3 từ nối học thuật/công sở (however, furthermore, consequently, for instance) để tăng điểm Coherence.');
  }

  if (academicVocabFound.length >= 4) {
    strengths.push(`Vốn từ chuyên môn tốt (${academicVocabFound.slice(0, 5).join(', ')}).`);
  } else {
    improvements.push('Bổ sung thêm từ vựng trọng tâm của đề bài thay vì lặp từ đơn giản.');
  }

  if (sentenceCount < 4) {
    improvements.push('Chia rõ thành ít nhất 4–5 câu (Mở ý → Luận điểm 1 → Ví dụ → Kết luận).');
  } else {
    strengths.push(`Cấu trúc câu rõ ràng (${sentenceCount} câu hoàn chỉnh).`);
  }

  return {
    wordCount,
    targetMinWords,
    sentenceCount,
    connectorsFound,
    academicVocabFound,
    scorePercent,
    estimatedBandLabel: formatExamBand(examId, scorePercent),
    strengths,
    improvements,
  };
}
