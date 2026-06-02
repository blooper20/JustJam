'use client';

import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { uploadProfileImage } from '@/lib/api';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import {
  User,
  Mail,
  Globe,
  Moon,
  Bell,
  AlertTriangle,
  Check,
  Loader2,
  ShieldAlert,
  Camera,
  Languages,
} from 'lucide-react';
import { cn, getProfileImageUrl } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TRANSLATIONS = {
  ko: {
    title: '설정',
    profile: '프로필',
    profileDesc: '공개 프로필 정보를 관리합니다.',
    nickname: '닉네임',
    nicknamePlaceholder: '새 닉네임 입력',
    change: '변경',
    changing: '변경 중...',
    email: '이메일',
    profileImageSuccess: '프로필 이미지가 변경되었습니다.',
    profileUpdateSuccess: '프로필이 업데이트되었습니다.',
    profileUpdateFail: '프로필 업데이트 실패',
    uploading: '업로드 중...',
    dangerZone: '위험 구역',
    dangerZoneDesc: '계정 삭제 및 데이터 초기화',
    deleteAccount: '계정 삭제하기',
    deleteAccountWarn: '계정을 삭제하면 모든 프로젝트와 데이터가 영구적으로 삭제됩니다.',
    deleteConfirm: '정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    deleteSuccess: '계정이 삭제되었습니다.',
    deleteFail: '계정 삭제 실패',
    preferences: '환경 설정',
    preferencesDesc: '화면 테마 및 다국어 언어를 설정합니다.',
    theme: '화면 테마',
    themeDesc: '원하는 테마로 화면을 구성합니다.',
    themeDark: '다크 모드 (Dark)',
    themeLight: '라이트 모드 (Light - 준비 중)',
    themeSystem: '시스템 설정 (System)',
    themeTip: '💡 현재 앱은 눈이 편안한 다크 모드에 최적화되어 있습니다.',
    language: '언어 설정',
    languageDesc: '선택한 언어로 앱의 텍스트가 표시됩니다.',
    langKo: '한국어 (Korean)',
    langEn: 'English (영어)',
    notifications: '알림 설정',
    notificationsDesc: '실시간 이메일 및 밴드 소식 알림을 관리합니다.',
    notifNotice: '새 공지사항 알림',
    notifNoticeDesc: '밴드 내 새로운 일반 공지가 올라오면 알림을 받습니다.',
    notifVote: '투표 등록 알림',
    notifVoteDesc: '밴드 멤버가 합주곡/일정 투표를 등록하면 알림을 받습니다.',
    notifComment: '피드백 댓글 알림',
    notifCommentDesc: '내가 등록한 포스트나 연습 영상에 댓글이 달리면 알림을 받습니다.',
    savePreferences: '설정 저장',
    preferencesSaved: '설정이 성공적으로 저장되었습니다.',
  },
  en: {
    title: 'Settings',
    profile: 'Profile',
    profileDesc: 'Manage your public profile information.',
    nickname: 'Nickname',
    nicknamePlaceholder: 'Enter new nickname',
    change: 'Change',
    changing: 'Changing...',
    email: 'Email',
    profileImageSuccess: 'Profile image changed successfully.',
    profileUpdateSuccess: 'Profile updated successfully.',
    profileUpdateFail: 'Failed to update profile.',
    uploading: 'Uploading...',
    dangerZone: 'Danger Zone',
    dangerZoneDesc: 'Account deletion and data reset',
    deleteAccount: 'Delete Account',
    deleteAccountWarn: 'Deleting your account will permanently delete all projects and data.',
    deleteConfirm: 'Are you sure you want to delete your account? This action cannot be undone.',
    deleteSuccess: 'Account deleted successfully.',
    deleteFail: 'Failed to delete account.',
    preferences: 'Preferences',
    preferencesDesc: 'Set screen theme and multi-language support.',
    theme: 'Screen Theme',
    themeDesc: 'Configure the interface theme to your preference.',
    themeDark: 'Dark Mode',
    themeLight: 'Light Mode (Coming Soon)',
    themeSystem: 'System Default',
    themeTip: '💡 Currently, the app is optimized for a comfortable Dark Mode experience.',
    language: 'Language Settings',
    languageDesc: 'Displays the app interface in the selected language.',
    langKo: '한국어 (Korean)',
    langEn: 'English (English)',
    notifications: 'Notification Settings',
    notificationsDesc: 'Manage real-time notifications for band activities.',
    notifNotice: 'New Announcement Notifications',
    notifNoticeDesc: 'Get notified when a new announcement is posted in your band.',
    notifVote: 'New Poll Notifications',
    notifVoteDesc: 'Get notified when band members create a song or schedule poll.',
    notifComment: 'Feedback Comment Notifications',
    notifCommentDesc: 'Get notified when comments are added to your posts or practice videos.',
    savePreferences: 'Save Preferences',
    preferencesSaved: 'Preferences saved successfully.',
  },
};

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const currentLocale = useLocale() as 'ko' | 'en';
  const t = TRANSLATIONS[currentLocale] || TRANSLATIONS.ko;
  const router = useRouter();
  const pathname = usePathname();

  const [nickname, setNickname] = useState(session?.user?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 로컬 설정 상태
  const [theme, setTheme] = useState('dark');
  const [notifNotice, setNotifNotice] = useState(true);
  const [notifVote, setNotifVote] = useState(true);
  const [notifComment, setNotifComment] = useState(true);
  const [isSavingPref, setIsSavingPref] = useState(false);

  useEffect(() => {
    if (session?.user?.name) {
      setNickname(session.user.name);
    }
  }, [session]);

  // 로컬 스토리지 연동
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTheme(localStorage.getItem('theme-pref') || 'dark');
      setNotifNotice(localStorage.getItem('notif-notice') !== 'false');
      setNotifVote(localStorage.getItem('notif-vote') !== 'false');
      setNotifComment(localStorage.getItem('notif-comment') !== 'false');
    }
  }, []);

  const handleUpdateProfile = async () => {
    if (!nickname.trim()) return;
    setIsUpdating(true);
    try {
      const res = await apiClient.patch('/users/me', { nickname: nickname.trim() });
      toast.success(t.profileUpdateSuccess);
      await update({
        ...session,
        user: {
          ...session?.user,
          name: res.data.nickname,
        },
      });
    } catch (error) {
      console.error(error);
      toast.error(t.profileUpdateFail);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const res = await uploadProfileImage(file);
      toast.success(t.profileImageSuccess);
      await update({
        ...session,
        user: {
          ...session?.user,
          image: res.profile_image,
        },
      });
    } catch (error) {
      console.error(error);
      toast.error(t.profileUpdateFail);
    } finally {
      setIsUploading(false);
    }
  };

  const applyTheme = (themeMode: string) => {
    if (typeof window === 'undefined') return;

    if (themeMode === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (themeMode === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
    }
  };

  const handleSavePreferences = () => {
    setIsSavingPref(true);
    setTimeout(() => {
      localStorage.setItem('theme-pref', theme);
      localStorage.setItem('notif-notice', String(notifNotice));
      localStorage.setItem('notif-vote', String(notifVote));
      localStorage.setItem('notif-comment', String(notifComment));
      applyTheme(theme);
      setIsSavingPref(false);
      toast.success(t.preferencesSaved);
    }, 500);
  };

  const onLocaleChange = (locale: string) => {
    const hasLocalePrefix = pathname.startsWith(`/${currentLocale}`);
    const newPath = hasLocalePrefix
      ? pathname.replace(`/${currentLocale}`, `/${locale}`)
      : `/${locale}${pathname}`;
    router.push(newPath);
  };

  const handleDeleteAccount = async () => {
    if (!confirm(t.deleteConfirm)) return;

    try {
      await apiClient.delete('/users/me');
      toast.success(t.deleteSuccess);
      window.location.href = '/';
    } catch (error) {
      console.error(error);
      toast.error(t.deleteFail);
    }
  };

  return (
    <div className="container max-w-6xl py-10 px-4 md:px-8">
      {/* Background glow effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] right-[10%] w-[350px] h-[350px] bg-pink-900/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[20%] left-[5%] w-[300px] h-[300px] bg-purple-900/10 rounded-full blur-[90px]" />
      </div>

      <div className="relative space-y-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-100 flex items-center gap-3">
            {t.title}
          </h1>
          <p className="text-sm text-zinc-500 mt-1.5">
            JustJam에서의 활동 설정을 변경하고 나만의 밴드 연습 환경을 커스터마이징하세요.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Profile Card */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-zinc-950/40 border-zinc-800/80 shadow-2xl backdrop-blur-xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-zinc-900 pb-5">
                <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-zinc-100">
                  <User size={18} className="text-pink-500" />
                  {t.profile}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">{t.profileDesc}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Profile Image Uploader */}
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="relative group cursor-pointer w-28 h-28 rounded-full overflow-hidden border-2 border-zinc-800 hover:border-pink-500 transition-colors shadow-lg">
                    <Avatar className="w-full h-full">
                      <AvatarImage src={getProfileImageUrl(session?.user?.image)} />
                      <AvatarFallback className="text-3xl font-black bg-zinc-900 text-zinc-300">
                        {session?.user?.name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <label
                      htmlFor="profile-upload"
                      className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <Camera size={20} className="text-white mb-1 animate-bounce" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                        {isUploading ? t.uploading : t.change}
                      </span>
                      <input
                        id="profile-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-zinc-500 italic">권장: 1:1 비율 정방형 이미지</p>
                </div>

                {/* Nickname and Email Details */}
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label htmlFor="nickname" className="text-xs font-semibold text-zinc-400">
                      {t.nickname}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="nickname"
                        className="flex h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder={t.nicknamePlaceholder}
                      />
                      <Button
                        onClick={handleUpdateProfile}
                        disabled={
                          isUpdating || nickname === session?.user?.name || !nickname.trim()
                        }
                        className="rounded-xl h-10 px-4 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs shrink-0"
                      >
                        {isUpdating ? t.changing : t.change}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-900">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                      <Mail size={13} />
                      {t.email}
                    </div>
                    <p className="text-sm font-medium text-zinc-300 break-all select-all">
                      {session?.user?.email}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Preferences & Notifications */}
          <div className="lg:col-span-2 space-y-6">
            {/* Preferences Card */}
            <Card className="bg-zinc-950/40 border-zinc-800/80 shadow-2xl backdrop-blur-xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-zinc-900 pb-5">
                <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-zinc-100">
                  <Globe size={18} className="text-purple-500" />
                  {t.preferences}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  {t.preferencesDesc}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Theme select */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 flex items-center gap-2">
                      <Moon size={14} className="text-zinc-500" />
                      {t.theme}
                    </label>
                    <Select value={theme} onValueChange={setTheme}>
                      <SelectTrigger className="w-full h-10 rounded-xl bg-zinc-950 border-zinc-800 text-zinc-300 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-850">
                        <SelectItem value="dark" className="text-xs text-zinc-300">
                          {t.themeDark}
                        </SelectItem>
                        <SelectItem value="light" className="text-xs text-zinc-300">
                          {t.themeLight}
                        </SelectItem>
                        <SelectItem value="system" className="text-xs text-zinc-300">
                          {t.themeSystem}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{t.themeTip}</p>
                  </div>

                  {/* Language select */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400 flex items-center gap-2">
                      <Languages size={14} className="text-zinc-500" />
                      {t.language}
                    </label>
                    <Select value={currentLocale} onValueChange={onLocaleChange}>
                      <SelectTrigger className="w-full h-10 rounded-xl bg-zinc-950 border-zinc-800 text-zinc-300 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-zinc-850">
                        <SelectItem value="ko" className="text-xs text-zinc-300">
                          {t.langKo}
                        </SelectItem>
                        <SelectItem value="en" className="text-xs text-zinc-300">
                          {t.langEn}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                      {t.languageDesc}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notifications Preferences */}
            <Card className="bg-zinc-950/40 border-zinc-800/80 shadow-2xl backdrop-blur-xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-zinc-900 pb-5">
                <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-zinc-100">
                  <Bell size={18} className="text-yellow-500" />
                  {t.notifications}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  {t.notificationsDesc}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* 1. Notice Notif */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-900 gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-zinc-200">{t.notifNotice}</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{t.notifNoticeDesc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifNotice(!notifNotice)}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-zinc-800',
                      notifNotice ? 'bg-pink-600' : 'bg-zinc-800',
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                        notifNotice ? 'translate-x-5' : 'translate-x-0',
                      )}
                    />
                  </button>
                </div>

                {/* 2. Vote Notif */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-900 gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-zinc-200">{t.notifVote}</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">{t.notifVoteDesc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifVote(!notifVote)}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-zinc-800',
                      notifVote ? 'bg-pink-600' : 'bg-zinc-800',
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                        notifVote ? 'translate-x-5' : 'translate-x-0',
                      )}
                    />
                  </button>
                </div>

                {/* 3. Comment Notif */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-900 gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-zinc-200">{t.notifComment}</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      {t.notifCommentDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifComment(!notifComment)}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-zinc-800',
                      notifComment ? 'bg-pink-600' : 'bg-zinc-800',
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                        notifComment ? 'translate-x-5' : 'translate-x-0',
                      )}
                    />
                  </button>
                </div>

                {/* Save preferences button */}
                <div className="flex justify-end pt-3">
                  <Button
                    onClick={handleSavePreferences}
                    disabled={isSavingPref}
                    className="rounded-xl h-10 px-6 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 text-xs font-bold gap-2"
                  >
                    {isSavingPref ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check size={14} className="text-green-500" />
                    )}
                    {t.savePreferences}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone Card */}
            <Card className="border-red-950/40 bg-red-950/5 shadow-2xl rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-red-950/20 pb-5">
                <CardTitle className="text-lg font-bold flex items-center gap-2.5 text-red-400">
                  <ShieldAlert size={18} />
                  {t.dangerZone}
                </CardTitle>
                <CardDescription className="text-xs text-red-500/70">
                  {t.dangerZoneDesc}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-zinc-300">{t.deleteAccount}</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">{t.deleteAccountWarn}</p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  className="rounded-xl text-xs font-bold h-10 px-5 shrink-0 bg-red-700 hover:bg-red-800 border-red-800"
                >
                  <AlertTriangle size={14} className="mr-1.5" />
                  {t.deleteAccount}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
