import type { AppData } from '../lib/types';
import { localDate } from '../lib/utils';

const date = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return localDate(d); };
const time = (days: number, hours = 12) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hours, 0, 0, 0); return d.toISOString(); };
export const DEMO_USER_ID = 'demo-me';
export function createDemoData(): AppData {
  return {
    settings: { name: '오후의 모임', description: '좋은 사람들과 채우는 우리의 주말', smsEnabled:false, smsAutoOnConfirm:false },
    bylaws: { content: '제1조 · 모임의 이름\n우리 모임은 오후의 모임이라 부릅니다.\n\n제2조 · 함께하는 방식\n서로를 존중하고, 누구나 편안하게 의견을 나눕니다. 개인의 연락처와 사진을 동의 없이 외부에 공유하지 않습니다.\n\n제3조 · 정기 모임\n월 2회 모임을 기본으로 합니다. 일정 투표로 가능한 시간을 모으고, 관리자가 일정을 확정합니다. 참석이 어려워지면 미리 알려주세요.\n\n제4조 · 운영과 역할\n관리자는 가입 승인과 모임 운영을 맡습니다. 총무는 회비와 지출을 관리하고 정산 내역을 공유합니다. 투표 생성 권한은 관리자가 부여합니다.\n\n제5조 · 회비와 정산\n모임별 실제 발생한 비용을 참석 인원으로 나누어 정산합니다. 수입과 지출은 회계 내역에 기록하고 모든 멤버에게 공개합니다.\n\n제6조 · 회칙의 변경\n회칙은 멤버와 충분히 논의한 뒤 변경하며, 변경한 내용은 공지사항으로 안내합니다.', updatedAt: time(-20), editorId: DEMO_USER_ID },
    places: [{id:'place-demo-cafe',name:'오후 카페',address:'서울 마포구 연남동',createdAt:time(-20),updatedAt:time(-20)},{id:'place-demo-park',name:'주말 공원',address:'서울 성동구 성수동',createdAt:time(-20),updatedAt:time(-20)}],
    ballots: [],ballotResponses: [],mvpVotes: [],
    ledger: [
      { id: 'ledger-1', type: 'income', category: '회비', amount: 80000, date: date(-8), description: '지난 정기 모임 회비 · 8명', creatorId: 'm-jun', createdAt: time(-8), updatedAt: time(-8) },
      { id: 'ledger-2', type: 'expense', category: '공간', amount: 48000, date: date(-8), description: '모임 공간 대여', creatorId: 'm-jun', createdAt: time(-8), updatedAt: time(-8) },
      { id: 'ledger-3', type: 'expense', category: '식비', amount: 32000, date: date(-8), description: '간식과 음료', creatorId: 'm-jun', createdAt: time(-8), updatedAt: time(-8) },
      { id: 'ledger-4', type: 'income', category: '회비', amount: 160000, date: date(-3), description: '가을 산책 모임 회비 · 8명', creatorId: 'm-jun', createdAt: time(-3), updatedAt: time(-3) },
      { id: 'ledger-5', type: 'expense', category: '식비', amount: 128000, date: date(-3), description: '산책 후 함께한 저녁', creatorId: 'm-jun', createdAt: time(-3), updatedAt: time(-3) },
      { id: 'ledger-6', type: 'expense', category: '기타', amount: 18000, date: date(-3), description: '산책 모임 간식', creatorId: 'm-jun', createdAt: time(-3), updatedAt: time(-3) },
    ],
    members: [
      { id: DEMO_USER_ID, name: '김민서', birthday: date(0).slice(5), email: 'minseo@example.com', role: 'leader', status: 'active', canCreatePoll: true, joinedAt: time(-120) },
      { id: 'm-jun', name: '이준호', birthday: date(2).slice(5), email: 'junho@example.com', role: 'treasurer', status: 'active', canCreatePoll: true, joinedAt: time(-115) },
      { id: 'm-seo', name: '박서연', email: 'seoyeon@example.com', role: 'member', status: 'active', canCreatePoll: false, joinedAt: time(-110) },
      { id: 'm-do', name: '최도윤', email: 'doyun@example.com', role: 'member', status: 'active', canCreatePoll: false, joinedAt: time(-100) },
      { id: 'm-ha', name: '정하은', birthday: date(7).slice(5), email: 'haeun@example.com', role: 'member', status: 'active', canCreatePoll: true, joinedAt: time(-80) },
      { id: 'm-ji', name: '강지우', email: 'jiwoo@example.com', role: 'member', status: 'active', canCreatePoll: false, joinedAt: time(-75) },
      { id: 'm-su', name: '윤수빈', email: 'subin@example.com', role: 'member', status: 'active', canCreatePoll: false, joinedAt: time(-65) },
      { id: 'm-yu', name: '한유진', email: 'yujin@example.com', role: 'member', status: 'active', canCreatePoll: false, joinedAt: time(-40) },
      { id: 'm-new', name: '신예린', email: 'yerin@example.com', role: 'member', status: 'pending', canCreatePoll: false, joinedAt: time(-1) },
    ],
    profiles: [
      { id: DEMO_USER_ID, phone: '010-0000-1201', area: '서울 마포구', birthday: date(0).slice(5) },
      { id: 'm-jun', phone: '010-0000-1202', area: '서울 성동구', birthday: date(2).slice(5) },
      { id: 'm-seo', phone: '010-0000-1203', area: '서울 서대문구' },
      { id: 'm-do', phone: '010-0000-1204', area: '경기 고양시' },
      { id: 'm-ha', phone: '010-0000-1205', area: '서울 용산구', birthday: date(7).slice(5) },
      { id: 'm-ji', phone: '010-0000-1206', area: '서울 은평구' },
      { id: 'm-su', phone: '010-0000-1207', area: '서울 강서구' },
      { id: 'm-yu', phone: '010-0000-1208', area: '경기 부천시' },
      { id: 'm-new', phone: '010-0000-1209', area: '서울 마포구' },
    ],
    posts: [
      { id: 'post-notice', category: 'notice', title: '우리 모임, 이렇게 함께해요', body: '오후의 모임에 오신 걸 환영해요!\n\n한 달에 두 번, 주말 오후에 만나요. 산책도 하고 맛있는 것도 먹고, 때로는 전시도 함께 봐요.\n\n일정 투표에 가능한 시간을 모두 표시해 주세요. 가장 많이 겹치는 시간으로 약속을 정해요. 일정이 확정되면 캘린더에서 참석 여부를 알려주세요.\n\n서로의 시간을 존중하고, 편안하게 이야기 나눠요.', authorId: DEMO_USER_ID, createdAt: time(-4), updatedAt: time(-4), images: [], pinned: true, likedBy: ['m-jun','m-seo','m-ha','m-yu'] },
      { id: 'post-dues', category: 'notice', title: '이번 달 회비 정산 안내', body: '지난 모임 회비 정산을 마쳤어요.\n\n공간 대여 48,000원\n간식 및 음료 32,000원\n총 80,000원 / 8명 = 1인 10,000원\n\n궁금한 내용은 댓글로 남겨주세요. 다음 모임도 즐겁게 준비할게요!', authorId: 'm-jun', createdAt: time(-2,10), updatedAt: time(-2,10), images: [], pinned: false, likedBy: ['m-seo',DEMO_USER_ID] },
      { id: 'post-chat', category: 'chat', title: '이번 주말, 가볍게 산책 어때요?', body: '요즘 날씨가 산책하기 딱 좋더라고요.\n연남동에서 커피 한 잔 들고 경의선숲길 걸으면 좋겠어요. 관심 있는 분 있나요?', authorId: 'm-seo', createdAt: time(-1,17), updatedAt: time(-1,17), images: [], pinned: false, likedBy: ['m-do','m-ha',DEMO_USER_ID] },
      { id: 'post-info', category: 'info', title: '성수에서 발견한 조용한 카페', body: '지난 주말에 다녀온 카페가 좋아서 공유해요.\n\n테이블 간격도 넓고, 6명 정도 앉을 수 있는 자리도 있어요. 다음 모임 장소로 괜찮을 것 같아요. 서울숲역에서 걸어서 5분이에요.', authorId: 'm-ha', createdAt: time(-2,16), updatedAt: time(-2,16), images: [], pinned: false, likedBy: ['m-jun','m-su'] },
      { id: 'post-gallery-walk', category: 'gallery', title: '함께 걸었던 가을 오후', body: '말없이 걸어도 좋은 사람들. 다음 산책도 함께해요 🍂', authorId: 'm-yu', createdAt: time(-3,18), updatedAt: time(-3,18), images: ['/images/gallery-walk.jpg'], pinned: false, likedBy: [DEMO_USER_ID,'m-jun','m-seo','m-ha','m-ji'] },
      { id: 'post-gallery-table', category: 'gallery', title: '웃음이 끊이지 않았던 저녁', body: '사진 정리하다가 발견! 메뉴 선택부터 완벽했던 날.', authorId: 'm-do', createdAt: time(-8,20), updatedAt: time(-8,20), images: ['/images/gallery-table.jpg'], pinned: false, likedBy: ['m-jun','m-seo','m-yu'] },
      { id: 'post-gallery-cafe', category: 'gallery', title: '커피와 수다, 그리고 우리', body: '시간 가는 줄 몰랐던 토요일. 다음엔 더 오래 만나요.', authorId: 'm-ji', createdAt: time(-12,17), updatedAt: time(-12,17), images: ['/images/gallery-cafe.jpg'], pinned: false, likedBy: [DEMO_USER_ID,'m-ha','m-su'] },
    ],
    comments: [
      { id: 'c1', postId: 'post-chat', authorId: 'm-ha', body: '좋아요! 토요일 오후에 시간 돼요 🙌', createdAt: time(-1,18) },
      { id: 'c2', postId: 'post-chat', authorId: 'm-do', body: '저도 함께할게요. 가보고 싶었어요.', createdAt: time(-1,19) },
      { id: 'c3', postId: 'post-gallery-walk', authorId: 'm-seo', body: '이날 빛이 정말 예뻤죠!', createdAt: time(-2,15) },
      { id: 'c4', postId: 'post-notice', authorId: 'm-yu', body: '이번 달 모임도 기대돼요 :)', createdAt: time(-3,11) },
    ],
    polls: [
      { id: 'poll-weekend', title: '다음 모임, 언제 만날까요?', description: '가능한 시간을 모두 골라주세요. 가장 많이 겹치는 날에 만나요.', slots: [{id:'s1',date:date(7),start:'14:00',end:'16:00'},{id:'s2',date:date(7),start:'17:00',end:'19:00'},{id:'s3',date:date(8),start:'14:00',end:'16:00'},{id:'s4',date:date(8),start:'17:00',end:'19:00'},{id:'s5',date:date(14),start:'14:00',end:'16:00'},{id:'s6',date:date(14),start:'17:00',end:'19:00'}], slotIds:['s1','s2','s3','s4','s5','s6'], deadline:time(5,23),status:'open',creatorId:DEMO_USER_ID,createdAt:time(-2),updatedAt:time(-2) },
      { id: 'poll-exhibition', title: '전시 보러 갈 사람?', description: '보고 나서 근처에서 커피도 마셔요.', slots: [{id:'ex1',date:date(15),start:'13:00',end:'15:00'},{id:'ex2',date:date(16),start:'13:00',end:'15:00'},{id:'ex3',date:date(16),start:'16:00',end:'18:00'}],slotIds:['ex1','ex2','ex3'],deadline:time(10,23),status:'open',creatorId:'m-ha',createdAt:time(-1),updatedAt:time(-1) },
      { id: 'poll-last', title: '가을 산책 날짜 정하기', description: '가볍게 걷고 맛있는 저녁을 먹어요.', slots:[{id:'old1',date:date(-3),start:'14:00',end:'17:00'},{id:'old2',date:date(-2),start:'14:00',end:'17:00'}],slotIds:['old1','old2'],deadline:time(-5,23),status:'closed',creatorId:DEMO_USER_ID,createdAt:time(-12),updatedAt:time(-5) },
    ],
    votes: [
      {id:'poll-weekend_m-jun',pollId:'poll-weekend',memberId:'m-jun',slotIds:['s1','s2','s3'],updatedAt:time(-1)},
      {id:'poll-weekend_m-seo',pollId:'poll-weekend',memberId:'m-seo',slotIds:['s1','s3','s5'],updatedAt:time(-1)},
      {id:'poll-weekend_m-do',pollId:'poll-weekend',memberId:'m-do',slotIds:['s1','s4','s5'],updatedAt:time(-1)},
      {id:'poll-weekend_m-ha',pollId:'poll-weekend',memberId:'m-ha',slotIds:['s1','s2','s5','s6'],updatedAt:time(-1)},
      {id:'poll-weekend_m-ji',pollId:'poll-weekend',memberId:'m-ji',slotIds:['s1','s3','s6'],updatedAt:time(-1)},
      {id:'poll-exhibition_m-ha',pollId:'poll-exhibition',memberId:'m-ha',slotIds:['ex1','ex2'],updatedAt:time(-1)},
      {id:'poll-exhibition_m-yu',pollId:'poll-exhibition',memberId:'m-yu',slotIds:['ex2','ex3'],updatedAt:time(-1)},
      {id:'poll-last_m-jun',pollId:'poll-last',memberId:'m-jun',slotIds:['old1'],updatedAt:time(-6)},
      {id:'poll-last_m-seo',pollId:'poll-last',memberId:'m-seo',slotIds:['old1','old2'],updatedAt:time(-6)},
    ],
    events: [
      {id:'event-coffee',title:'커피 한 잔, 함께해요',description:'가볍게 커피 마시며 다음 달에 하고 싶은 것들을 이야기해요.',date:date(3),start:'14:00',end:'16:00',location:'연남동 · 카페 레이어드',creatorId:DEMO_USER_ID,createdAt:time(-4)},
      {id:'event-walk',title:'서울숲 가을 산책',description:'서울숲 입구에서 만나요. 편한 신발과 따뜻한 겉옷을 챙겨주세요.',date:date(10),start:'15:00',end:'18:00',location:'서울숲 · 방문자센터 앞',creatorId:DEMO_USER_ID,createdAt:time(-2)},
      {id:'event-dinner',title:'함께하는 저녁',description:'오랜만에 다 같이 저녁 먹어요. 메뉴 추천도 환영해요!',date:date(19),start:'18:30',end:'20:30',location:'합정 · 장소 추후 안내',creatorId:DEMO_USER_ID,createdAt:time(-1)},
      {id:'event-past',title:'가을 산책과 저녁',description:'함께 걸었던 기분 좋은 가을날.',date:date(-3),start:'14:00',end:'18:00',location:'경의선숲길',creatorId:DEMO_USER_ID,createdAt:time(-12)},
    ],
    rsvps:[
      {id:'event-coffee_demo-me',eventId:'event-coffee',memberId:DEMO_USER_ID,status:'going',updatedAt:time(-2)},
      {id:'event-coffee_m-jun',eventId:'event-coffee',memberId:'m-jun',status:'going',updatedAt:time(-2)},
      {id:'event-coffee_m-seo',eventId:'event-coffee',memberId:'m-seo',status:'going',updatedAt:time(-2)},
      {id:'event-coffee_m-ha',eventId:'event-coffee',memberId:'m-ha',status:'going',updatedAt:time(-1)},
      {id:'event-coffee_m-yu',eventId:'event-coffee',memberId:'m-yu',status:'going',updatedAt:time(-1)},
      {id:'event-walk_m-do',eventId:'event-walk',memberId:'m-do',status:'going',updatedAt:time(-1)},
      {id:'event-walk_m-su',eventId:'event-walk',memberId:'m-su',status:'going',updatedAt:time(-1)},
    ],
  };
}
