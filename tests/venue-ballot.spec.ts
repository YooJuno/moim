import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function createVenueBallot(page:Page) {
  await page.goto('/calendar?event=event-coffee');
  const section=page.locator('.venue-ballot');
  await section.getByRole('button',{name:'만들기',exact:true}).click();
  const editor=page.getByRole('dialog').last();
  const candidates=editor.locator('.venue-editor-option');
  await candidates.nth(0).getByLabel('장소 이름').fill('연남 식탁');
  await candidates.nth(0).getByLabel('주소').fill('서울 마포구 연남로 10');
  await candidates.nth(0).getByLabel('메뉴').fill('파스타');
  await candidates.nth(1).getByLabel('장소 이름').fill('성수 밥집');
  await candidates.nth(1).getByLabel('주소').fill('서울 성동구 성수로 20');
  await candidates.nth(1).getByLabel('메뉴').fill('한식');
  await editor.getByRole('button',{name:'투표 만들기',exact:true}).click();
  await expect(section.getByRole('radio',{name:/연남 식탁/})).toBeVisible();
  return section;
}

for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]) {
  test.describe(`장소 투표 ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height},timezoneId:'Asia/Seoul'});
    test.beforeEach(async({page})=>{await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));});

    test('후보 작성, 투표 변경, 후보 편집, 마감과 장소 확정',async({page})=>{
      const section=await createVenueBallot(page);
      await section.getByRole('radio',{name:/연남 식탁/}).click();
      await section.getByRole('button',{name:'투표하기',exact:true}).click();
      await expect(section.getByRole('radio',{name:/연남 식탁.*1표/})).toHaveAttribute('aria-checked','true');
      await section.getByRole('radio',{name:/성수 밥집/}).click();
      await section.getByRole('button',{name:'투표 변경',exact:true}).click();
      await expect(section.getByRole('radio',{name:/성수 밥집.*1표/})).toHaveAttribute('aria-checked','true');
      await expect(section.getByRole('radio',{name:/연남 식탁.*0표/})).toHaveAttribute('aria-checked','false');
      await section.getByRole('button',{name:'후보 수정',exact:true}).click();
      const editor=page.getByRole('dialog').last();
      await editor.getByRole('button',{name:/후보 추가/}).click();
      await editor.locator('.venue-editor-option').nth(2).getByLabel('장소 이름').fill('종로 모임실');
      await editor.locator('.venue-editor-option').nth(2).getByLabel('주소').fill('서울 종로구 종로 30');
      await editor.locator('.venue-editor-option').nth(2).getByLabel('메뉴').fill('도시락');
      await editor.getByRole('button',{name:'후보 2 삭제',exact:true}).click();
      await editor.getByRole('button',{name:'저장',exact:true}).click();
      await expect(section.getByText('선택한 후보가 삭제됐어요. 다시 투표해 주세요.',{exact:true})).toBeVisible();
      await expect(section.getByRole('radio',{name:/연남 식탁/})).toHaveCount(1);
      await expect(section.getByRole('radio',{name:/성수 밥집/})).toHaveCount(0);
      await section.getByRole('radio',{name:/종로 모임실/}).click();
      await section.getByRole('button',{name:'투표 변경',exact:true}).click();
      await section.getByRole('button',{name:'투표 마감',exact:true}).click();
      await expect(section.getByRole('radio',{name:/종로 모임실/})).toBeDisabled();
      await section.getByRole('button',{name:'다시 열기',exact:true}).click();
      await expect(section.getByRole('radio',{name:/종로 모임실/})).toBeEnabled();
      await section.getByRole('button',{name:'장소 확정',exact:true}).click();
      const confirmation=page.getByRole('dialog').last();
      await expect(confirmation.getByLabel('확정할 장소')).toContainText('종로 모임실 · 1표');
      await confirmation.getByRole('button',{name:'장소 확정',exact:true}).click();
      await expect(page.getByRole('dialog').locator('.event-location')).toContainText('종로 모임실 · 서울 종로구 종로 30');
      await expect(section.locator('.venue-option.is-winner')).toContainText('종로 모임실');
      await expect(section.getByRole('radio',{name:/종로 모임실.*1표/})).toBeDisabled();
      await expect(section.getByRole('button',{name:'후보 수정',exact:true})).toHaveCount(0);
      await page.reload();
      await expect(section.locator('.venue-option.is-winner')).toContainText('종로 모임실');
      await expect(section.getByRole('radio',{name:/종로 모임실.*1표/})).toHaveAttribute('aria-checked','true');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    });

    test('미확정 투표를 삭제하면 후보와 응답이 제거된다',async({page})=>{
      const section=await createVenueBallot(page);
      await section.getByRole('radio',{name:/연남 식탁/}).click();
      await section.getByRole('button',{name:'투표하기',exact:true}).click();
      await section.getByRole('button',{name:'장소 투표 삭제',exact:true}).click();
      await page.getByRole('dialog').last().getByRole('button',{name:'삭제',exact:true}).click();
      await expect(section.getByRole('radio')).toHaveCount(0);
      await expect(section.getByRole('button',{name:'만들기',exact:true})).toBeVisible();
      const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!));
      expect(data.ballots.filter((ballot:{eventId:string})=>ballot.eventId==='event-coffee')).toHaveLength(0);
      expect(data.ballotResponses.filter((response:{eventId:string})=>response.eventId==='event-coffee')).toHaveLength(0);
    });

    test('일반 멤버은 투표하며 운영 기능은 표시되지 않는다',async({page})=>{
      await createVenueBallot(page);
      await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const member=data.members.find((item:{id:string})=>item.id==='demo-me');member.role='member';member.canCreatePoll=false;localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
      await page.reload();
      const section=page.locator('.venue-ballot');
      await expect(section.getByRole('button',{name:'후보 수정',exact:true})).toHaveCount(0);
      await expect(section.getByRole('button',{name:'장소 확정',exact:true})).toHaveCount(0);
      await expect(section.getByRole('button',{name:'투표 마감',exact:true})).toHaveCount(0);
      await section.getByRole('radio',{name:/연남 식탁/}).click();
      await section.getByRole('button',{name:'투표하기',exact:true}).click();
      await expect(section.getByRole('radio',{name:/연남 식탁.*1표/})).toHaveAttribute('aria-checked','true');
    });
  });
}
