import { expect, test, type Locator, type Page } from '@playwright/test';

async function prepareRows(page: Page, administrator: boolean) {
  await page.goto('/profile');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await page.evaluate(({ administrator }) => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    const own = data.members.find((member: { id: string }) => member.id === 'demo-me');
    own.role = administrator ? 'leader' : 'member';
    own.canCreatePoll = administrator;
    for (const [id, name, position] of [['alignment-chair', '열정렬 회장', '회장'], ['alignment-blank', '열정렬 일반', '']]) {
      data.members.push({ id, name, position, role: 'member', status: 'active', canCreatePoll: false, email: `${id}@example.com`, joinedAt: '2026-01-01T00:00:00.000Z' });
      data.profiles.push({ id, phone: '010-0000-9914', area: '서울 중랑구', birthday: '' });
    }
    localStorage.setItem('moim-demo-v1', JSON.stringify(data));
  }, { administrator });
  await page.goto('/members');
  await page.getByLabel('멤버 이름 검색', { exact: true }).fill('열정렬');
  return {
    chair: page.locator('.member-row').filter({ hasText: '열정렬 회장' }),
    blank: page.locator('.member-row').filter({ hasText: '열정렬 일반' }),
  };
}

async function sameColumn(first: Locator, second: Locator) {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  expect(a).not.toBeNull(); expect(b).not.toBeNull();
  expect(b!.x).toBeCloseTo(a!.x, 0);
  expect(b!.x + b!.width).toBeCloseTo(a!.x + a!.width, 0);
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  test.describe(`멤버 직책 열 ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const administrator of [true, false]) {
      test(`${administrator ? '관리자' : '일반 멤버'}가 보는 직책 없는 행도 등록일과 동작 열을 유지한다`, async ({ page }) => {
        const { chair, blank } = await prepareRows(page, administrator);
        await expect(chair).toBeVisible(); await expect(blank).toBeVisible();
        if (administrator && viewport.name === 'desktop') {
          await sameColumn(chair.locator('.member-contact'), blank.locator('.member-contact'));
          await sameColumn(page.locator('.member-list-head>span').nth(2), blank.locator('.member-contact'));
        } else if (administrator) {
          await expect(chair.locator('.member-contact')).toBeHidden();
          await expect(blank.locator('.member-contact')).toBeHidden();
        } else {
          await expect(page.locator('.member-contact')).toHaveCount(0);
        }
        await sameColumn(chair.locator('.member-joined'), blank.locator('.member-joined'));
        await sameColumn(chair.locator('.member-row-action'), blank.locator('.member-row-action'));
        if (viewport.name === 'desktop') {
          await sameColumn(page.locator('.member-list-head>span').nth(administrator ? 3 : 2), blank.locator('.member-joined'));
          await sameColumn(chair.locator('.member-role-badges'), blank.locator('.member-role-badges'));
        }
        await expect(chair.locator('.member-role-badges')).toHaveText('회장');
        await expect(blank.locator('.member-role-badges')).toHaveCount(1);
        await expect(blank.locator('.member-role-badges')).toBeEmpty();
        await expect(blank.getByText('직책 없음', { exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      });
    }
  });
}
