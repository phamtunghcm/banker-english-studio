import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildHrCsvContent,
  buildHrReportPayload,
  isValidAppsScriptUrl,
  loadHrWebhookUrl,
  saveHrWebhookUrl,
} from '../hrSync';
import { createInitialProgress, recordLessonResult, recordWeeklyTestResult } from '../progressStore';

describe('hrSync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('validates Google Apps Script exec webhook URLs strictly', () => {
    expect(
      isValidAppsScriptUrl('https://script.google.com/macros/s/AKfycbx1234567890_abc/exec')
    ).toBe(true);
    expect(isValidAppsScriptUrl('https://example.com/hook')).toBe(false);
    expect(isValidAppsScriptUrl('')).toBe(false);
  });

  it('saves and loads HR webhook URL from localStorage', () => {
    const url = 'https://script.google.com/macros/s/AKfycbxTestUrl999/exec';
    saveHrWebhookUrl(url);
    expect(loadHrWebhookUrl()).toBe(url);
  });

  it('builds accurate HR report payload and UTF-8 BOM CSV', () => {
    let progress = createInitialProgress({ name: 'Tùng PV', roleTitle: 'Giám đốc Tín dụng' });
    progress = recordLessonResult(progress, 'w1d1', { shadowingBest: 90 }, '2026-11-24');
    progress = recordWeeklyTestResult(progress, 1, 88, '2026-11-24');

    const payload = buildHrReportPayload(progress, 24);
    expect(payload.employeeName).toBe('Tùng PV');
    expect(payload.completedLessons).toBe(1);
    expect(payload.avgShadowingScore).toBe(90);
    expect(payload.week1Score).toBe(88);
    expect(payload.rank).toBe('Senior Officer (B1+)');

    const csv = buildHrCsvContent(progress, 24);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Tùng PV');
    expect(csv).toContain('Senior Officer (B1+)');
  });
});
