import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function showLogin(page:Page){await page.goto('/profile');await page.getByRole('button',{name:'로그아웃',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'로그아웃',exact:true}).click();await expect(page.getByRole('heading',{name:'로그인',exact:true})).toBeVisible();}
async function configuration(page:Page,status=200){
  await page.route('**/src/lib/social-auth.ts*',async route=>{const response=await route.fetch();const body=await response.text();expect(body).toContain('import.meta.env.VITE_AUTH_API_URL');await route.fulfill({response,body:body.replaceAll('import.meta.env.VITE_AUTH_API_URL',JSON.stringify('https://auth.mock.test/'))});});
  // Exercise provider availability while keeping the test's isolated demo identity.
  await page.route('**/src/pages/Login.tsx*',async route=>{const response=await route.fetch();const body=await response.text();expect(body).toContain('!isDemo && providerConfig.enabled');await route.fulfill({response,body:body.replace('!isDemo && providerConfig.enabled','providerConfig.enabled')});});
  await page.route('https://auth.mock.test/config',route=>route.fulfill({status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'http://localhost:5173'},body:JSON.stringify({providers:{kakao:true,naver:false},calendar:{kakao:false}})}));
}
function callbackMock(fail=false){return `
 export function useAuthProviderConfig(){return {enabled:false,loading:false,providers:{kakao:false,naver:false},calendar:{kakao:false}};}
 export async function exchangeSocialCallback(params){window.__exchangeCalls=(window.__exchangeCalls||0)+1;window.__callbackQuery=window.location.search;await new Promise(resolve=>setTimeout(resolve,80));${fail?"throw new Error('로그인 요청이 만료됐어요. 다시 시작해 주세요.');":"return {uid:'demo-me',provider:params.get('provider'),intent:params.get('intent')};"}}
 export async function getAccountProviders(){return {google:true,kakao:false,naver:false,calendar:{kakao:false}};}
 export async function startSocialAuth(){throw new Error('not used');}
 export async function linkGoogleAccount(){throw new Error('not used');}
 export async function addToKakaoCalendar(){throw new Error('not used');}
 `;}

test('설정되지 않은 소셜 제공자는 표시하지 않고 기존 데모 로그인은 동작한다',async({page})=>{
  await showLogin(page);
  await expect(page.getByRole('button',{name:'카카오로 로그인',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'네이버로 로그인',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'데모 둘러보기',exact:true}).click();
  await expect(page.getByRole('heading',{name:'내 정보',exact:true})).toBeVisible();
});

test('도달 가능한 설정에서 활성화한 제공자만 로그인 버튼으로 표시한다',async({page})=>{
  await configuration(page);
  await showLogin(page);
  await expect(page.getByRole('button',{name:'카카오로 로그인',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'네이버로 로그인',exact:true})).toHaveCount(0);
  await expect(page.getByText('기존 계정은 로그인 후 연결해 주세요.',{exact:true})).toBeVisible();
});

test('인증 서비스가 응답하지 않으면 소셜 버튼 없이 기존 로그인을 유지한다',async({page})=>{
  await configuration(page,503);
  await showLogin(page);
  await expect(page.getByRole('button',{name:'데모 둘러보기',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'카카오로 로그인',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'네이버로 로그인',exact:true})).toHaveCount(0);
});

test('계정 연결 콜백은 쿼리를 지우고 한 번만 교환한 뒤 내 정보로 돌아간다',async({page})=>{
  await page.route('**/src/lib/social-auth.ts*',route=>route.fulfill({contentType:'text/javascript',body:callbackMock()}));
  await page.goto(`/auth/callback?code=${'c'.repeat(43)}&provider=kakao&intent=link`);
  await expect(page).toHaveURL(/\/profile$/);
  expect(await page.evaluate(()=>({calls:(window as unknown as {__exchangeCalls:number}).__exchangeCalls,query:(window as unknown as {__callbackQuery:string}).__callbackQuery}))).toEqual({calls:1,query:''});
  await expect(page.getByRole('heading',{name:'내 정보',exact:true})).toBeVisible();
});

test('실패한 콜백도 교환 코드 쿼리를 지우고 재시작 동작을 제공한다',async({page})=>{
  await page.route('**/src/lib/social-auth.ts*',route=>route.fulfill({contentType:'text/javascript',body:callbackMock(true)}));
  await page.goto(`/auth/callback?code=${'c'.repeat(43)}&provider=naver&intent=signin`);
  await expect(page.getByRole('alert')).toContainText('로그인 요청이 만료됐어요.');
  expect(new URL(page.url()).search).toBe('');
  expect(await page.evaluate(()=>(window as unknown as {__exchangeCalls:number}).__exchangeCalls)).toBe(1);
  await page.getByRole('button',{name:'로그인으로 돌아가기',exact:true}).click();
  await expect(page).toHaveURL('http://localhost:5173/');
});
