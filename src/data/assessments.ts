import type { Track, WeeklyTest } from '../types/curriculum';

export interface PlacementQuestion {
  id: string;
  track: Track;
  prompt: string;
  audioText?: string;
  options: string[];
  answerIndex: number;
}

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: 'pl-1',
    track: 'finance',
    prompt: 'Which metric measures the difference between interest earned on loans and interest paid on deposits?',
    options: [
      'Net Interest Margin (NIM)',
      'Loan-to-Value (LTV)',
      'Cost-to-Income Ratio (CIR)',
      'Debt Service Coverage Ratio (DSCR)',
    ],
    answerIndex: 0,
  },
  {
    id: 'pl-2',
    track: 'credit',
    prompt: 'In corporate lending, what does a "covenant" require the borrower to do?',
    options: [
      'Avoid all foreign exchange hedging',
      'Meet agreed financial or operational conditions during the loan term',
      'Repay the entire principal on day one',
      'Transfer equity ownership to the bank',
    ],
    answerIndex: 1,
  },
  {
    id: 'pl-3',
    track: 'tech',
    prompt: 'Why do digital banking apps use "active liveness detection" during eKYC?',
    options: [
      'To compress database storage',
      'To prevent spoofing with printed photos or deepfake videos',
      'To calculate risk-weighted assets',
      'To settle batch interbank transfers',
    ],
    answerIndex: 1,
  },
  {
    id: 'pl-4',
    track: 'credit',
    prompt: 'When a loan is more than 90 days past due, it is typically classified as:',
    options: [
      'Tier 1 Capital',
      'CASA Deposit',
      'Non-Performing Loan (NPL)',
      'Escrow Balance',
    ],
    answerIndex: 2,
  },
  {
    id: 'pl-5',
    track: 'tech',
    prompt: 'What is the primary purpose of "rate limiting" on an Open Banking API gateway?',
    options: [
      'Protect core banking services from sudden traffic spikes',
      'Increase branch operating expenses',
      'Issue subordinated debt automatically',
      'Replace mutual TLS encryption',
    ],
    answerIndex: 0,
  },
  {
    id: 'pl-6',
    track: 'finance',
    prompt: 'Nghe đoạn hội thoại ngắn (không phụ đề) và chọn ý đúng nhất:',
    audioText: 'Lower funding costs from retail CASA deposits drove most of our net interest margin gain this quarter.',
    options: [
      'Retail CASA deposits lowered funding costs and boosted NIM',
      'Higher NPL ratios improved net interest margin',
      'Branch operating expenses doubled this quarter',
      'Corporate loans were suspended for the quarter',
    ],
    answerIndex: 0,
  },
];

export const WEEKLY_TESTS: WeeklyTest[] = [
  {
    week: 1,
    title: 'Weekly Assessment 1 — Finance & Core Banking Foundations',
    passingScore: 75,
    listeningLessonId: 'w1d1',
    vocabQuestions: [
      {
        id: 'wt1-q1',
        track: 'finance',
        prompt: 'What helps lower a bank’s overall funding cost?',
        options: ['Higher retail CASA deposits', 'Higher non-performing loans', 'Delayed settlement'],
        answerIndex: 0,
      },
      {
        id: 'wt1-q2',
        track: 'finance',
        prompt: 'Tier 1 capital serves primarily as:',
        options: ['A buffer against unexpected losses', 'An operating expense', 'A batch reconciliation tool'],
        answerIndex: 0,
      },
      {
        id: 'wt1-q3',
        track: 'tech',
        prompt: 'Event-driven core banking architecture enables:',
        options: ['Real-time ledger settlement', 'Longer batch delays', 'Manual paper KYC'],
        answerIndex: 0,
      },
    ],
  },
  {
    week: 2,
    title: 'Weekly Assessment 2 — Credit Underwriting & Risk',
    passingScore: 75,
    listeningLessonId: 'w2d1',
    vocabQuestions: [
      {
        id: 'wt2-q1',
        track: 'credit',
        prompt: 'A DSCR of 1.5 indicates that operating cash flow:',
        options: [
          'Covers 1.5x the required debt service payments',
          'Is 50% below interest obligations',
          'Requires immediate NPL write-off',
        ],
        answerIndex: 0,
      },
      {
        id: 'wt2-q2',
        track: 'credit',
        prompt: 'If collateral value drops below policy LTV limits, the borrower must:',
        options: ['Pledge additional collateral', 'Skip loan covenants', 'Issue a green bond'],
        answerIndex: 0,
      },
      {
        id: 'wt2-q3',
        track: 'tech',
        prompt: 'Explainable AI in digital lending ensures:',
        options: [
          'Automated rejections remain transparent and compliant',
          'Human underwriters are never consulted',
          'Credit bureau data is ignored',
        ],
        answerIndex: 0,
      },
    ],
  },
  {
    week: 3,
    title: 'Weekly Assessment 3 — Banking Tech, Cloud & ESG',
    passingScore: 75,
    listeningLessonId: 'w3d1',
    vocabQuestions: [
      {
        id: 'wt3-q1',
        track: 'tech',
        prompt: 'Which combination secures Open Banking API endpoints?',
        options: ['OAuth 2.0 and mutual TLS', 'Plaintext HTTP', 'Batch paper forms'],
        answerIndex: 0,
      },
      {
        id: 'wt3-q2',
        track: 'tech',
        prompt: 'Why is minimizing "false positives" vital in card fraud detection?',
        options: [
          'So legitimate customers are not wrongly blocked',
          'To increase network latency',
          'To disable biometric step-up',
        ],
        answerIndex: 0,
      },
      {
        id: 'wt3-q3',
        track: 'finance',
        prompt: 'Proceeds from a green bond are ring-fenced for:',
        options: ['Eligible sustainable assets', 'Unsecured consumer credit', 'Legacy mainframe fees'],
        answerIndex: 0,
      },
    ],
  },
  {
    week: 4,
    title: 'Weekly Assessment 4 — Executive Banking & Leadership',
    passingScore: 75,
    listeningLessonId: 'w4d1',
    vocabQuestions: [
      {
        id: 'wt4-q1',
        track: 'credit',
        prompt: 'Co-underwriting a syndicated loan with partner banks helps:',
        options: ['Mitigate concentration risk', 'Increase capital breaches', 'Delay due diligence'],
        answerIndex: 0,
      },
      {
        id: 'wt4-q2',
        track: 'tech',
        prompt: 'A "canary release" in digital banking means:',
        options: [
          'Rolling out to a small percentage of users first to monitor telemetry',
          'Shutting down all availability zones',
          'Skipping compliance sign-off',
        ],
        answerIndex: 0,
      },
      {
        id: 'wt4-q3',
        track: 'finance',
        prompt: 'In an earnings call, "full-year guidance" refers to:',
        options: [
          'Management’s official performance outlook for the year',
          'A phishing incident report',
          'An escrow warranty claim',
        ],
        answerIndex: 0,
      },
    ],
  },
];
