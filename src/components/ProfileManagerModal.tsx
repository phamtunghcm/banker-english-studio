import { useState } from 'react';
import { Check, Plus, Trash2, UserCheck, X } from 'lucide-react';
import type {
  LearningGoal,
  LevelTier,
  MultiProfileStore,
  Track,
  UserProfileConfig,
} from '../types/curriculum';

interface ProfileManagerModalProps {
  store: MultiProfileStore;
  onSwitchProfile: (id: string) => void;
  onCreateProfile: (
    config: Omit<UserProfileConfig, 'id'>,
    level: LevelTier
  ) => void;
  onUpdateActiveProfile: (
    updates: Partial<UserProfileConfig>,
    level: LevelTier
  ) => void;
  onDeleteProfile: (id: string) => void;
  onClose: () => void;
}

const TRACK_OPTIONS: { id: Track; label: string }[] = [
  { id: 'finance', label: 'Tài chính' },
  { id: 'credit', label: 'Tín dụng' },
  { id: 'tech', label: 'CNTT & Fintech' },
  { id: 'legal', label: 'Pháp chế' },
  { id: 'travel', label: 'Du lịch & Công tác' },
  { id: 'daily', label: 'Đời sống' },
  { id: 'ielts', label: 'IELTS' },
  { id: 'toefl', label: 'TOEFL 2026' },
  { id: 'toeic', label: 'TOEIC' },
];

const GOAL_OPTIONS: { id: LearningGoal; label: string }[] = [
  { id: 'executive_meeting', label: 'Họp & Thuyết trình với đối tác/sếp' },
  { id: 'credit_committee', label: 'Thẩm định & Bảo vệ hồ sơ Tín dụng' },
  { id: 'fintech_it', label: 'Dự án Công nghệ / Fintech / War Room' },
  { id: 'travel_daily', label: 'Công tác nước ngoài, Du lịch & Đời sống' },
];

const AVATAR_COLORS = [
  'bg-emerald-600',
  'bg-sky-600',
  'bg-amber-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-cyan-600',
];

export function ProfileManagerModal({
  store,
  onSwitchProfile,
  onCreateProfile,
  onUpdateActiveProfile,
  onDeleteProfile,
  onClose,
}: ProfileManagerModalProps) {
  const activeProgress = store.profiles[store.activeProfileId];
  const [mode, setMode] = useState<'edit' | 'create'>('edit');

  const [name, setName] = useState(activeProgress.profile.name);
  const [roleTitle, setRoleTitle] = useState(activeProgress.profile.roleTitle);
  const [avatarColor, setAvatarColor] = useState(activeProgress.profile.avatarColor);
  const [focusTracks, setFocusTracks] = useState<Track[]>(activeProgress.profile.focusTracks);
  const [goal, setGoal] = useState<LearningGoal>(activeProgress.profile.goal);
  const [dailyMinutesTarget, setDailyMinutesTarget] = useState<15 | 30 | 45>(
    activeProgress.profile.dailyMinutesTarget
  );
  const [level, setLevel] = useState<LevelTier>(activeProgress.selectedLevel);

  const startCreateNew = () => {
    setMode('create');
    setName('');
    setRoleTitle('');
    setAvatarColor('bg-sky-600');
    setFocusTracks(['finance', 'tech']);
    setGoal('executive_meeting');
    setDailyMinutesTarget(15);
    setLevel('foundation');
  };

  const loadForEdit = (id: string) => {
    onSwitchProfile(id);
    const target = store.profiles[id];
    if (!target) return;
    setMode('edit');
    setName(target.profile.name);
    setRoleTitle(target.profile.roleTitle);
    setAvatarColor(target.profile.avatarColor);
    setFocusTracks(target.profile.focusTracks);
    setGoal(target.profile.goal);
    setDailyMinutesTarget(target.profile.dailyMinutesTarget);
    setLevel(target.selectedLevel);
  };

  const toggleTrack = (track: Track) => {
    setFocusTracks((prev) => {
      if (prev.includes(track)) {
        return prev.length > 1 ? prev.filter((t) => t !== track) : prev;
      }
      return [...prev, track];
    });
  };

  const handleSave = () => {
    const cleanName = name.trim() || 'Banker Member';
    const cleanRole = roleTitle.trim() || 'Chuyên viên Ngân hàng';
    if (mode === 'create') {
      onCreateProfile(
        {
          name: cleanName,
          roleTitle: cleanRole,
          avatarColor,
          focusTracks,
          goal,
          dailyMinutesTarget,
        },
        level
      );
    } else {
      onUpdateActiveProfile(
        {
          name: cleanName,
          roleTitle: cleanRole,
          avatarColor,
          focusTracks,
          goal,
          dailyMinutesTarget,
        },
        level
      );
    }
    onClose();
  };

  const profileList = Object.values(store.profiles);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-sm sm:items-center">
      <div className="my-auto max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-700" />
            <h2 className="text-lg font-extrabold text-slate-900">
              Quản lý Tài khoản & Tùy biến Lộ trình
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Account Switcher */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Danh sách tài khoản trên máy ({profileList.length})
            </span>
            <button
              type="button"
              onClick={startCreateNew}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm tài khoản mới
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {profileList.map((p) => {
              const isActive = p.profile.id === store.activeProfileId && mode === 'edit';
              return (
                <div
                  key={p.profile.id}
                  className={`flex items-center justify-between rounded-xl border p-3 transition ${
                    isActive
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => loadForEdit(p.profile.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${p.profile.avatarColor}`}
                    >
                      {p.profile.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{p.profile.name}</p>
                      <p className="truncate text-[11px] font-semibold text-slate-600">
                        {p.profile.roleTitle} • {p.rank}
                      </p>
                    </div>
                  </button>
                  {profileList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteProfile(p.profile.id)}
                      className="ml-2 rounded p-1 text-slate-400 hover:text-rose-600"
                      title="Xóa tài khoản"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Customize Form */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-extrabold text-slate-900">
            {mode === 'create' ? 'Tạo hồ sơ người học mới' : 'Tùy chỉnh hồ sơ đang chọn'}
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Tên hiển thị</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Tùng PV"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Vị trí / Vai trò</label>
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="VD: RM Doanh nghiệp / Tech Lead"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Trình độ</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as LevelTier)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              >
                <option value="foundation">Foundation (Nền tảng)</option>
                <option value="professional">Professional (Nghiệp vụ)</option>
                <option value="executive">Executive (Quản lý)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Mục tiêu mỗi ngày</label>
              <select
                value={dailyMinutesTarget}
                onChange={(e) => setDailyMinutesTarget(Number(e.target.value) as 15 | 30 | 45)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              >
                <option value={15}>15 phút / ngày (Cơ bản)</option>
                <option value={30}>30 phút / ngày (Tăng tốc)</option>
                <option value={45}>45 phút / ngày (Chuyên sâu)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Mục đích học chính</label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as LearningGoal)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
            >
              {GOAL_OPTIONS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              Lĩnh vực ưu tiên (chọn nhiều để cá nhân hóa Dashboard)
            </label>
            <div className="flex flex-wrap gap-2">
              {TRACK_OPTIONS.map((t) => {
                const selected = focusTracks.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTrack(t.id)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Màu đại diện:</span>
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                className={`h-6 w-6 rounded-full ${c} ${
                  avatarColor === c ? 'ring-2 ring-slate-900 ring-offset-2' : ''
                }`}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            {mode === 'create' ? 'Tạo tài khoản & Bắt đầu' : 'Lưu tùy chỉnh'}
          </button>
        </div>
      </div>
    </div>
  );
}
