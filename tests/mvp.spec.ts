import { test,expect } from '@playwright/test';
test.use({timezoneId:'Asia/Seoul'});
test('MVP opens at the event end, alerts attendees and closes exactly one hour later',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));await page.goto('/calendar?event=event-coffee');
 const section=page.getByRole('region',{name:'MVP 투표'}); // semantic section with aria-label
 await expect(section.getByText('예정',{exact:true})).toBeVisible();await expect(section.getByRole('button',{name:'이준호 MVP 선택'})).toBeDisabled();
 await page.clock.setFixedTime(new Date('2026-10-27T15:50:00+09:00'));
 await expect(section.getByText('예정',{exact:true})).toBeVisible();await expect(page.locator('.mvp-alert')).toHaveCount(0);
 await page.clock.setFixedTime(new Date('2026-10-27T16:00:00+09:00'));
 await expect(page.locator('.mvp-alert')).toContainText('MVP 투표 시작');await expect(section.getByText('투표 중',{exact:true})).toBeVisible();
 await expect(section.locator('.mvp-submit')).toContainText('17:00 마감');
 await section.getByRole('button',{name:'이준호 MVP 선택'}).click();await section.getByRole('button',{name:'투표하기',exact:true}).click();await expect(section).toContainText('응답 1명');await expect(page.locator('.mvp-alert')).toHaveCount(0);
 await page.reload();await expect(page.getByRole('region',{name:'MVP 투표'}).getByRole('button',{name:'이준호 MVP 선택'})).toHaveAttribute('aria-pressed','true');
 await page.clock.setFixedTime(new Date('2026-10-27T16:59:59+09:00'));await expect(section.getByText('투표 중',{exact:true})).toBeVisible();
 await page.clock.setFixedTime(new Date('2026-10-27T17:00:00+09:00'));await expect(section.getByText('마감',{exact:true})).toBeVisible();await expect(section.getByRole('button',{name:'이준호 MVP 선택'})).toBeDisabled();
});
test('nonattendees receive no MVP notification and cannot vote',async({page})=>{
 await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));await page.goto('/calendar?event=event-coffee');await page.getByRole('button',{name:'어려워요',exact:true}).click();await expect(page.getByText('불참으로 등록했어요.',{exact:false})).toBeVisible();await page.clock.setFixedTime(new Date('2026-10-27T16:00:00+09:00'));const section=page.getByRole('region',{name:'MVP 투표'});await expect(section).toContainText('참석자로 등록한 멤버만');await expect(section.getByRole('button',{name:'이준호 MVP 선택'})).toBeDisabled();await expect(page.locator('.mvp-alert')).toHaveCount(0);
});
