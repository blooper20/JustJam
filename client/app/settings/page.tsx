'use client';

import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useState } from 'react';
import apiClient from '@/lib/api-client';

export default function SettingsPage() {
  const { data: session } = useSession();

  const [nickname, setNickname] = useState(session?.user?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateProfile = async () => {
    if (!nickname.trim()) return;
    setIsUpdating(true);
    try {
      await apiClient.patch('/users/me', { nickname });
      toast.success('프로필이 업데이트되었습니다.');
      // NextAuth 세션 업데이트 (사용 가능한 경우)
      // @ts-ignore
      if (session?.update) {
        // @ts-ignore
        await session.update({ name: nickname });
      } else {
        // 세션 업데이트가 지원되지 않으면 페이지 새로고침 권장
        // window.location.reload();
      }
    } catch (error) {
      console.error(error);
      toast.error('프로필 업데이트 실패');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    try {
      await apiClient.delete('/users/me');
      toast.success('계정이 삭제되었습니다.');
      window.location.href = '/';
    } catch (error) {
      console.error(error);
      toast.error('계정 삭제 실패');
    }
  };

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="text-3xl font-bold mb-8">설정</h1>

      <div className="space-y-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>프로필</CardTitle>
            <CardDescription>공개 프로필 정보를 관리합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="w-20 h-20">
                <AvatarImage src={session?.user?.image || ''} />
                <AvatarFallback>{session?.user?.name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div className="space-y-1 flex-1">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <label htmlFor="nickname" className="text-sm font-medium">
                      닉네임
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="nickname"
                        className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="새 닉네임 입력"
                      />
                      <Button
                        onClick={handleUpdateProfile}
                        disabled={isUpdating || nickname === session?.user?.name}
                        size="sm"
                      >
                        {isUpdating ? '변경 중...' : '변경'}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-1">
                    <p className="text-sm text-zinc-400">이메일</p>
                    <p className="text-sm font-medium">{session?.user?.email}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-900/50 bg-red-900/10">
          <CardHeader>
            <CardTitle className="text-red-500">위험 구역</CardTitle>
            <CardDescription>계정 삭제 및 데이터 초기화</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              계정 삭제하기
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              계정을 삭제하면 모든 프로젝트와 데이터가 영구적으로 삭제됩니다.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
