'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { UserNav } from "@/components/user-nav";
import { Music, LayoutDashboard, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
    const pathname = usePathname();

    const routes = [
        {
            href: "/dashboard",
            label: "대시보드",
            icon: <LayoutDashboard className="w-4 h-4 mr-2" />,
            active: pathname === "/dashboard",
        },
        {
            href: "/projects",
            label: "내 프로젝트",
            icon: <FolderOpen className="w-4 h-4 mr-2" />,
            active: pathname === "/projects" || pathname.startsWith("/projects/"),
        },
    ];

    const isHomePage = pathname === "/";

    return (
        <header
            className={cn(
                "z-50 w-full transition-all duration-300",
                isHomePage
                    ? "fixed top-0 left-0 border-transparent bg-transparent"
                    : "sticky top-0 border-b border-zinc-800 bg-black/50 backdrop-blur supports-[backdrop-filter]:bg-black/20"
            )}
        >
            <div className="flex w-full h-20 items-center justify-between px-6 md:px-10">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-80">
                        <div className="relative w-72 h-20">
                            <Image
                                src="/images/justjam-logo-v3.png"
                                alt="JustJam Logo"
                                fill
                                className="object-contain object-left scale-125 ml-4"
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
                                    "flex items-center text-sm font-medium transition-colors hover:text-primary",
                                    route.active ? "text-foreground" : "text-muted-foreground"
                                )}
                            >
                                {route.icon}
                                {route.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <UserNav />
                </div>
            </div>
        </header>
    )
}
