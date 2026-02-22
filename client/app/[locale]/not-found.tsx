import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-background">
            <div className="text-center space-y-6 p-8 max-w-md animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                    <FileQuestion className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">페이지를 찾을 수 없습니다</h1>
                    <p className="text-muted-foreground">
                        요청하신 페이지가 존재하지 않거나, 다른 주소로 이동되었을 수 있습니다.
                        입력하신 주소가 올바른지 다시 한번 확인해주세요.
                    </p>
                </div>

                <div className="flex gap-4 justify-center">
                    <Button asChild size="lg" className="px-8 shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                        <Link href="/">
                            <Home className="w-4 h-4 mr-2" />
                            홈으로
                        </Link>
                    </Button>
                    <Button onClick={() => window.history.back()} variant="outline" size="lg" className="px-8">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        뒤로 가기
                    </Button>
                </div>
            </div>
        </div>
    );
}
