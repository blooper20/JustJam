'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Music, Mic2, Guitar, ArrowRight, Layers, Sliders, PlayCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function LandingPage() {
  const t = useTranslations('Index');
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-4 py-32 overflow-hidden h-screen max-h-[1000px]">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/landing/hero-bg-v2.jpg"
            alt="Concert Stage Atmosphere"
            fill
            className="object-cover"
            priority
          />
          {/* Main Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background"></div>
          {/* Radial Vignette for Focus */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>
        </div>

        <div className="relative z-10 space-y-8 max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-sm font-medium text-purple-300 mb-4 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-purple-500 mr-2 animate-pulse"></span>
            AI 기반 음악 분석 플랫폼 v1.0
          </div>

          <h1 className="text-5xl md:text-8xl font-black tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent pb-4 drop-shadow-sm">
            {t('title').split(',')[0]} <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              {t('title').split(',')[1] || 'LIKE A PRO'}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
            {t('description')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Link href="/login">
              <Button
                size="lg"
                className="rounded-full text-lg px-8 h-14 bg-white text-black hover:bg-gray-200 hover:scale-105 transition-all duration-300 shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)]"
              >
                <PlayCircle className="mr-2 w-6 h-6" /> {t('getStarted')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 bg-zinc-950 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              상상하던 모든 기능을 하나로
            </h2>
            <p className="text-xl text-muted-foreground">
              뮤지션을 위해 설계된 강력한 도구들을 만나보세요
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              title="AI 트랙 분리"
              description="최첨단 AI 모델이 음악을 보컬, 드럼, 베이스, 기타, 건반으로 정밀하게 분리해드립니다."
              image="/images/landing/feature-separation.jpg"
              delay={0}
            />
            <FeatureCard
              title="스마트 믹서"
              description="각 악기의 볼륨을 자유롭게 조절하고, 특정 파트만 뮤트/솔로하여 집중적으로 연습하세요."
              image="/images/landing/feature-mixer.jpg"
              delay={100}
            />
            <FeatureCard
              title="실시간 악보 생성"
              description="분리된 트랙을 분석하여 즉시 연주 가능한 악보와 타브(Tab) 악보를 생성합니다."
              image="/images/landing/feature-score.jpg"
              delay={200}
            />
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="py-32 bg-background border-t border-white/5">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-20">3단계로 시작하는 연습</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center max-w-5xl mx-auto relative">
            {/* Connecting Line */}
            <div className="absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-zinc-700 to-transparent hidden md:block"></div>

            <StepCard
              number="1"
              title="음원 업로드"
              description="연습하고 싶은 곡의 MP3나 WAV 파일을 업로드하세요."
            />
            <StepCard
              number="2"
              title="AI 자동 분석"
              description="JustJam AI가 몇 분 안에 곡을 분석하고 트랙을 분리합니다."
            />
            <StepCard
              number="3"
              title="합주 시작"
              description="나만의 밴드와 함께 연주를 즐겨보세요."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 text-center">
        <div className="container mx-auto px-4">
          <h3 className="text-2xl font-bold mb-4">JustJam</h3>
          <p className="text-zinc-500 mb-8 max-w-md mx-auto">
            음악을 사랑하는 당신을 위한 최고의 연습 파트너. 지금 바로 시작해보세요.
          </p>
          <p className="text-zinc-600 text-sm">
            © {new Date().getFullYear()} JustJam. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  image,
  delay,
}: {
  title: string;
  description: string;
  image: string;
  delay: number;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/50 hover:bg-zinc-900/80 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-purple-900/20"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="aspect-[4/3] relative overflow-hidden">
        <Image
          src={image}
          alt={title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-80"></div>
      </div>
      <div className="p-8 relative -mt-12">
        <h3 className="text-2xl font-bold mb-3">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative flex flex-col items-center z-10">
      <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center text-3xl font-bold mb-6 border-4 border-zinc-800 shadow-xl group hover:border-purple-500 transition-colors duration-300">
        <span className="bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
          {number}
        </span>
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
