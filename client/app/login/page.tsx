'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-md bg-zinc-900/90 border-zinc-800 shadow-2xl">
                <CardHeader className="text-center pb-8">
                    <div className="mx-auto bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-4 rounded-full w-fit mb-6 ring-1 ring-white/10">
                        <Music className="w-10 h-10 text-white" />
                    </div>
                    <CardTitle className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">JustJam</CardTitle>
                    <CardDescription className="text-lg mt-2">AI 기반 합주 & 연습 플랫폼</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-8 pb-10">
                    <Button
                        onClick={() => signIn('google', { callbackUrl: '/' })}
                        variant="outline"
                        className="w-full h-12 flex items-center justify-center gap-3 bg-white text-black hover:bg-gray-100 border-none text-base font-medium transition-transform hover:scale-[1.02]"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                        Google 계정으로 계속하기
                    </Button>

                    <Button
                        onClick={() => signIn('kakao', { callbackUrl: '/' })}
                        className="w-full h-12 flex items-center justify-center gap-3 bg-[#FEE500] text-[#3D1D1C] hover:bg-[#FEE500]/90 border-none text-base font-medium transition-transform hover:scale-[1.02]"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C5.9 3 1 6.5 1 10.8c0 2.6 1.7 4.9 4.5 6.3l-1.2 4.3c-.1.3 0 .5.3.5.1 0 .2 0 .3-.1L9.6 19c.8.1 1.6.2 2.4.2 6.1 0 11-3.5 11-7.8S18.1 3 12 3z" /></svg>
                        카카오 계정으로 계속하기
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
