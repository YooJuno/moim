import { test, expect } from '@playwright/test';

async function interceptProfiles(page: import('@playwright/test').Page) {
  await page.route('**/src/lib/store.tsx*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    const marker = 'const [data, setData] = useState(initialData);';
    expect(body).toContain(marker);
    body = body.replace(marker, `const [data, setData] = useState(()=>({...initialData(),profiles:[]}));
useEffect(()=>{const deliver=event=>setData(current=>({...current,profiles:event.detail}));window.addEventListener('moim:test-profile-delivery',deliver);return()=>window.removeEventListener('moim:test-profile-delivery',deliver);},[]);`);
    await route.fulfill({ response, body });
  });
}

test('내 정보가 늦게 도착하면 빈 값으로 저장하지 않고 편집 중 갱신도 보존한다', async ({ page }) => {
  await interceptProfiles(page);
  await page.goto('/profile');
  await expect(page.getByRole('status')).toHaveText('개인정보 불러오는 중');
  await expect(page.getByLabel(/^이름/)).toBeDisabled();
  await expect(page.getByLabel('전화번호')).toBeDisabled();
  await expect(page.getByRole('button', { name: '저장하기', exact: true })).toBeDisabled();
  const profiles = await page.evaluate(async () => {
    const { createDemoData } = await import('/src/data/demo.ts');
    return createDemoData().profiles.map((profile: { id: string; phone: string; area: string; birthday?: string }) => profile.id === 'demo-me' ? { ...profile, birthday: '02-29' } : profile);
  });
  await page.evaluate(values => window.dispatchEvent(new CustomEvent('moim:test-profile-delivery', { detail: values })), profiles);
  await expect(page.getByLabel('전화번호')).toBeEnabled();
  const original = profiles.find((profile: { id: string }) => profile.id === 'demo-me')!;
  await expect(page.getByLabel('전화번호')).toHaveValue(original.phone);
  await expect(page.getByLabel('거주 지역')).toHaveValue(original.area);
  await expect(page.getByRole('textbox', { name: '생일', exact: true })).toHaveValue('02-29');
  await page.getByLabel(/^이름/).fill('수정 중인 이름');
  await page.getByLabel('전화번호').fill('010-1234-5678');
  await page.evaluate(values => window.dispatchEvent(new CustomEvent('moim:test-profile-delivery', { detail: values })), profiles.map((profile: { id: string }) => profile.id === 'demo-me' ? { ...profile, phone: '010-9999-9999', area: '갱신된 지역', birthday: '11-11' } : profile));
  await expect(page.getByLabel(/^이름/)).toHaveValue('수정 중인 이름');
  await expect(page.getByLabel('전화번호')).toHaveValue('010-1234-5678');
  await expect(page.getByLabel('거주 지역')).toHaveValue(original.area);
  await expect(page.getByRole('textbox', { name: '생일', exact: true })).toHaveValue('02-29');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  const saved = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return { member: data.members.find((member: { id: string }) => member.id === 'demo-me'), profile: data.profiles.find((profile: { id: string }) => profile.id === 'demo-me') };
  });
  expect(saved.member.name).toBe('수정 중인 이름');
  expect(saved.profile).toMatchObject({ phone: '010-1234-5678', area: original.area, birthday: '02-29' });
});
