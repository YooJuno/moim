import { test, expect } from '@playwright/test';

for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  test.describe(`생일 달력 선택 ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height}});
    test('연도 없이 윤일을 선택하고 키보드·지우기·저장을 지원한다',async({page})=>{
      await page.goto('/profile');
      const input=page.getByRole('textbox',{name:'생일',exact:true});
      await expect(input).toHaveAttribute('readonly','');
      await input.click();
      let picker=page.getByRole('dialog',{name:'생일 선택',exact:true});
      await expect(picker.getByRole('combobox',{name:'월 선택',exact:true})).toBeFocused();
      await picker.getByRole('combobox',{name:'월 선택',exact:true}).selectOption('2');
      await expect(picker.getByRole('combobox',{name:'일 선택',exact:true}).locator('option')).toHaveCount(29);
      await expect(picker.locator('[data-birthday-day]')).toHaveCount(29);
      await expect(picker.locator('input[type=date]')).toHaveCount(0);
      await picker.locator('[data-birthday-day="28"]').focus();
      await page.keyboard.press('ArrowRight');
      await expect(picker.locator('[data-birthday-day="29"]')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(picker).toHaveCount(0);
      await expect(input).toHaveValue('02-29');
      await expect(input).toBeFocused();
      await page.getByRole('button',{name:'저장하기',exact:true}).click();
      await page.reload();
      await expect(input).toHaveValue('02-29');
      await input.press('Enter');
      picker=page.getByRole('dialog',{name:'생일 선택',exact:true});
      await picker.getByRole('combobox',{name:'월 선택',exact:true}).selectOption('4');
      await expect(picker.getByRole('combobox',{name:'일 선택',exact:true}).locator('option')).toHaveCount(30);
      await page.keyboard.press('Escape');
      await expect(input).toHaveValue('02-29');
      await expect(input).toBeFocused();
      await page.getByRole('button',{name:'생일 지우기',exact:true}).click();
      await expect(input).toHaveValue('');
      await page.getByRole('button',{name:'저장하기',exact:true}).click();
      await page.reload();
      await expect(input).toHaveValue('');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    });
    test('멤버 편집창 안에서 생일을 선택해도 바깥 편집창을 닫지 않는다',async({page})=>{
      await page.goto('/members');
      await page.locator('.member-row').filter({hasText:'박서연'}).getByRole('button',{name:/박서연/}).first().click();
      const editor=page.getByRole('dialog',{name:'멤버 관리',exact:true});
      await editor.getByRole('textbox',{name:'생일',exact:true}).click();
      const picker=page.getByRole('dialog',{name:'생일 선택',exact:true});
      await page.keyboard.press('Escape');
      await expect(picker).toHaveCount(0);
      await expect(editor).toBeVisible();
      await editor.getByRole('textbox',{name:'생일',exact:true}).click();
      await picker.getByRole('combobox',{name:'월 선택',exact:true}).selectOption('2');
      await picker.getByRole('combobox',{name:'일 선택',exact:true}).selectOption('29');
      await picker.getByRole('button',{name:'선택',exact:true}).click();
      await expect(editor).toBeVisible();
      await expect(editor.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('02-29');
      await editor.getByRole('button',{name:'저장',exact:true}).click();
      await expect(editor).toHaveCount(0);
    });
  });
}
