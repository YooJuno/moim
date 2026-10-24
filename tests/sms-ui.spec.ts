import {expect,test} from '@playwright/test';

test('demo event SMS shows a disabled paid operation and never calls the notification backend',async({page})=>{
 const calls:string[]=[];page.on('request',request=>{if(/solapi\.com|\/notifications\/sms\//.test(request.url()))calls.push(request.url());});
 await page.goto('/calendar?event=event-coffee');await page.getByRole('dialog').getByRole('button',{name:'문자 알림',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'일정 문자 알림',exact:true});await expect(dialog).toContainText('데모에서는 문자를 보내지 않아요.');await expect(dialog.getByRole('button',{name:'문자 보내기',exact:true})).toBeDisabled();
 await page.setViewportSize({width:390,height:844});expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
 await dialog.getByRole('button',{name:'닫기',exact:true}).last().click();await expect(page.getByRole('dialog')).toHaveAccessibleName('커피 한 잔, 함께해요');expect(calls).toEqual([]);
});

test('SMS settings start off, automatic sending is disabled and viewing settings sends nothing',async({page})=>{
 const calls:string[]=[];page.on('request',request=>{if(/solapi\.com|\/notifications\/sms\//.test(request.url()))calls.push(request.url());});
 await page.goto('/settings');const section=page.getByRole('region',{name:'문자 알림 설정',exact:true});await expect(section.getByRole('checkbox',{name:/문자 알림 사용/})).not.toBeChecked();await expect(section.getByRole('checkbox',{name:/일정 확정 시 자동 발송/})).toBeDisabled();await expect(section).toContainText('45원 + VAT');expect(calls).toEqual([]);
 await page.setViewportSize({width:390,height:844});expect(await section.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
});
