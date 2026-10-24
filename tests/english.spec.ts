import { expect, test, type Page } from '@playwright/test';

async function assertEnglishChrome(page:Page){
  const labels=await page.locator('.page-header h1, .field-label, .tabs button, .desktop-nav .nav-link, .mobile-nav, .breadcrumb strong, .board-categories, .member-list-head, .ledger-list-head').allTextContents();
  expect(labels.filter(label=>/[가-힣]/.test(label))).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
}

for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  test(`English navigation, poll results and ledger preserve stored values (${viewport.name})`,async({page})=>{
    await page.setViewportSize(viewport);
    await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));
    await page.goto('/profile');
    await page.getByRole('combobox',{name:'언어',exact:true}).selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('lang','en');
    const routes:[string,string][]=[['/','Group home'],['/polls','Schedule polls'],['/calendar','Group events'],['/board','Board'],['/members','Members'],['/ledger','Ledger'],['/rules','Group rules'],['/places','Saved places'],['/settings','Group settings']];
    for(const [url,title]of routes){await page.goto(url);await expect(page.locator('.page-header h1')).toHaveText(title);await assertEnglishChrome(page);}
    await page.goto('/board');
    await expect(page.getByRole('button',{name:'Chat',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Tips',exact:true})).toBeVisible();
    await page.goto('/polls?create=1');
    const editor=page.getByRole('dialog');
    await expect(editor).toHaveAccessibleName('New schedule poll');
    await editor.getByRole('button',{name:'Clear selection',exact:true}).click();
    await editor.getByLabel('Poll title').fill('English schedule smoke');
    await editor.locator('.poll-common-times .time-input').first().fill('18:00');
    await editor.locator('.poll-common-times select').first().selectOption('21:00');
    await editor.locator('[data-date="2026-10-31"]').click();
    await assertEnglishChrome(page);
    await editor.getByRole('button',{name:'Create poll',exact:true}).click();
    const detail=page.getByRole('dialog');
    await expect(detail).toHaveAccessibleName('English schedule smoke');
    await detail.locator('.poll-time-cell').first().click();
    await detail.getByRole('button',{name:'Save selection',exact:true}).click();
    await expect(page.locator('.toast').last()).toHaveText('Your availability has been saved.');
    await detail.getByRole('button',{name:'Show results',exact:false}).click();
    await expect(detail.locator('.poll-result-filters')).not.toContainText(/[가-힣]/);
    await expect(detail.locator('.poll-availability-duration').first()).toContainText('1h');
    await detail.getByRole('button',{name:'Close',exact:true}).first().click();
    await page.goto('/members');
    await page.locator('.member-person').first().click();
    await assertEnglishChrome(page);
    const permissionSelect=page.getByRole('dialog').getByRole('combobox',{name:'Permissions',exact:true});
    await expect(permissionSelect).toBeVisible();
    const roles=await permissionSelect.locator('option').allTextContents();
    expect(roles).toEqual(['Administrator','Accountant','Member']);
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).last().click();
    await page.goto('/ledger');
    await page.getByRole('button',{name:'Add entry',exact:true}).click();
    await page.getByRole('combobox',{name:'Category',exact:true}).selectOption({label:'Venue rental'});
    await page.getByRole('spinbutton',{name:/^Amount/}).fill('12000');
    await page.getByRole('textbox',{name:/^Description/}).fill('English ledger smoke');
    await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();
    await expect(page.locator('.ledger-row').filter({hasText:'English ledger smoke'})).toContainText('Venue rental');
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).ledger.find((entry:{description:string})=>entry.description==='English ledger smoke'));
    expect(stored.category).toBe('대관');
    await assertEnglishChrome(page);
    await page.screenshot({path:`/tmp/moim-english-${viewport.name}.png`,fullPage:true});
  });
}
