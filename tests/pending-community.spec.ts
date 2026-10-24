import { test, expect } from '@playwright/test';

for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  test.describe(`승인 대기 둘러보기 ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height}});
    test('게시글·공개 멤버는 읽고 개인 정보와 화면 설정만 수정한다',async({page})=>{
      await page.goto('/profile');
      await page.getByRole('button',{name:'저장하기',exact:true}).click();
      await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const me=data.members.find((member:{id:string})=>member.id==='demo-me');me.status='pending';me.role='member';me.canCreatePoll=false;localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
      await page.goto('/board?post=post-notice');
      const detail=page.getByRole('dialog');
      await expect(detail.getByRole('heading',{name:'우리 모임, 이렇게 함께해요',exact:true})).toBeVisible();
      await expect(detail.getByRole('button',{name:/좋아요/})).toBeDisabled();
      await expect(detail.getByRole('button',{name:'게시글 관리',exact:true})).toHaveCount(0);
      await expect(detail.getByLabel('댓글 내용')).toHaveCount(0);
      await expect(detail.getByRole('button',{name:'댓글 삭제',exact:true})).toHaveCount(0);
      await detail.getByRole('button',{name:'닫기',exact:true}).click();
      await expect(page.getByRole('button',{name:'글쓰기',exact:true})).toHaveCount(0);
      await page.goto('/members');
      await expect(page.getByRole('button',{name:'멤버 추가',exact:true})).toHaveCount(0);
      await expect(page.locator('.member-row').filter({hasText:'신예린'})).toHaveCount(0);
      await expect(page.locator('.member-row').filter({hasText:'김민서'})).toHaveCount(0);
      await page.locator('.member-row').filter({hasText:'이준호'}).getByRole('button',{name:/이준호/}).first().click();
      await expect(page.getByRole('dialog').getByLabel('전화번호')).toHaveCount(0);
      await expect(page.getByRole('dialog').getByRole('textbox',{name:'생일',exact:true})).toHaveCount(0);
      await page.goto('/profile');
      await page.getByLabel('전화번호').fill('010-0000-9915');
      await page.getByRole('button',{name:'저장하기',exact:true}).click();
      await page.getByRole('combobox',{name:'언어',exact:true}).selectOption('en');
      await expect(page.locator('html')).toHaveAttribute('lang','en');
      await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).profiles.find((profile:{id:string})=>profile.id==='demo-me')?.language)).toBe('en');
      const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!));
      expect(stored.profiles.find((profile:{id:string})=>profile.id==='demo-me')).toMatchObject({phone:'010-0000-9915',language:'en'});
      expect(stored.members.find((member:{id:string})=>member.id==='demo-me').status).toBe('pending');
    });
  });
}
