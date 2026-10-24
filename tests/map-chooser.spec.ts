import { expect, test, type Page } from '@playwright/test';

const placeName = '지도 & 코트 #1';
const address = '서울 중랑구 모임로 10 (2층)?동=가&호=1';
const query = `${placeName}, ${address}`;
const mapHosts = new Set(['map.naver.com', 'map.kakao.com', 'www.google.com']);

async function preparePlace(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await page.evaluate(({ name, address }) => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    data.places[0] = { ...data.places[0], name, address };
    localStorage.setItem('moim-demo-v1', JSON.stringify(data));
  }, { name: placeName, address });
  await page.goto('/places');
  return page.locator('.place-directory-card').filter({ has: page.getByRole('heading', { name: placeName, exact: true }) });
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  test.describe(`지도 앱 선택 ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('chooses Naver, Kakao or Google before opening a safely encoded external destination', async ({ page, context }) => {
      const requests: string[] = [];
      await context.route(url => mapHosts.has(url.hostname), async route => {
        requests.push(route.request().url());
        await route.fulfill({ contentType: 'text/html', body: '<title>Map fixture</title>' });
      });
      const place = await preparePlace(page);
      const originalURL = page.url();
      const before = await page.evaluate(() => localStorage.getItem('moim-demo-v1'));
      await place.getByRole('button', { name: '지도 보기', exact: true }).click();
      const chooser = page.getByRole('dialog', { name: '지도 앱 선택', exact: true });
      await expect(chooser).toBeVisible();
      expect(await chooser.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('aria-label')))).toEqual(['네이버지도', '카카오맵', 'Google 지도']);
      const expected = [
        `https://map.naver.com/p/search/${encodeURIComponent(query)}`,
        `https://map.kakao.com/link/search/${encodeURIComponent(query)}`,
        `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query })}`,
      ];
      for (const [index, link] of (await chooser.getByRole('link').all()).entries()) {
        await expect(link).toHaveAttribute('href', expected[index]);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
      await expect(chooser.getByText('장소 선택 후 길찾기', { exact: true })).toHaveCount(0);
      expect(requests).toEqual([]); expect(context.pages()).toHaveLength(1);
      await expect(page).toHaveURL(originalURL);
      const popupPromise = page.waitForEvent('popup');
      await chooser.getByRole('link', { name: '네이버지도', exact: true }).click();
      const popup = await popupPromise;
      await expect(popup).toHaveURL(expected[0]);
      await expect(chooser).toHaveCount(0);
      expect(requests).toEqual([expected[0]]);
      await expect(page).toHaveURL(originalURL);
      expect(await page.evaluate(() => localStorage.getItem('moim-demo-v1'))).toBe(before);
      await popup.close();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.goto('/');
      const hero = page.locator('.hero-location-links');
      for (const button of await hero.getByRole('button').all()) {
        await expect(button).toBeVisible();
        await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
      }
      await expect(hero.getByRole('button')).toHaveCount(2);
    });

    test('directions explain the place-selection step and Escape returns to the open event', async ({ page }) => {
      await page.goto('/calendar?event=event-coffee');
      const event = page.getByRole('dialog', { name: '커피 한 잔, 함께해요', exact: true });
      await expect(event).toBeVisible();
      const trigger = event.getByRole('button', { name: '길찾기', exact: true });
      await trigger.click();
      const chooser = page.getByRole('dialog', { name: '길찾기 앱 선택', exact: true });
      await expect(chooser.getByRole('link')).toHaveCount(3);
      for (const provider of ['네이버지도', '카카오맵']) {
        await expect(chooser.getByRole('link', { name: provider, exact: true })).toHaveAccessibleDescription('장소 선택 후 길찾기');
      }
      const google = chooser.getByRole('link', { name: 'Google 지도', exact: true });
      await expect(google).not.toHaveAttribute('aria-describedby');
      expect(new URL((await google.getAttribute('href'))!).pathname).toBe('/maps/dir/');
      await expect(page.getByRole('dialog')).toHaveCount(2);
      await page.keyboard.press('Escape');
      await expect(chooser).toHaveCount(0); await expect(event).toBeVisible();
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await page.keyboard.press('Escape');
      await expect(event).toHaveCount(0);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    });

    test('English choices remain readable in dark mode without horizontal overflow', async ({ page }) => {
      await page.goto('/profile');
      await page.getByRole('button', { name: '저장하기', exact: true }).click();
      await page.getByRole('combobox', { name: '언어', exact: true }).selectOption('en');
      await page.getByRole('button', { name: 'Dark', exact: true }).click();
      await page.goto('/places');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      const place = page.locator('.place-directory-card').first();
      await place.getByRole('button', { name: 'Directions', exact: true }).click();
      const chooser = page.getByRole('dialog', { name: 'Choose a map for directions', exact: true });
      await expect(chooser).toBeVisible();
      expect(await chooser.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('aria-label')))).toEqual(['NAVER Maps', 'Kakao Map', 'Google Maps']);
      await expect(chooser.getByRole('link', { name: 'NAVER Maps', exact: true })).toHaveAccessibleDescription('Choose a place, then Directions');
      expect(await chooser.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const link of await chooser.getByRole('link').all()) await expect(link).toBeVisible();
    });
  });
}
