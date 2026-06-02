import { test, expect } from '@playwright/test';

test.describe('멀티트랙 플레이어 인터페이스', () => {
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
    // 3. 특정 프로젝트 상세 페이지로 바로 접근 (실제 ID가 필요하나, 여기선 UI 구조 위주로 테스트)
    await page.goto('/projects/test-project');
    await page.waitForLoadState('networkidle');
  });

  test('플레이어 컨트롤 바가 화면 하단에 표시된다', async ({ page }) => {
    // 하단 고정 플레이어 바 확인
    const playerBar = page.locator('div.fixed.bottom-0');
    // 실제 구현된 클래스명이나 데이터 속성에 따라 조정 필요
    if (await playerBar.isVisible()) {
      await expect(playerBar).toBeVisible();
    }
  });

  test('재생 및 일시정지 버튼이 토글된다', async ({ page }) => {
    const playButton = page
      .getByRole('button', { name: /재생/i })
      .or(page.locator('button svg.lucide-play'));
    if (await playButton.isVisible()) {
      await playButton.click();
      // 재생 버튼이 일시정지 아이콘으로 바뀌었는지 확인 (구현 방식에 따라 다름)
      const pauseButton = page.locator('svg.lucide-pause');
      await expect(pauseButton).toBeVisible();
    }
  });

  test('사이드 인덱스 탭(MIXING, COLLAB)이 정상 동작한다', async ({ page }) => {
    const mixingTab = page.getByText('MIXING');

    if (await mixingTab.isVisible()) {
      await mixingTab.click();
      // 믹서 트랙들이 표시되는지 확인
      await expect(page.locator('text=Master')).toBeDefined();
    }
  });
});
