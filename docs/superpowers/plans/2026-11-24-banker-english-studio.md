# FinTech Banker English Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 100% local, zero-cost, zero-cloud Banking English learning web app (Finance, Credit, Banking Tech) running on `localhost` inside Antigravity with a 28-day measurable roadmap, placement/weekly ranking tests, and a 4-mode synchronized listening & word-level speaking studio.

**Architecture:** React + TypeScript + Vite + Tailwind CSS SPA storing all progress locally in `localStorage` (with JSON export/import). Audio playback uses `window.speechSynthesis` with `onboundary` + smooth word-timing fallback for karaoke word highlighting and Sub/No-Sub toggles; speaking assessment uses `SpeechRecognition` paired with a Levenshtein word-alignment scorer (`wordScoring.ts`) to color-code every spoken word.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React, Vitest + `@testing-library/react`.

**Spec:** `/Users/tungpv/.gemini/antigravity/brain/759d1954-4013-4253-a05b-e7c986052ff0/design-doc.md`

## Global Constraints

- **100% Local on Antigravity (`localhost`):** Strictly NO Cloudflare, NO Supabase, NO external paid APIs, NO CDN audio downloads (zero bandwidth, zero cash cost).
- **3 Core Tracks:** Finance & Core Banking (`finance`), Credit & Risk Management (`credit`), Banking Tech & Fintech (`tech`).
- **28-Day / 4-Week Roadmap:** Days 1–6 per week are lessons; Days 7, 14, 21, 28 are Weekly Assessments (`>= 75%` required to advance rank/unlock next tier).
- **4-Mode Lesson Player:** (1) Phụ đề / Listen & Sync with Sub EN / Dịch VI / No-Sub toggle, (2) Shadowing with word-level color scoring (green/amber/red), (3) Chính tả / Dictation, (4) Điền từ / Cloze.
- **Terminology:** Keep clean banking/finance Vietnamese terminology; do not introduce unauthorized cloud services or mock external leaderboards.

## Review Focus

- **Empty or noisy speech input:** `scoreWordAlignment(expected, "")` must return `0%` accuracy and mark all expected words as `missing` (red) without throwing `NaN` or dividing by zero.
- **Punctuation, currency, and banking acronyms:** Inputs like `"NIM rose 2.5%, while eKYC reduced NPLs."` vs spoken `"nim rose 2.5 percent while ekyc reduced npls"` must normalize cleanly so punctuation does not penalize valid pronunciation.
- **Inserted/skipped words in Shadowing:** Skipping one word mid-sentence must not cascade red errors onto all subsequent words; alignment must resynchronize on matching words.
- **Browser without `SpeechRecognition` or `onboundary`:** `speechEngine.ts` must detect missing APIs gracefully, provide a word-timer fallback for karaoke sync, and allow manual transcript/self-check fallback in Shadowing so learning never stalls.
- **Corrupted `localStorage` or invalid JSON import:** `progressStore.ts` must safely fall back to initial state or reject malformed import payloads without crashing the app.

---

### Task 1: Project Scaffolding & Core Type Definitions

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/index.css`
- Create: `src/types/curriculum.ts`

**Interfaces:**
- Produces: `Track`, `LevelTier`, `RankTitle`, `WordStatus`, `WordScoreResult`, `LessonSentence`, `Lesson`, `WeeklyTestQuestion`, `WeeklyTest`, `LessonRecord`, `UserProgress` in `src/types/curriculum.ts`.

- [ ] **Step 1: Initialize Vite React-TS project and install dependencies**
Run inside `/Users/tungpv/.gemini/antigravity/scratch/banker-english-studio`:
```bash
npm create vite@latest . -- --template react-ts --yes
npm install lucide-react
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom
```
Expected: `package.json` created with `react`, `lucide-react`, `vitest`, and `@tailwindcss/vite`.

- [ ] **Step 2: Configure Vite, Vitest, and Tailwind CSS**
Update `vite.config.ts` to include `@tailwindcss/vite` plugin and `test: { environment: 'jsdom', globals: true }`. Update `src/index.css` with `@import "tailwindcss";` and clean font/scrollbar rules. Update `index.html` title to `FinTech Banker English Studio`.

- [ ] **Step 3: Create `src/types/curriculum.ts`**
Define exact exported types:
- `Track = 'finance' | 'credit' | 'tech'`
- `LevelTier = 'foundation' | 'professional' | 'executive'`
- `RankTitle = 'Analyst (B1)' | 'Senior Officer (B1+)' | 'Manager (B2)' | 'VP / Director (C1)'`
- `WordStatus = 'correct' | 'near' | 'missing'`
- `WordScoreResult = { expected: string; spoken?: string; status: WordStatus; similarity: number }`
- `LessonSentence = { id: string; startTime: string; en: string; vi: string; clozeWord: string; keywords: string[] }`
- `Lesson = { id: string; week: 1 | 2 | 3 | 4; day: number; track: Track; level: LevelTier; title: string; scenario: string; sentences: LessonSentence[] }`
- `WeeklyTest = { week: 1 | 2 | 3 | 4; title: string; passingScore: number; listeningLessonId: string; vocabQuestions: { id: string; prompt: string; options: string[]; answerIndex: number; track: Track }[] }`
- `UserProgress` tracking `selectedLevel`, `rank`, `streakDays`, `lastActiveDate`, `completedLessons` (`Record<string, { shadowingBest: number; dictationBest: number; clozeCompleted: boolean; completedAt: string }>`), and `weeklyTestScores` (`Record<number, { score: number; passed: boolean; completedAt: string }>`).

- [ ] **Step 4: Verify TypeScript compilation**
Run: `npx tsc --noEmit`
Expected: Exit code 0 with zero errors.

- [ ] **Step 5: Commit**
```bash
git init && git add . && git commit -m "chore: scaffold banker-english-studio with types"
```

---

### Task 2: Word-Level Scoring & Dictation/Cloze Engine

**Files:**
- Create: `src/utils/wordScoring.ts`
- Test: `src/utils/__tests__/wordScoring.test.ts`

**Interfaces:**
- Consumes: `WordScoreResult`, `WordStatus` from `src/types/curriculum.ts`
- Produces: `normalizeWords(text: string): string[]`, `scoreWordAlignment(expectedSentence: string, spokenTranscript: string): { words: WordScoreResult[]; accuracy: number }`, `scoreDictation(expectedSentence: string, userInput: string): { words: WordScoreResult[]; accuracy: number }`, `checkClozeAnswer(expectedWord: string, userInput: string): boolean`

- [ ] **Step 1: Write the failing tests in `src/utils/__tests__/wordScoring.test.ts`**
Cover:
1. Exact match returns 100% accuracy and all `correct`.
2. Empty spoken transcript returns 0% accuracy and all `missing` (no `NaN`).
3. Banking acronyms & punctuation (`"NIM rose 2.5%, while eKYC reduced NPLs."` vs `"nim rose 2.5 while ekyc reduced npls"`) normalize cleanly.
4. Minor pronunciation typo (`"collateral"` vs `"colateral"`) yields `near` status.
5. Skipped word mid-sentence resynchronizes alignment on remaining words instead of marking all subsequent words `missing`.
6. `checkClozeAnswer` trims whitespace and is case-insensitive.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/utils/__tests__/wordScoring.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/utils/wordScoring.ts`**
Implement Levenshtein distance + dynamic programming Needleman-Wunsch/LCS word alignment so skipped or inserted words resynchronize properly, preserving original display tokens in `WordScoreResult.expected`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/utils/__tests__/wordScoring.test.ts`
Expected: PASS (all 6+ test cases green).

- [ ] **Step 5: Commit**
```bash
git add src/utils/wordScoring.ts src/utils/__tests__/wordScoring.test.ts
git commit -m "feat: add word-level alignment scoring for shadowing, dictation, and cloze"
```

---

### Task 3: Local Progress Store, KPIs, Ranking & JSON Backup

**Files:**
- Create: `src/utils/progressStore.ts`
- Test: `src/utils/__tests__/progressStore.test.ts`

**Interfaces:**
- Consumes: `UserProgress`, `LevelTier`, `RankTitle`, `Lesson`, `Track` from `src/types/curriculum.ts`
- Produces: `loadProgress(): UserProgress`, `saveProgress(p: UserProgress): void`, `recordLessonResult(...)`, `recordWeeklyTestResult(progress, week, score)`, `computeTrackStats(progress, lessons)`, `exportProgressJson(progress): string`, `importProgressJson(raw: string): UserProgress | null`

- [ ] **Step 1: Write the failing tests in `src/utils/__tests__/progressStore.test.ts`**
Cover:
1. Default state when `localStorage` is empty or corrupted JSON.
2. Recording a lesson updates `shadowingBest` (keeps max), updates `streakDays` once per day, and marks completion.
3. Passing Weekly Test (`>= 75`) promotes `rank` (`Analyst (B1)` -> `Senior Officer (B1+)` -> `Manager (B2)` -> `VP / Director (C1)`), while `< 75` does not promote.
4. `computeTrackStats` returns accurate completion percentage for `finance`, `credit`, `tech`.
5. `importProgressJson` rejects malformed JSON and accepts valid exported JSON.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/utils/__tests__/progressStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/utils/progressStore.ts`**
Implement pure state reducers + safe `localStorage` wrapper under key `banker_english_studio_v1`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/utils/__tests__/progressStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/utils/progressStore.ts src/utils/__tests__/progressStore.test.ts
git commit -m "feat: add local progress store, rank progression, and JSON backup"
```

---

### Task 4: 28-Day Banking Curriculum & Assessment Data

**Files:**
- Create: `src/data/week1.ts` (Finance & Core Banking — Days 1–6)
- Create: `src/data/week2.ts` (Credit & Risk Management — Days 1–6)
- Create: `src/data/week3.ts` (Banking Tech & Fintech — Days 1–6)
- Create: `src/data/week4.ts` (Executive Communication — Days 1–6)
- Create: `src/data/assessments.ts` (Placement Test + 4 Weekly Tests for Days 7, 14, 21, 28)
- Create: `src/data/index.ts`
- Test: `src/data/__tests__/curriculum.test.ts`

**Interfaces:**
- Consumes: `Lesson`, `WeeklyTest` from `src/types/curriculum.ts`
- Produces: `ALL_LESSONS: Lesson[]`, `WEEKLY_TESTS: WeeklyTest[]`, `PLACEMENT_QUESTIONS`

- [ ] **Step 1: Write failing integrity tests in `src/data/__tests__/curriculum.test.ts`**
Assert:
- `ALL_LESSONS` has 24 lessons (Weeks 1–4, Days 1–6 per week) with unique IDs.
- All 3 tracks (`finance`, `credit`, `tech`) are represented.
- Every sentence has non-empty `en`, `vi`, `startTime`, and its `clozeWord` actually appears in `en` (case-insensitive).
- `WEEKLY_TESTS` has 4 tests (weeks 1–4), each referencing a valid `listeningLessonId` in `ALL_LESSONS`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/data/__tests__/curriculum.test.ts`
Expected: FAIL.

- [ ] **Step 3: Author realistic banking lessons & tests across `src/data/*.ts`**
Write authentic, practical banking dialogues/briefings (5 sentences per lesson) covering NIM, CAR, ROA/ROE, NPL, collateral valuation, Basel III, Core Banking, Open API, eKYC, Cloud migration, AI fraud detection, and executive meetings.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/data/__tests__/curriculum.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/data/
git commit -m "feat: add 28-day banking English curriculum and weekly assessments"
```

---

### Task 5: Speech Engine & 4-Mode Visual Lesson Player

**Files:**
- Create: `src/utils/speechEngine.ts`
- Create: `src/components/LessonPlayer.tsx`
- Test: `src/components/__tests__/LessonPlayer.test.tsx`

**Interfaces:**
- Consumes: `Lesson` from `src/types/curriculum.ts`, `scoreWordAlignment`, `scoreDictation`, `checkClozeAnswer` from `src/utils/wordScoring.ts`
- Produces: `LessonPlayer` component with props `{ lesson: Lesson; onComplete: (result: { shadowingScore?: number; dictationScore?: number; clozeDone?: boolean }) => void; onBack: () => void }`

- [ ] **Step 1: Write failing component tests in `src/components/__tests__/LessonPlayer.test.tsx`**
Cover:
1. Renders lesson title, 4 mode tabs (`Phụ đề`, `Shadowing`, `Chính tả`, `Điền từ`), and Sub/No-Sub controls.
2. Toggling `No-Sub` hides both English and Vietnamese subtitle lines in Listen mode.
3. Switching to `Điền từ` renders an input blank for `clozeWord` and validates correct/incorrect answers.
4. Switching to `Chính tả` scores typed dictation and displays word-level color feedback.
5. Switching to `Shadowing` provides fallback self-check/manual transcript mode when `SpeechRecognition` is absent in `jsdom`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/components/__tests__/LessonPlayer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `src/utils/speechEngine.ts` and `src/components/LessonPlayer.tsx`**
- `speechEngine.ts`: `speakSentence(text, rate, onWordIndex, onEnd)`, `stopSpeaking()`, `isSpeechRecognitionSupported()`, `startListening(onResult, onError)`.
- `LessonPlayer.tsx`: Clean, modern mobile/desktop-friendly dark/light card layout inspired by the reference screenshot: top audio/context header, Sub EN / Dịch VI / No-Sub / Loop / Speed / Font-size toolbar, 4 tabs, timestamped sentence list with active word highlight & underline, and word-by-word green/amber/red badges.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run src/components/__tests__/LessonPlayer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/utils/speechEngine.ts src/components/LessonPlayer.tsx src/components/__tests__/LessonPlayer.test.tsx
git commit -m "feat: build speech engine and 4-mode visual lesson player"
```

---

### Task 6: Onboarding, Dashboard, Weekly Test, App Wiring & E2E Verification

**Files:**
- Create: `src/components/OnboardingModal.tsx`
- Create: `src/components/DashboardView.tsx`
- Create: `src/components/WeeklyTestView.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ALL_LESSONS`, `WEEKLY_TESTS`, `PLACEMENT_QUESTIONS`, `progressStore`, `LessonPlayer`
- Produces: Complete navigable application in `src/App.tsx`.

- [ ] **Step 1: Implement `OnboardingModal.tsx`**
Allow users to either pick their level (`Foundation`, `Professional`, `Executive`) directly OR take the quick Placement Test (Listening + Banking Terminology + Shadowing) to auto-assign level & starting rank.

- [ ] **Step 2: Implement `DashboardView.tsx` & `WeeklyTestView.tsx`**
- `DashboardView.tsx`: Show current Rank badge, Streak days, Daily/Weekly/Monthly completion bars, 3-track mastery bars (Tài chính, Tín dụng, Công nghệ), Week 1–4 tabs with Day 1–6 lesson cards + Day 7 Weekly Test card, and JSON Export/Import buttons.
- `WeeklyTestView.tsx`: 3-part assessment (No-Sub Listening + Banking Terminology + Shadowing word check), computes overall score, displays Pass (`>= 75%`) / Retry and rank promotion.

- [ ] **Step 3: Wire `src/App.tsx` and run full test suite + production build**
Run:
```bash
npx vitest run
npm run build
```
Expected: All Vitest suites pass and `npm run build` succeeds with 0 errors.

- [ ] **Step 4: Live verification in Antigravity Browser**
Start `npm run dev -- --port 5173` as a background task, open `http://localhost:5173` in the browser, verify:
1. Onboarding & Placement Test flow renders cleanly.
2. Dashboard displays 4-week / 28-day roadmap and 3 tracks.
3. LessonPlayer plays audio / highlights words, toggles Sub/No-Sub, and scores Shadowing, Dictation, and Cloze.
4. Zero console/runtime errors.

- [ ] **Step 5: Commit**
```bash
git add src/
git commit -m "feat: complete onboarding, roadmap dashboard, weekly tests, and app wiring"
```
