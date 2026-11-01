import {CalendarDays,Check,Clock3,FileText,MapPin,MessageSquare,Receipt,Wallet} from 'lucide-react';
import {useI18n} from '../lib/preferences';
import './login-preview.css';
export function LoginPreview({feature,label}:{feature:string;label:string}){
 const {t,language}=useI18n();
 const header=(title:string,icon:React.ReactNode)=><div className="login-demo-heading"><span>{icon}<strong>{t(title)}</strong></span><small>{t('미리보기')}</small></div>;
 return <div className={`login-demo-app login-demo-${feature}`} role="img" aria-label={label}>
  {feature==='poll'?<>
   {header('11월 일정 투표',<CalendarDays size={17}/>)}
   <div className="login-demo-subtitle"><span>{t('가능 인원')}</span><span>{t('8명 응답 · 1시간 단위')}</span></div>
   <div className="login-demo-time-grid"><span>{t('시간')}</span>{['11/7 (토)','11/8 (일)','11/14 (토)'].map(date=><strong key={date}>{t(date)}</strong>)}
    {['08:00','09:00','10:00','11:00'].map((time,row)=><div className="login-demo-grid-row" key={time}><span>{time}</span>{[0,1,2].map(col=>{const selected=col===1&&row>0||col===0&&row===2;return <span key={col} className={selected?'is-selected':''}>{selected&&<Check size={11}/>}<strong>{[3,5,4,6,8,5,7,8,6,4,7,3][row*3+col]}</strong></span>;})}</div>)}
   </div><div className="login-demo-bottom"><span><Check size={14}/>{t('4개 시간 선택')}</span><strong>{t('선택 저장하기')}</strong></div>
  </>:feature==='calendar'?<>
   {header('11월',<CalendarDays size={17}/>)}
   <div className="login-demo-calendar">{(language==='en'?['Sun','Mon','Tue','Wed','Thu','Fri','Sat']:['일','월','화','수','목','금','토']).map((day,index)=><strong className={index===0?'is-holiday':''} key={day}>{t(day)}</strong>)}{Array.from({length:14},(_,i)=><span key={i} className={`${i%7===0?'is-holiday':''} ${i===6?'is-event':''}`}><b>{i+1}</b>{i===6&&<small>{t('정모')}</small>}</span>)}</div>
   <div className="login-demo-event"><span className="login-demo-date"><strong>7</strong><small>{t('토요일')}</small></span><div><strong>{t('11월 정모')}</strong><span><Clock3 size={12}/>10:00–12:00</span><span><MapPin size={12}/>{t('시립체육관')}</span></div></div>
  </>:feature==='board'?<>
   {header('게시판',<MessageSquare size={17}/>)}
   <div className="login-demo-tabs"><strong>{t('전체')}</strong><span>{t('공지사항')}</span><span>{t('수다')}</span><span>{t('정보')}</span></div>
   {[['공지','11월 모임 일정 확정','오늘 · 댓글 3'],['수다','토요일 경기 사진','어제 · 댓글 8'],['정보','체육관 예약 안내','11/1 · 댓글 2']].map(([category,title,meta])=><div className="login-demo-post" key={title}><span className={`login-demo-post-icon ${category==='공지'?'notice':''}`}><FileText size={17}/></span><div><small>{t(category)}</small><strong>{t(title)}</strong><span>{t(meta)}</span></div></div>)}
  </>:<>
   {header('회계 장부',<Wallet size={17}/>)}
   <div className="login-demo-balance"><span>{t('이번 달 잔액')}</span><strong>308,000<small>{t('원')}</small></strong><div><span>{t('수입')} <b>400,000</b></span><span>{t('지출')} <b>92,000</b></span></div></div>
   {[['11월 회비','+400,000'],['체육관 대관','−80,000'],['음료','−12,000']].map(([title,amount],index)=><div className="login-demo-ledger-row" key={title}><span>{t(title)}</span>{index>0&&<Receipt size={13}/>}<strong className={index===0?'is-income':''}>{amount}</strong></div>)}
  </>}
 </div>;
}
