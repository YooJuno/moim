import {expect,test,type Page} from '@playwright/test';

async function pendingDemo(page:Page){
  await page.clock.setFixedTime(new Date('2026-10-24T15:55:00+09:00'));
  await page.goto('/profile');
  await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);
    const me=data.members.find((member:{id:string})=>member.id==='demo-me');
    // Retain privileged stored flags to verify status, rather than role alone, gates operations.
    me.status='pending';me.role='leader';me.canCreatePoll=true;
    const event=data.events.find((event:{id:string})=>event.id==='event-coffee');
    event.date='2026-10-24';event.start='14:00';event.end='16:00';
    data.ballots.push({id:'event-coffee-venue',eventId:'event-coffee',kind:'venue',title:'장소 투표',options:[{id:'v1',label:'읽기 전용 카페',detail:'서울 마포구 모임로 10'},{id:'v2',label:'읽기 전용 공원',detail:'서울 성동구 모임길 20'}],optionIds:['v1','v2'],status:'open',creatorId:'demo-me',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    localStorage.setItem('moim-demo-v1',JSON.stringify(data));
  });
}
async function groupRecords(page:Page){return page.evaluate(()=>{
  const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);
  return {settings:data.settings,polls:data.polls,votes:data.votes,events:data.events,rsvps:data.rsvps,ballots:data.ballots,ballotResponses:data.ballotResponses,mvpVotes:data.mvpVotes,ledger:data.ledger,places:data.places};
});}

for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  test.describe(`승인 대기 일정·회계 둘러보기 ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height},timezoneId:'Asia/Seoul'});
    test.beforeEach(async({page})=>{await pendingDemo(page);});

    test('ongoing and past poll results remain readable while every vote and create control is unavailable',async({page})=>{
      const before=await groupRecords(page);
      await page.goto('/polls?poll=poll-weekend&create=1');
      await expect(page.locator('.pending-access')).toContainText('승인 대기');
      let dialog=page.getByRole('dialog');
      await expect(dialog).toHaveAccessibleName('다음 모임, 언제 만날까요?');
      const cells=dialog.locator('.poll-time-cell');
      await expect(cells).toHaveCount(6);
      for(const cell of await cells.all())await expect(cell).toBeDisabled();
      await expect(page.getByRole('button',{name:'투표 만들기',exact:true})).toHaveCount(0);
      for(const name of ['선택 저장하기','선택 수정하기','가능한 시간이 없어요','드래그 선택','투표 수정','투표 삭제','투표 마감','일정 확정'])await expect(dialog.getByRole('button',{name,exact:true})).toHaveCount(0);
      await dialog.getByRole('button',{name:'결과 보기',exact:true}).click();
      const results=dialog.getByRole('region',{name:'가능한 시간대',exact:true});
      await expect(results.locator('.poll-availability-row').first()).toBeVisible();
      await results.getByLabel('결과 정렬',{exact:true}).selectOption('participants');
      await expect(results.getByLabel('결과 정렬',{exact:true})).toHaveValue('participants');
      await results.getByLabel('최소 인원',{exact:true}).selectOption('1');
      await expect(results.locator('.poll-availability-row').first()).toContainText(/총 .*시간/);
      await results.locator('.poll-availability-row').first().locator('summary').click();
      await expect(results.locator('.poll-availability-members[open]').first().locator('.avatar').first()).toBeVisible();
      await dialog.getByRole('button',{name:'닫기',exact:true}).last().click();
      await page.getByRole('button',{name:/^지난 투표/}).click();
      await page.locator('.poll-card').filter({hasText:'가을 산책 날짜 정하기'}).click();
      dialog=page.getByRole('dialog');
      await expect(dialog).toHaveAccessibleName('가을 산책 날짜 정하기');
      await expect(dialog.getByRole('region',{name:'가능한 시간대',exact:true})).toBeVisible();
      for(const cell of await dialog.locator('.poll-time-cell').all())await expect(cell).toBeDisabled();
      expect(await groupRecords(page)).toEqual(before);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    });

    test('calendar participation, venue and currently open MVP voting stay disabled even with an existing RSVP',async({page})=>{
      const before=await groupRecords(page);const externalWrites:string[]=[];
      page.on('request',request=>{if(request.method()==='POST'&&/solapi|\/notifications\/sms\/|googleapis\.com\/calendar/.test(request.url()))externalWrites.push(request.url());});
      await page.goto('/calendar?event=event-coffee&create=1');
      const dialog=page.getByRole('dialog');
      await expect(dialog).toHaveAccessibleName('커피 한 잔, 함께해요');
      await expect(dialog.getByRole('button',{name:'참여해요',exact:true})).toBeDisabled();
      await expect(dialog.getByRole('button',{name:'어려워요',exact:true})).toBeDisabled();
      for(const name of ['일정 수정','일정 삭제','문자 알림','Google 캘린더'])await expect(dialog.getByRole('button',{name,exact:true})).toHaveCount(0);
      await expect(page.getByRole('button',{name:'일정 만들기',exact:true})).toHaveCount(0);
      const mvp=dialog.getByRole('region',{name:'MVP 투표',exact:true});
      await expect(mvp).toContainText('투표 중');
      expect(await mvp.locator('.mvp-candidate').count()).toBeGreaterThan(0);
      for(const candidate of await mvp.locator('.mvp-candidate').all())await expect(candidate).toBeDisabled();
      await expect(mvp.getByRole('button',{name:/^투표(하기| 변경)$/})).toHaveCount(0);
      await expect(page.locator('.mvp-alert')).toHaveCount(0);
      const venue=dialog.getByRole('region',{name:'장소 투표',exact:true});
      await expect(venue.getByRole('radio')).toHaveCount(2);
      for(const option of await venue.getByRole('radio').all())await expect(option).toBeDisabled();
      for(const name of ['투표하기','투표 변경','후보 수정','장소 확정','장소 투표 삭제'])await expect(venue.getByRole('button',{name,exact:true})).toHaveCount(0);
      await dialog.getByRole('button',{name:'지도 보기',exact:true}).click();
      let chooser=page.getByRole('dialog',{name:'지도 앱 선택',exact:true});
      await expect(chooser.getByRole('link',{name:'네이버지도',exact:true})).toHaveAttribute('href',/^https:\/\/map\.naver\.com\/p\/search\//);
      await chooser.getByRole('button',{name:'닫기',exact:true}).click();
      await dialog.getByRole('button',{name:'길찾기',exact:true}).click();
      chooser=page.getByRole('dialog',{name:'길찾기 앱 선택',exact:true});
      await expect(chooser.getByRole('link',{name:'네이버지도',exact:true})).toHaveAttribute('target','_blank');
      await chooser.getByRole('button',{name:'닫기',exact:true}).click();
      await dialog.getByRole('button',{name:'닫기',exact:true}).last().click();
      const month=page.locator('.calendar-main .schedule-month-nav>strong');const previous=await month.textContent();
      await page.getByRole('button',{name:'다음 달',exact:true}).click();
      await expect(month).not.toHaveText(previous!);
      expect(await groupRecords(page)).toEqual(before);expect(externalWrites).toEqual([]);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    });

    test('a pending treasurer can filter ledger and read saved maps, cannot reach admin settings, and edits only their profile',async({page})=>{
      await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);data.members.find((member:{id:string})=>member.id==='demo-me').role='treasurer';localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
      const before=await groupRecords(page);
      await page.goto('/ledger');
      await expect(page.getByRole('heading',{name:'회계 장부',exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'내역 추가',exact:true})).toHaveCount(0);
      await expect(page.locator('.ledger-edit')).toHaveCount(0);
      await page.locator('.ledger-toolbar').getByRole('button',{name:'전체 보기',exact:true}).click();
      expect(await page.locator('.ledger-row').count()).toBeGreaterThan(0);
      await page.locator('.ledger-toolbar .tabs').getByRole('button',{name:'지출',exact:true}).click();
      for(const row of await page.locator('.ledger-row').all())await expect(row.locator('.badge')).toHaveText('지출');
      await page.goto('/places');
      await expect(page.getByRole('button',{name:'장소 관리',exact:true})).toHaveCount(0);
      const place=page.locator('.place-directory-card').first();await expect(place.getByRole('heading')).toBeVisible();
      await place.getByRole('button',{name:'지도 보기',exact:true}).click();
      let chooser=page.getByRole('dialog',{name:'지도 앱 선택',exact:true});
      const map=chooser.getByRole('link',{name:'네이버지도',exact:true});
      await expect(map).toHaveAttribute('target','_blank');await expect(map).toHaveAttribute('rel',/noopener/);
      expect(new URL((await map.getAttribute('href'))!).pathname.slice('/p/search/'.length)).toBeTruthy();
      await chooser.getByRole('button',{name:'닫기',exact:true}).click();
      await place.getByRole('button',{name:'길찾기',exact:true}).click();
      chooser=page.getByRole('dialog',{name:'길찾기 앱 선택',exact:true});
      expect(new URL((await chooser.getByRole('link',{name:'Google 지도',exact:true}).getAttribute('href'))!).searchParams.get('destination')).toBeTruthy();
      await chooser.getByRole('button',{name:'닫기',exact:true}).click();
      await page.goto('/settings');await expect(page).not.toHaveURL(/\/settings$/);
      await expect(page.getByRole('region',{name:'문자 알림 설정',exact:true})).toHaveCount(0);
      await expect(page.getByRole('link',{name:'모임 설정',exact:true})).toHaveCount(0);
      await page.goto('/profile');await page.getByLabel('전화번호',{exact:true}).fill('010-0000-9907');
      await expect(page.getByLabel('직책',{exact:true})).toHaveAttribute('readonly','');
      await page.getByRole('button',{name:'저장하기',exact:true}).click();
      await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).profiles.find((profile:{id:string})=>profile.id==='demo-me').phone)).toBe('010-0000-9907');
      expect(await groupRecords(page)).toEqual(before);
      expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).members.find((member:{id:string})=>member.id==='demo-me').status)).toBe('pending');
    });
  });
}
