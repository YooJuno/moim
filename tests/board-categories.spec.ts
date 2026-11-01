import {expect,test} from '@playwright/test';

for(const width of [390,1440]) {
  test(`retired info posts remain readable and editable from chat at ${width}px`, async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/profile');
    await page.getByRole('button',{name:'저장하기',exact:true}).click();
    await page.evaluate(()=>{
      const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);
      data.posts[0].category='info';data.posts[0].title='이전 정보 게시글';
      localStorage.setItem('moim-demo-v1',JSON.stringify(data));
    });
    await page.goto('/board?category=info');
    await expect(page.getByRole('button',{name:'정보 나눔',exact:true})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'자유게시판',exact:true})).toHaveClass(/active/);
    await page.locator('.board-post-row').filter({hasText:'이전 정보 게시글'}).click();
    let dialog=page.getByRole('dialog');
    await expect(dialog).toHaveAccessibleName('자유게시판');
    await dialog.getByRole('button',{name:'게시글 관리',exact:true}).click();
    await dialog.getByRole('button',{name:'수정하기',exact:true}).click();
    dialog=page.getByRole('dialog');
    await expect(dialog.getByRole('combobox',{name:'게시판',exact:true})).toHaveValue('chat');
    await expect(dialog.getByRole('combobox',{name:'게시판',exact:true}).locator('option[value="info"]')).toHaveCount(0);
    await dialog.getByRole('button',{name:'수정 완료',exact:true}).click();
    await expect(dialog.getByRole('heading',{name:'이전 정보 게시글',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).posts[0].category)).toBe('chat');
  });
}
