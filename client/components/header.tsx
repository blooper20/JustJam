'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { UserNav } from '@/components/user-nav';
import { Music, LayoutDashboard, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, Languages, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const tAuth = useTranslations('Auth');
  const tCommon = useTranslations('Common');

  const routes = [
    {
      href: '/dashboard',
      label: '대시보드',
      icon: <LayoutDashboard className="w-4 h-4 mr-2" />,
      active: pathname.includes('/dashboard'),
    },
    {
      href: '/projects',
      label: '내 프로젝트',
      icon: <FolderOpen className="w-4 h-4 mr-2" />,
      active: pathname.includes('/projects'),
    },
  ];

  const languages = [
    { code: 'ko', label: '한국어' },
    { code: 'en', label: 'English' },
  ];

  const currentLocale = pathname.split('/')[1] || 'ko';

  const onLocaleChange = (locale: string) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`);
    router.push(newPath);
  };

  const isHomePage = pathname === '/' || pathname === '/ko' || pathname === '/en';

  return (
    <header
      className={cn(
        'z-50 w-full transition-all duration-300',
        isHomePage
          ? 'fixed top-0 left-0 border-transparent bg-transparent'
          : 'sticky top-0 border-b border-zinc-800 bg-black/50 backdrop-blur supports-[backdrop-filter]:bg-black/20',
      )}
    >
      <div className="flex w-full h-16 md:h-20 items-center justify-between px-4 md:px-10">
        <div className="flex items-center gap-4 md:gap-8">
          {/* Mobile Menu */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 bg-zinc-950 border-zinc-800">
                {routes.map((route) => (
                  <Link key={route.href} href={route.href}>
                    <DropdownMenuItem className={cn(route.active && 'bg-zinc-800')}>
                      {route.icon}
                      {route.label}
                    </DropdownMenuItem>
                  </Link>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 group transition-opacity hover:opacity-80"
          >
            <div className="relative w-40 md:w-56 h-10 md:h-16">
              <Image
                src="/images/justjam-logo-v3.png"
                alt="JustJam Logo"
                fill
                className="object-contain object-left scale-110 md:scale-125"
                priority
              />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {routes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  'flex items-center text-sm font-medium transition-colors hover:text-primary',
                  route.active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {route.icon}
                {route.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9">
                <Languages className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800">
              {languages.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => onLocaleChange(lang.code)}
                  className="flex items-center justify-between"
                >
                  {lang.label}
                  {currentLocale === lang.code && <Check className="ml-2 h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <UserNav />
        </div>
      </div>
    </header>
  );
}
