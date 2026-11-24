import type { UiThemeId } from '../types/curriculum';

export const UI_THEMES: {
  id: UiThemeId;
  label: string;
  swatchClass: string;
}[] = [
  { id: 'crisp-light', label: 'Trắng Tối Giản', swatchClass: 'bg-white border-slate-400' },
  { id: 'warm-paper', label: 'Giấy Kem', swatchClass: 'bg-[#f4ecde] border-amber-500' },
  { id: 'private-banking', label: 'Xanh Tài Chính', swatchClass: 'bg-[#e8f0fa] border-blue-600' },
  { id: 'midnight', label: 'Tối Ban Đêm', swatchClass: 'bg-slate-900 border-slate-600' },
  { id: 'mint-focus', label: 'Bạc Hà Tươi', swatchClass: 'bg-[#dff3ea] border-emerald-600' },
];
