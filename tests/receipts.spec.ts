import { test, expect } from '@playwright/test';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQyf4LAAJDAY2a3VQGAAAAAElFTkSuQmCC';
const fixture=(name:string)=>({name,mimeType:'image/png',buffer:Buffer.from(png,'base64')});

for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  test.describe(`회계 영수증 ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height}});

    test('첨부·저장·새로고침·교체·삭제와 일반 멤버 조회',async({page})=>{
      await page.goto('/ledger');
      await page.getByRole('button',{name:'내역 추가',exact:true}).first().click();
      const editor=page.getByRole('dialog');
      await editor.getByRole('button',{name:'지출',exact:true}).click();
      await editor.getByLabel('금액').fill('12500');
      await editor.getByLabel('내역',{exact:false}).fill('샘플 영수증 간식비');
      const largePng=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=2000;const context=canvas.getContext('2d')!;context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#222222';context.font='32px sans-serif';context.fillText('SAMPLE',30,50);return canvas.toDataURL('image/png').split(',')[1];});
      await editor.getByLabel('영수증 사진',{exact:true}).setInputFiles({name:'receipt-first.png',mimeType:'image/png',buffer:Buffer.from(largePng,'base64')});
      await expect(editor.getByRole('img',{name:'영수증 미리보기'})).toBeVisible();
      await editor.getByRole('button',{name:'저장',exact:true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.reload();
      const row=page.locator('.ledger-row').filter({hasText:'샘플 영수증 간식비'});
      await row.getByRole('button',{name:'영수증 보기',exact:true}).click();
      let viewer=page.getByRole('dialog');
      const image=viewer.getByRole('img',{name:'샘플 영수증 간식비 영수증'});
      await expect(image).toBeVisible();
      await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.naturalWidth)).toBeGreaterThan(0);
      await viewer.getByRole('button',{name:'영수증 확대 보기',exact:true}).first().click();
      await expect(viewer.locator('.ledger-receipt-image')).toHaveClass(/is-zoomed/);
      expect(await image.evaluate(element=>element.getBoundingClientRect().width)).toBeGreaterThan(await viewer.locator('.ledger-receipt-image').evaluate(element=>element.clientWidth));
      await viewer.getByLabel('영수증 사진 변경',{exact:true}).setInputFiles(fixture('receipt-replaced.png'));
      await expect(viewer.locator('.ledger-receipt-file-name')).toHaveText('receipt-replaced.png');
      await viewer.getByRole('button',{name:'닫기',exact:true}).last().click();
      await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const me=data.members.find((member:{id:string})=>member.id==='demo-me');me.role='member';me.canCreatePoll=false;localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
      await page.reload();
      await row.getByRole('button',{name:'영수증 보기',exact:true}).click();
      viewer=page.getByRole('dialog');
      await expect(viewer.getByRole('img',{name:'샘플 영수증 간식비 영수증'})).toBeVisible();
      await expect(viewer.getByRole('button',{name:'사진 변경',exact:true})).toHaveCount(0);
      await expect(viewer.getByRole('button',{name:'영수증 삭제',exact:true})).toHaveCount(0);
      await expect(viewer.getByLabel('영수증 사진 변경',{exact:true})).toHaveCount(0);
      await viewer.getByRole('button',{name:'닫기',exact:true}).last().click();
      await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const me=data.members.find((member:{id:string})=>member.id==='demo-me');me.role='leader';me.canCreatePoll=true;localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
      await page.reload();
      await row.getByRole('button',{name:'영수증 보기',exact:true}).click();
      viewer=page.getByRole('dialog');
      await viewer.getByRole('button',{name:'영수증 삭제',exact:true}).click();
      await viewer.locator('.community-confirm').getByRole('button',{name:'삭제',exact:true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(row.getByRole('button',{name:'영수증 보기',exact:true})).toHaveCount(0);
      await page.reload();
      await expect(row).toHaveCount(1);
      await expect(row.getByRole('button',{name:'영수증 보기',exact:true})).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    });

    test('영수증 저장 실패 후 재시도해도 회계 내역이 중복되지 않는다',async({page})=>{
      await page.goto('/ledger');
      await page.getByRole('button',{name:'내역 추가',exact:true}).first().click();
      let editor=page.getByRole('dialog');
      await editor.getByLabel('금액').fill('9000');
      await editor.getByLabel('내역',{exact:false}).fill('영수증 재시도 검증');
      await editor.getByLabel('영수증 사진',{exact:true}).setInputFiles({name:'unreadable.png',mimeType:'image/png',buffer:Buffer.from('not-an-image')});
      await editor.getByRole('button',{name:'저장',exact:true}).click();
      await expect(editor.getByText('내역은 저장됐어요. 영수증을 다시 저장해 주세요.',{exact:true})).toBeVisible();
      await expect(editor.getByText('unreadable.png',{exact:true})).toBeVisible();
      await editor.getByLabel('영수증 사진',{exact:true}).setInputFiles(fixture('receipt-retry.png'));
      await editor.getByRole('button',{name:'저장',exact:true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const row=page.locator('.ledger-row').filter({hasText:'영수증 재시도 검증'});
      await expect(row).toHaveCount(1);
      await expect(row.getByRole('button',{name:'영수증 보기',exact:true})).toBeVisible();
      await row.getByRole('button',{name:'영수증 재시도 검증 수정',exact:true}).click();
      editor=page.getByRole('dialog');
      await expect(editor.getByRole('img',{name:'영수증 미리보기'})).toBeVisible();
      await editor.getByRole('button',{name:'첨부 영수증 삭제',exact:true}).click();
      await editor.getByRole('button',{name:'저장',exact:true}).click();
      await page.reload();
      await expect(row).toHaveCount(1);
      await expect(row.getByRole('button',{name:'영수증 보기',exact:true})).toHaveCount(0);
    });
  });
}
