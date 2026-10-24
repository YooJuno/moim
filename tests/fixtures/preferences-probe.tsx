// Development-only integration harness, excluded from the production import graph.
import {useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {AppProvider,useApp} from '../../src/lib/store';
export function exercisePreferences(uid:string):Promise<void>{
 return new Promise((resolve,reject)=>{
  const host=document.createElement('div');host.hidden=true;document.body.append(host);const root=createRoot(host);const cleanup=()=>{setTimeout(()=>{root.unmount();host.remove();},0);};
  function Probe(){const app=useApp();const ran=useRef(false);const profile=app.profiles.find(value=>value.id===uid);
   useEffect(()=>{if(ran.current||app.user?.id!==uid||!profile)return;ran.current=true;void(async()=>{await app.savePreferences({language:'en',theme:'dark'});await app.saveProfile(uid,{name:app.user!.name,phone:profile.phone,area:profile.area,birthday:profile.birthday});cleanup();resolve();})().catch(error=>{cleanup();reject(error);});},[app.user?.id,profile]);return null;
  }
  root.render(<AppProvider><Probe/></AppProvider>);
 });
}
export function exercisePendingAccess(uid:string):Promise<{canParticipate:boolean;isAdmin:boolean;canCreatePoll:boolean;profiles:string[];memberStatuses:string[];blocked:string[];postCount:number}>{
 return new Promise((resolve,reject)=>{const host=document.createElement('div');host.hidden=true;document.body.append(host);const root=createRoot(host);const cleanup=()=>setTimeout(()=>{root.unmount();host.remove();},0);
  function Probe(){const app=useApp();const ran=useRef(false);const profile=app.profiles.find(value=>value.id===uid);useEffect(()=>{if(ran.current||app.user?.id!==uid||!profile||!app.posts.some(post=>post.id==='pending-readable-post'))return;ran.current=true;void(async()=>{const blocked:string[]=[];for(const [name,operation]of [['vote',()=>app.saveVote('unused-poll',[])],['like',()=>app.toggleLike('pending-readable-post')],['rsvp',()=>app.saveRsvp('unused-event','going')],['upload',()=>app.uploadImages([])]] as const){try{await operation();}catch{blocked.push(name);}}await app.saveProfile(uid,{name:app.user!.name,phone:'010-3333-3333',area:'서울 강서구'});const result={canParticipate:app.canParticipate,isAdmin:app.isAdmin,canCreatePoll:app.canCreatePoll,profiles:app.profiles.map(value=>value.id),memberStatuses:app.members.map(value=>value.status),blocked,postCount:app.posts.length};cleanup();resolve(result);})().catch(error=>{cleanup();reject(error);});},[app.user?.id,profile,app.posts]);return null;}root.render(<AppProvider><Probe/></AppProvider>);
 });
}
