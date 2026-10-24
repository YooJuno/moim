import { readFile,writeFile,readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname,join,resolve } from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);const seen=new Set();const notices=[];
async function visit(directory){const manifest=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));const key=`${manifest.name}@${manifest.version}`;if(seen.has(key))return;seen.add(key);const files=(await readdir(directory)).filter(name=>/^(licen[cs]e|notice|copying)(\.|$)/i.test(name));const texts=[];for(const name of files){try{texts.push(await readFile(join(directory,name),'utf8'));}catch{}}
notices.push(`${'='.repeat(72)}\n${key}\nLicense: ${manifest.license||'See package notice'}\n${manifest.homepage||''}\n\n${texts.join('\n\n')||'License text is available in the package source.'}`);
const requireFrom=createRequire(join(directory,'package.json'));
for(const name of Object.keys(manifest.dependencies||{})){try{let location;try{location=dirname(requireFrom.resolve(`${name}/package.json`));}catch{let cursor=dirname(requireFrom.resolve(name));while(cursor!==dirname(cursor)){try{const candidate=JSON.parse(await readFile(join(cursor,'package.json'),'utf8'));if(candidate.name===name){location=cursor;break;}}catch{}cursor=dirname(cursor);}}if(location)await visit(location);}catch{/* Optional or browser-excluded dependency not installed. */}}
}
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));const requireRoot=createRequire(join(root,'package.json'));for(const name of Object.keys(pkg.dependencies)){let location;try{location=dirname(requireRoot.resolve(`${name}/package.json`));}catch{location=join(root,'node_modules',name);}await visit(location);}
const holiday=await readFile(join(root,'src/data/holidays-LICENSE'),'utf8');let font='';try{font=await readFile(join(root,'public/noto-sans-kr-LICENSE.txt'),'utf8');}catch{}
await writeFile(join(root,'public/third-party-licenses.txt'),`Third-party licenses\nApplication copyright: © 2026 Yoo Junho. All rights reserved.\n\n${notices.sort().join('\n\n')}\n\nKorean holiday dataset\n${holiday}\n\nNoto Sans KR\n${font}\n\nDemo photos: Unsplash License https://unsplash.com/license\nImage source links are recorded in README.md.\n`);console.log(`Collected ${seen.size} runtime package notices.`);
