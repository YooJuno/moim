import { writeFile } from 'node:fs/promises';
const source='https://raw.githubusercontent.com/hyunbinseo/holidays-kr/main/public/basic.json';
const response=await fetch(source);if(!response.ok)throw new Error(`Holiday download failed: ${response.status}`);
const data=await response.json();
for(const [year,dates] of Object.entries(data)){if(!/^20\d{2}$/.test(year)||typeof dates!=='object')throw new Error('Unexpected holiday format');for(const [date,names] of Object.entries(dates)){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(names)||!names.every(n=>typeof n==='string'))throw new Error('Invalid holiday entry');}}
await writeFile(new URL('../src/data/holidays-kr.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(`공휴일 갱신 완료: ${Object.keys(data).join(', ')}`);
