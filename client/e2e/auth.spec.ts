import { test, expect } from '@playwright/test';

test.describe('인증 플로우', () => {
    test('미인증 사용자가 /dashboard 접근 시 로그인 페이지로 리디렉션', async ({ page }) => {
        // NextAuth.js가 세션이 없으면 로그인으로 보냄 (middleware.ts 설정 필요)
        await page.goto('/dashboard');
        // 실제 미들웨어 동작 방식에 따라 다를 수 있으나 보통 /login 으로 리다이렉션됨
        await expect(page).toHaveURL(/\/login/);
    });

    test('로그인 페이지에 소셜 로그인 버튼 표시', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByRole('button', { name: /Google로 계속하기/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Kakao로 계속하기/i })).toBeVisible();
    });
});
