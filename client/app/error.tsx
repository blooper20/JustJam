'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // 에러 로깅 (향후 Sentry 연동 가능)
        console.error('Application Error:', error);
    }, [error]);

    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-background">
            <div className="text-center space-y-6 p-8 max-w-md animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto text-destructive animate-pulse">
                    <AlertTriangle className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">문제가 발생했습니다</h1>
                    <p className="text-muted-foreground">
                        예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주시거나, 문제가 지속되면 고객 지원팀에 문의해주세요.
                    </p>
                </div>

                <div className="flex gap-4 justify-center">
                    <Button onClick={reset} size="lg" className="px-8 shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        다시 시도
                    </Button>
                    <Button onClick={() => window.location.href = '/'} variant="outline" size="lg" className="px-8">
                        <Home className="w-4 h-4 mr-2" />
                        홈으로
                    </Button>
                </div>

                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-8 text-left">
                        <details className="bg-muted p-4 rounded-xl border border-border overflow-hidden">
                            <summary className="cursor-pointer text-sm font-medium hover:text-primary transition-colors">
                                에러 상세 정보 (개발자용)
                            </summary>
                            <pre className="mt-4 text-xs font-mono p-4 bg-black/5 rounded-lg overflow-auto max-h-60 leading-relaxed text-muted-foreground whitespace-pre-wrap">
                                {error.message}
                                {error.stack && `\n\nStack Trace:\n${error.stack}`}
                                {error.digest && `\n\nError Digest: ${error.digest}`}
                            </pre>
                        </details>
                    </div>
                )}
            </div>
        </div>
    );
}
