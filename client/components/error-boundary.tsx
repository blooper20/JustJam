'use client';

import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    className?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className={cn(
                    "p-8 border border-destructive/20 rounded-2xl bg-destructive/5 flex flex-col items-center text-center space-y-4",
                    this.props.className
                )}>
                    <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
                        <AlertCircle className="w-6 h-6" />
                    </div>

                    <div className="space-y-1">
                        <h3 className="font-bold text-lg">영역 로딩 실패</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            이 영역을 불러오는 중 문제가 발생했습니다.
                        </p>
                    </div>

                    <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full px-6"
                        onClick={() => this.setState({ hasError: false, error: null })}
                    >
                        <RefreshCw className="w-3 h-3 mr-2" />
                        다시 시도
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
