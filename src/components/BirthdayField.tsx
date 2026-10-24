import { Field } from './ui';

export function isValidBirthday(value:string) {
  if(!value)return true;
  if(!/^\d{2}-\d{2}$/.test(value))return false;
  const [month,day]=value.split('-').map(Number);
  const date=new Date(Date.UTC(2000,month-1,day));
  return date.getUTCMonth()===month-1&&date.getUTCDate()===day;
}
export function BirthdayField({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  return <Field label="생일" hint="월-일 · 생일은 모임 캘린더에 표시돼요."><input value={value} onChange={event=>{const digits=event.target.value.replace(/\D/g,'').slice(0,4);onChange(digits.length>2?`${digits.slice(0,2)}-${digits.slice(2)}`:digits);}} placeholder="02-29" inputMode="numeric" maxLength={5}/></Field>;
}
export function birthdayLabel(value:string){const [month,day]=value.split('-').map(Number);return `${month}월 ${day}일`;}
