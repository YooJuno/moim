import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function chooseBirthday(page: Page, value: string) {
  if (!value) {
    await page.getByRole('button', { name: '생일 지우기', exact: true }).click();
    await expect(page.getByRole('textbox', { name: '생일', exact: true })).toHaveValue('');
    return;
  }

  const [month, day] = value.split('-').map(Number);
  await page.getByRole('textbox', { name: '생일', exact: true }).click();
  const picker = page.getByRole('dialog', { name: '생일 선택', exact: true });
  await picker.getByRole('combobox', { name: '월 선택', exact: true }).selectOption(String(month));
  await picker.getByRole('combobox', { name: '일 선택', exact: true }).selectOption(String(day));
  await picker.getByRole('button', { name: '선택', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '생일', exact: true })).toHaveValue(value);
}
