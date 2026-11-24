/**
 * Google Apps Script — Nhận báo cáo tiến độ học Tiếng Anh Ngân hàng về Google Sheet (0đ/tháng)
 * Cách cài đặt (1 phút):
 * 1. Mở Google Sheet mới -> Extensions -> Apps Script
 * 2. Dán toàn bộ đoạn code này vào -> bấm Save
 * 3. Bấm Deploy -> New deployment -> Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy đường dẫn https://script.google.com/macros/s/.../exec và dán vào mục "Đồng bộ HR" trên Web App.
 */
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Thoi gian',
      'Ho ten',
      'Vi tri',
      'Trinh do',
      'Xep hang',
      'Streak (ngay)',
      'Bai dat KPI',
      'Tien do thang (%)',
      'Diem noi TB (%)',
      'Game XP',
      'Tuan 1',
      'Tuan 2',
      'Tuan 3',
      'Tuan 4',
    ]);
  }
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    data.timestamp,
    data.employeeName,
    data.roleTitle,
    data.level,
    data.rank,
    data.streakDays,
    data.completedLessons,
    data.monthlyPercent,
    data.avgShadowingScore,
    data.gameXp,
    data.week1Score,
    data.week2Score,
    data.week3Score,
    data.week4Score,
  ]);
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(
    ContentService.MimeType.JSON
  );
}
