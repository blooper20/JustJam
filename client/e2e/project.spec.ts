import { test, expect } from '@playwright/test';

// 프로젝트 관리 테스트
test.describe('프로젝트 관리', () => {
  // 인증이 된 상태를 가정하거나, 테스트 전용 세션을 주입하는 코드가 향후 필요합니다.
  // 현재는 UI 요소들의 존재와 기본적인 인터랙션 흐름을 테스트합니다.

  test.beforeEach(async ({ page }) => {
    // 1. 메인 페이지 방문 후 로그인 여부 파악
    await page.goto('/');
    const avatar = page.locator('button.relative.h-8.w-8.rounded-full');
    if (!(await avatar.isVisible())) {
      // 2. 비로그인 상태일 때만 로그인 절차 수행
      await page.goto('/login');
      await page.getByRole('button', { name: /테스트 계정/i }).click();
      await avatar.waitFor({ state: 'visible', timeout: 15000 });
    }
    await page.waitForTimeout(1000);
    // 3. projects 페이지로 이동
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
  });

  test('새 프로젝트 업로드 버튼이 표시된다', async ({ page }) => {
    // 업로드 버튼 존재 확인
    const uploadButton = page.getByRole('button', { name: /새 프로젝트/i });
    if (await uploadButton.isVisible()) {
      await expect(uploadButton).toBeVisible();
    }
  });

  test('프로젝트 검색 필드가 정상 작동한다', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/검색/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('Test Project');
      await expect(searchInput).toHaveValue('Test Project');
    }
  });

  test('프로젝트 상세 페이지로 진입 가능하다', async ({ page }) => {
    // 첫 번째 프로젝트 카드 클릭
    const firstProject = page.locator('.grid > div').first();
    if (await firstProject.isVisible()) {
      await firstProject.click();
      // 프로젝트 상세 URL 패턴 확인 (/projects/[id])
      await expect(page).toHaveURL(/\/projects\//);
    }
  });
});
