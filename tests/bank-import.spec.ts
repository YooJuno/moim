import { expect, test } from '@playwright/test';
import { bankPlan } from './helpers/bank-plan';

for (const width of [390,1440]) {
  test(`bank import previews, saves new rows and skips repeated exports at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});const plan=await bankPlan();
    await page.route('**/src/lib/read-bank-file.ts*',route=>route.fulfill({contentType:'text/javascript',body:`export async function readBankFile(file,password){if(password!=='test-password')throw Error('비밀번호가 맞지 않거나 파일을 열 수 없어요.');return ${JSON.stringify(plan)};}`}));
    await page.goto('/ledger');
    const open=async()=>{await page.getByRole('button',{name:'엑셀 가져오기',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('거래내역 엑셀',{exact:true}).setInputFiles({name:'bank.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('test-fixture')});return dialog;};
    let dialog=await open();await dialog.getByLabel('엑셀 비밀번호',{exact:true}).fill('wrong-password');await dialog.getByRole('button',{name:'내역 확인',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('비밀번호');
    await dialog.getByLabel('엑셀 비밀번호',{exact:true}).fill('test-password');await dialog.getByRole('button',{name:'내역 확인',exact:true}).click();
    await expect(dialog.locator('.bank-import-counts strong').first()).toHaveText('2');
    await expect(dialog.locator('.bank-import-row')).toHaveCount(2);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')||'null')?.ledger?.some((row:any)=>row.id.startsWith('banktx-'))??false)).toBe(false);
    await dialog.getByRole('button',{name:'2건 반영',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.ledger-row').filter({hasText:'가져온 회비'})).toContainText('11월 회비');
    await page.getByRole('button',{name:'가져온 대관료 수정',exact:true}).click();
    await page.getByRole('dialog').getByLabel('비고',{exact:true}).fill('직접 수정한 비고');await page.getByRole('dialog').getByRole('button',{name:'저장',exact:true}).click();
    dialog=await open();await dialog.getByLabel('엑셀 비밀번호',{exact:true}).fill('test-password');await dialog.getByRole('button',{name:'내역 확인',exact:true}).click();
    await expect(dialog.locator('.bank-import-counts strong').first()).toHaveText('0');await expect(dialog.locator('.bank-import-counts strong').nth(1)).toHaveText('2');await expect(dialog.getByRole('button',{name:'0건 반영',exact:true})).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const state=await page.evaluate(()=>localStorage.getItem('moim-demo-v1')!);expect(state).not.toContain('test-password');expect(JSON.parse(state).ledger.filter((row:any)=>row.id.startsWith('banktx-'))).toHaveLength(2);expect(JSON.parse(state).ledger.find((row:any)=>row.description==='가져온 대관료').memo).toBe('직접 수정한 비고');
  });
}
