import type { UserProgress } from '../types/curriculum';
import { isLessonMastered } from './progressStore';

export const HR_WEBHOOK_STORAGE_KEY = 'banker_english_hr_webhook_v1';

export interface HrReportPayload {
  timestamp: string;
  employeeName: string;
  roleTitle: string;
  level: string;
  rank: string;
  streakDays: number;
  completedLessons: number;
  monthlyPercent: number;
  avgShadowingScore: number;
  gameXp: number;
  week1Score: number | '';
  week2Score: number | '';
  week3Score: number | '';
  week4Score: number | '';
}

export function isValidAppsScriptUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec/.test(trimmed);
}

export function loadHrWebhookUrl(): string {
  try {
    // Auto-configure if HR shared a link containing ?hr_webhook=...
    if (typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('hr_webhook')?.trim();
      if (fromUrl && isValidAppsScriptUrl(fromUrl)) {
        localStorage.setItem(HR_WEBHOOK_STORAGE_KEY, fromUrl);
        return fromUrl;
      }
    }
    return localStorage.getItem(HR_WEBHOOK_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveHrWebhookUrl(url: string): void {
  try {
    const clean = url.trim();
    if (!clean) {
      localStorage.removeItem(HR_WEBHOOK_STORAGE_KEY);
    } else {
      localStorage.setItem(HR_WEBHOOK_STORAGE_KEY, clean);
    }
  } catch {
    // Ignore storage errors
  }
}

export function buildHrReportPayload(
  progress: UserProgress,
  totalCoreLessons: number
): HrReportPayload {
  const records = Object.values(progress.completedLessons);
  const masteredCount = records.filter((r) => isLessonMastered(r)).length;
  const shadowingScores = records.map((r) => r.shadowingBest).filter((s) => s > 0);
  const avgShadowingScore =
    shadowingScores.length === 0
      ? 0
      : Math.round(shadowingScores.reduce((a, b) => a + b, 0) / shadowingScores.length);

  return {
    timestamp: new Date().toISOString(),
    employeeName: progress.profile.name,
    roleTitle: progress.profile.roleTitle,
    level: progress.selectedLevel,
    rank: progress.rank,
    streakDays: progress.streakDays,
    completedLessons: masteredCount,
    monthlyPercent:
      totalCoreLessons === 0 ? 0 : Math.min(100, Math.round((masteredCount / totalCoreLessons) * 100)),
    avgShadowingScore,
    gameXp: progress.gameXp ?? 0,
    week1Score: progress.weeklyTestScores[1]?.score ?? '',
    week2Score: progress.weeklyTestScores[2]?.score ?? '',
    week3Score: progress.weeklyTestScores[3]?.score ?? '',
    week4Score: progress.weeklyTestScores[4]?.score ?? '',
  };
}

export async function syncProgressToHrSheet(
  webhookUrl: string,
  progress: UserProgress,
  totalCoreLessons: number
): Promise<{ ok: boolean; message: string }> {
  const cleanUrl = webhookUrl.trim();
  if (!isValidAppsScriptUrl(cleanUrl)) {
    return {
      ok: false,
      message: 'URL chưa đúng định dạng Google Apps Script (https://script.google.com/macros/s/.../exec).',
    };
  }

  const payload = buildHrReportPayload(progress, totalCoreLessons);
  try {
    // text/plain + no-cors avoids CORS preflight issues with Google Apps Script Web Apps
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return {
      ok: true,
      message: `Đã gửi báo cáo của ${payload.employeeName} (${payload.rank}, ${payload.monthlyPercent}%) lên Google Sheet HR!`,
    };
  } catch {
    return {
      ok: false,
      message: 'Không thể gửi báo cáo — vui lòng kiểm tra kết nối mạng.',
    };
  }
}

export function buildHrCsvContent(progress: UserProgress, totalCoreLessons: number): string {
  const p = buildHrReportPayload(progress, totalCoreLessons);
  const headers = [
    'Thoi_gian',
    'Ho_ten',
    'Vi_tri',
    'Trinh_do',
    'Xep_hang',
    'Chuoi_ngay',
    'Bai_dat_KPI',
    'Tien_do_thang_%',
    'Diem_noi_TB_%',
    'Game_XP',
    'Thi_Tuan_1',
    'Thi_Tuan_2',
    'Thi_Tuan_3',
    'Thi_Tuan_4',
  ];
  const row = [
    p.timestamp,
    `"${p.employeeName.replace(/"/g, '""')}"`,
    `"${p.roleTitle.replace(/"/g, '""')}"`,
    p.level,
    `"${p.rank}"`,
    p.streakDays,
    p.completedLessons,
    p.monthlyPercent,
    p.avgShadowingScore,
    p.gameXp,
    p.week1Score,
    p.week2Score,
    p.week3Score,
    p.week4Score,
  ];
  // Prepend UTF-8 BOM so Excel displays Vietnamese cleanly
  return `\uFEFF${headers.join(',')}\n${row.join(',')}\n`;
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Thoi gian', 'Ho ten', 'Vi tri', 'Trinh do', 'Xep hang',
      'Streak (ngay)', 'Bai dat KPI', 'Tien do thang (%)',
      'Diem noi TB (%)', 'Game XP', 'Tuan 1', 'Tuan 2', 'Tuan 3', 'Tuan 4'
    ]);
  }
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    data.timestamp, data.employeeName, data.roleTitle, data.level, data.rank,
    data.streakDays, data.completedLessons, data.monthlyPercent,
    data.avgShadowingScore, data.gameXp,
    data.week1Score, data.week2Score, data.week3Score, data.week4Score
  ]);
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
