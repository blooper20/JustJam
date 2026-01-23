import { test, expect } from '@playwright/test';

test.describe('에러 핸들링', () => {
    test('존재하지 않는 페이지 접근 시 404 페이지 표시', async ({ page }) => {
        await page.goto('/this-page-does-not-exist-12345');
        await expect(page.getByText('페이지를 찾을 수 없습니다')).toBeVisible();
        await expect(page.getByRole('link', { name: '홈으로' })).toBeVisible();
    });

    test('홈으로 버튼 클릭 시 메인 페이지로 이동', async ({ page }) => {
        await page.goto('/non-existent-link');
        await page.getByRole('link', { name: '홈으로' }).click();
        await expect(page).toHaveURL('/');
    });
});
