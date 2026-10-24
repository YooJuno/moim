import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, query, runTransaction, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { getBlob, ref } from 'firebase/storage';
import { auth, configurationError, db, isDemo, storage } from './firebase';
import { createDemoData, DEMO_USER_ID } from '../data/demo';
import { deleteDemoImage, readDemoImage, saveDemoImage } from '../data/images';
import type { AppContextValue, AppData, CalendarLink, EventBallot, Member, MoimEvent, Poll, Post, Receipt, Rsvp, SavedPlace } from './types';
import { preparePostPhoto, prepareReceipt } from './receipt';
import { errorMessage, uid } from './utils';

const DEMO_KEY = 'moim-demo-v1';
const emptyData = (): AppData => ({settings:{name:'우리 모임',description:'',smsEnabled:false,smsAutoOnConfirm:false},bylaws:{content:'',updatedAt:'',editorId:''},places:[],ledger:[],ballots:[],ballotResponses:[],mvpVotes:[],members:[],profiles:[],posts:[],comments:[],polls:[],votes:[],events:[],rsvps:[]});
function initialData(): AppData {
  if (!isDemo) return emptyData();
  try { const raw = localStorage.getItem(DEMO_KEY); if(raw) { const data = JSON.parse(raw) as AppData; if(data.settings && data.bylaws && Array.isArray(data.ledger) && Array.isArray(data.members) && Array.isArray(data.polls)) return {...data,places:data.places ?? [],ballots:data.ballots ?? [],ballotResponses:data.ballotResponses ?? [],mvpVotes:data.mvpVotes ?? []}; } } catch { /* An invalid saved demo is replaced with the sample. */ }
  return createDemoData();
}
function replace<T extends {id: string}>(items: T[], item: T): T[] { return items.some(i=>i.id===item.id) ? items.map(i=>i.id===item.id ? item : i) : [...items,item]; }
const canonicalPositions=['','회장','부회장','총무'];
function validBirthday(value: string) {if(!value)return true;if(!/^\d{2}-\d{2}$/.test(value))return false;const date=new Date(`2000-${value}T12:00:00Z`);return Number.isFinite(date.getTime()) && date.toISOString().slice(5,10)===value;}
function eventEnd(event: MoimEvent): Date {return new Date(`${event.date}T${event.end}:00+09:00`);}
function clean<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({children}: {children: ReactNode}) {
  const [data,setData] = useState<AppData>(initialData);
  const dataRef = useRef(data); dataRef.current = data;
  const [loading,setLoading] = useState(!isDemo && !configurationError);
  const [error,setError] = useState<string | null>(configurationError);
  const [authUid,setAuthUid] = useState<string | null>(null);
  const [self,setSelf] = useState<Member | null>(null);
  const [demoSignedIn,setDemoSignedIn] = useState(true);
  const [imageUrls,setImageUrls] = useState<Record<string,string>>({});
  const imageCache = useRef(new Map<string,string>());
  const reverseImages = useRef(new Map<string,string>());
  const pendingImages = useRef(new Set<string>());
  const imageGeneration = useRef(0);
  const user = isDemo ? (demoSignedIn ? data.members.find(m=>m.id===DEMO_USER_ID) ?? null : null) : self;
  const canParticipate=user?.status==='active';
  const isAdmin = user?.status === 'active' && user.role === 'leader';
  const canCreatePoll = user?.status === 'active' && (isAdmin || user.canCreatePoll);

  const applyDemo = (next: AppData) => {
    try { localStorage.setItem(DEMO_KEY,JSON.stringify(next)); }
    catch { throw new Error('저장 공간이 부족해요. 브라우저의 사이트 저장 공간을 확인해 주세요.'); }
    dataRef.current = next; setData(next);
  };
  const active = () => { if(!user || user.status!=='active') throw new Error('승인된 멤버만 사용할 수 있어요.'); return user; };
  const readable=()=>{if(!user || !['active','pending'].includes(user.status))throw new Error('로그인 후 모임 내용을 볼 수 있어요.');return user;};
  const admin = () => { const actor=active(); if(actor.role!=='leader') throw new Error('관리자만 변경할 수 있어요.'); return actor; };
  const managePoll = (poll: Poll) => { const actor=active(); if(!isAdmin && !(actor.canCreatePoll && poll.creatorId===actor.id)) throw new Error('투표를 관리할 권한이 없어요.'); if(poll.status==='confirmed') throw new Error('확정한 투표는 변경할 수 없어요. 캘린더에서 일정을 수정해 주세요.'); return actor; };
  const database = () => { if(!db) throw new Error(configurationError ?? 'Firebase에 연결할 수 없어요.'); return db; };
  const normalizeImages = (images: string[]) => images.map(image=>reverseImages.current.get(image) ?? image);
  const displayImage = (path: string) => {
    if(imageUrls[path]) return imageUrls[path];
    if(!path.startsWith('storage:') && !path.startsWith('demo-image:') && !path.startsWith('photo:')) return path;
    const placeholder=`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='800' height='600' fill='%23edf0f5'/%3E%3Ctext x='400' y='300' text-anchor='middle' fill='%23929baa' font-size='20' font-family='sans-serif'%3E사진 불러오는 중%3C/text%3E%3C/svg%3E#${encodeURIComponent(path)}`;
    reverseImages.current.set(placeholder,path);
    return placeholder;
  };
  const displayError = (problem: unknown) => { setError(errorMessage(problem)); setLoading(false); };

  useEffect(()=>{
    if(isDemo || !auth || !db) return;
    return onAuthStateChanged(auth,(firebaseUser)=>{
      setError(null); setSelf(null); setData(emptyData()); setAuthUid(firebaseUser?.uid ?? null); setLoading(Boolean(firebaseUser));
    },displayError);
  },[]);

  useEffect(()=>{
    if(isDemo || !db || !authUid) return;
    return onSnapshot(doc(db,'members',authUid),(snapshot)=>{
      const member=snapshot.exists() ? { ...snapshot.data(), id:snapshot.id } as Member : null;
      setSelf(member); setLoading(false);
    },displayError);
  },[authUid]);

  useEffect(()=>{
    if(isDemo || !db || !self || ['active','pending'].includes(self.status)) return;
    return onSnapshot(doc(db,'profiles',self.id),snapshot=>{
      setData(previous=>({...previous,profiles:snapshot.exists() ? [{...snapshot.data(),id:snapshot.id} as AppData['profiles'][number]] : []}));
    },displayError);
  },[self?.id,self?.status]);

  useEffect(()=>{
    if(isDemo || !db || !self || !['active','pending'].includes(self.status)) return;
    const database=db;
    const unsubscribers: (()=>void)[]=[];
    const listen = (key: keyof Omit<AppData,'settings' | 'bylaws'>, target: ReturnType<typeof collection> | ReturnType<typeof query>) => {
      unsubscribers.push(onSnapshot(target,snapshot=>{
        const values=snapshot.docs.map(item=>({...(item.data() as DocumentData),id:item.id}));
        setData(previous=>({...previous,[key]:values}));
      },displayError));
    };
    const leader=self.status==='active' && self.role==='leader';
    listen('members',leader ? collection(database,'members') : query(collection(database,'members'),where('status','==','active')));
    if(leader) listen('profiles',collection(database,'profiles'));
    else unsubscribers.push(onSnapshot(doc(database,'profiles',self.id),snapshot=>setData(previous=>({...previous,profiles:snapshot.exists() ? [{...snapshot.data(),id:snapshot.id} as AppData['profiles'][number]] : []})),displayError));
    for(const key of ['posts','comments','polls','votes','events','rsvps','ledger','ballots','ballotResponses','mvpVotes','places'] as const) listen(key,collection(database,key));
    unsubscribers.push(onSnapshot(doc(database,'settings','club'),snapshot=>{
      if(snapshot.exists()) setData(previous=>({...previous,settings:{...snapshot.data(),smsEnabled:snapshot.data().smsEnabled===true,smsAutoOnConfirm:snapshot.data().smsAutoOnConfirm===true} as AppData['settings']}));
    },displayError));
    unsubscribers.push(onSnapshot(doc(database,'settings','bylaws'),snapshot=>{ if(snapshot.exists()) setData(previous=>({...previous,bylaws:snapshot.data() as AppData['bylaws']})); },displayError));
    return ()=>unsubscribers.forEach(unsubscribe=>unsubscribe());
  },[self?.id,self?.status,self?.role]);

  useEffect(()=>{
    if(!isDemo && (!self || !['active','pending'].includes(self.status))) setData(emptyData());
  },[self?.id,self?.status]);

  useEffect(()=>{
    if(isDemo || (self && ['active','pending'].includes(self.status))) return;
    imageGeneration.current+=1;
    for(const url of imageCache.current.values()) URL.revokeObjectURL(url);
    imageCache.current.clear(); reverseImages.current.clear(); pendingImages.current.clear(); setImageUrls({});
  },[authUid,self?.status]);

  useEffect(()=>{
    for(const path of data.posts.flatMap(post=>post.images)) {
      if(!(path.startsWith('storage:') || path.startsWith('demo-image:')) || imageCache.current.has(path) || pendingImages.current.has(path)) continue;
      pendingImages.current.add(path);
      const generation=imageGeneration.current;
      const load = async () => {
        try {
          const blob=path.startsWith('demo-image:') ? await readDemoImage(path.slice(11)) : storage ? await getBlob(ref(storage,path.slice(8)),5*1024*1024) : undefined;
          if(!blob || generation!==imageGeneration.current) return;
          const url=URL.createObjectURL(blob); imageCache.current.set(path,url); reverseImages.current.set(url,path); setImageUrls(previous=>({...previous,[path]:url}));
        } catch { if(generation===imageGeneration.current) setError('사진을 불러오지 못했어요. 연결 상태와 Storage CORS 설정을 확인해 주세요.'); }
        finally { pendingImages.current.delete(path); }
      };
      void load();
    }
  },[data.posts]);
  useEffect(()=>{
    if(isDemo || !db || !self || !['active','pending'].includes(self.status))return;
    const loadPhoto=async(path:string)=>{
      if(imageCache.current.has(path) || pendingImages.current.has(path))return;
      const generation=imageGeneration.current;pendingImages.current.add(path);
      try{
        const snapshot=await getDoc(doc(db!,'photos',path.slice(6)));if(!snapshot.exists())throw new Error('사진을 찾을 수 없어요.');
        const imageURL=snapshot.data().imageURL as string;if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(imageURL) || imageURL.length>700000)throw new Error('사진 형식을 확인해 주세요.');
        const blob=await (await fetch(imageURL)).blob();if(generation!==imageGeneration.current)return;
        const url=URL.createObjectURL(blob);imageCache.current.set(path,url);reverseImages.current.set(url,path);setImageUrls(previous=>({...previous,[path]:url}));
      }catch(problem){if(generation===imageGeneration.current)setError(errorMessage(problem));}
      finally{pendingImages.current.delete(path);}
    };
    const pathFor=(element:Element)=>{const source=element.getAttribute('src') ?? '';const marker=source.lastIndexOf('#');if(marker<0)return null;try{const path=decodeURIComponent(source.slice(marker+1));return path.startsWith('photo:') ? path:null;}catch{return null;}};
    const observed=new WeakMap<Element,string>();
    const observer:IntersectionObserver|null=typeof IntersectionObserver!=='undefined' ? new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const path=pathFor(entry.target);observer?.unobserve(entry.target);if(path)void loadPhoto(path);}},{rootMargin:'300px'}):null;
    const scan=()=>{for(const image of document.querySelectorAll('img')){const path=pathFor(image);if(!path || observed.get(image)===path)continue;observed.set(image,path);if(observer)observer.observe(image);else void loadPhoto(path);}};
    const mutations=new MutationObserver(scan);mutations.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});scan();
    return()=>{observer?.disconnect();mutations.disconnect();};
  },[self?.id,self?.status]);

  useEffect(()=>()=>{ for(const url of imageCache.current.values()) URL.revokeObjectURL(url); },[]);

  const value: AppContextValue = useMemo(()=>({
    ...data,
    posts:data.posts.map(post=>({...post,images:post.images.map(displayImage)})),
    members:isAdmin ? data.members:data.members.filter(member=>member.status==='active'),
    profiles:isAdmin ? data.profiles : data.profiles.filter(profile=>profile.id===user?.id),
    user,loading,isDemo,isAdmin,canParticipate,canCreatePoll,error,
    async login() {
      if(isDemo) { setDemoSignedIn(true); return; }
      if(!auth) throw new Error(configurationError ?? 'Firebase 설정을 확인해 주세요.');
      const provider=new GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'});
      const credential=await signInWithPopup(auth,provider);
      const actor=credential.user;
      const memberRef=doc(database(),'members',actor.uid);
      await runTransaction(database(),async transaction=>{
        const current=await transaction.get(memberRef); if(current.exists()) return;
        const member: Member={id:actor.uid,name:actor.displayName?.slice(0,30) || '새 멤버',email:actor.email || '',...(actor.photoURL ? {photoURL:actor.photoURL}:{}),role:'member',status:'pending',canCreatePoll:false,joinedAt:new Date().toISOString()};
        transaction.set(memberRef,member);
        transaction.set(doc(database(),'profiles',actor.uid),{id:actor.uid,phone:'',area:''});
      });
    },
    async logout() { if(isDemo) { setDemoSignedIn(false); return; } if(auth) await signOut(auth); },
    async saveSettings(settings) {
      admin();const base={name:settings.name.trim(),description:settings.description.trim(),...(settings.photoURL ? {photoURL:settings.photoURL}:{})};
      if(!base.name || base.name.length>40 || base.description.length>140)throw new Error('모임 이름은 1–40자, 소개는 140자 이내로 입력해 주세요.');
      if(base.photoURL && (base.photoURL.length>180000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(base.photoURL)))throw new Error('모임 사진은 JPG, PNG, WebP 형식의 작은 이미지로 올려주세요.');
      if((settings.smsEnabled!==undefined && typeof settings.smsEnabled!=='boolean') || (settings.smsAutoOnConfirm!==undefined && typeof settings.smsAutoOnConfirm!=='boolean'))throw new Error('문자 알림 설정을 확인해 주세요.');
      const build=(current?:AppData['settings'])=>({...base,smsEnabled:settings.smsEnabled ?? current?.smsEnabled ?? false,smsAutoOnConfirm:settings.smsAutoOnConfirm ?? current?.smsAutoOnConfirm ?? false});
      if(isDemo)applyDemo({...dataRef.current,settings:build(dataRef.current.settings)});
      else await runTransaction(database(),async transaction=>{const settingsRef=doc(database(),'settings','club');const snapshot=await transaction.get(settingsRef);transaction.set(settingsRef,build(snapshot.exists() ? snapshot.data() as AppData['settings']:undefined));});
    },
    async savePlace(place) {
      admin();const name=place.name.trim(),address=place.address.trim();if(!name || name.length>80 || !address || address.length>300)throw new Error('장소 이름은 80자, 주소는 300자 이내로 입력해 주세요.');
      const now=new Date().toISOString();const build=(current?:SavedPlace)=>({id:place.id,name,address,createdAt:current?.createdAt ?? now,updatedAt:now});
      if(isDemo)applyDemo({...dataRef.current,places:replace(dataRef.current.places,build(dataRef.current.places.find(item=>item.id===place.id)))});
      else await runTransaction(database(),async transaction=>{const placeRef=doc(database(),'places',place.id);const snapshot=await transaction.get(placeRef);transaction.set(placeRef,build(snapshot.exists() ? snapshot.data() as SavedPlace:undefined));});
    },
    async deletePlace(id) {
      admin();if(isDemo)applyDemo({...dataRef.current,places:dataRef.current.places.filter(place=>place.id!==id)});else await deleteDoc(doc(database(),'places',id));
    },
    async saveBylaws(content) {
      const actor=admin(); if(content.length>50000) throw new Error('회칙은 50,000자 이내로 작성해 주세요.');
      const bylaws={content:content.trim(),updatedAt:new Date().toISOString(),editorId:actor.id};
      if(isDemo) applyDemo({...dataRef.current,bylaws}); else await setDoc(doc(database(),'settings','bylaws'),bylaws);
    },
    async saveLedgerEntry(entry) {
      const actor=active(); if(!['leader','treasurer'].includes(actor.role)) throw new Error('관리자와 회계 담당만 회계를 관리할 수 있어요.');
      const old=dataRef.current.ledger.find(item=>item.id===entry.id);
      if(!['income','expense'].includes(entry.type) || !Number.isSafeInteger(entry.amount) || entry.amount<=0 || entry.amount>1e10 || !entry.category.trim() || entry.category.length>40 || !entry.description.trim() || entry.description.length>1000 || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) throw new Error('거래 날짜, 금액과 내용을 확인해 주세요.');
      const now=new Date().toISOString();
      const build=(current?: typeof entry)=>{const {hasReceipt:_incomingReceipt,...fields}=entry;return clean({...fields,category:entry.category.trim(),description:entry.description.trim(),creatorId:current?.creatorId ?? actor.id,createdAt:current?.createdAt ?? now,updatedAt:now,...(current?.hasReceipt ? {hasReceipt:true}:{})});};
      if(isDemo) applyDemo({...dataRef.current,ledger:replace(dataRef.current.ledger,build(old))});
      else await runTransaction(database(),async transaction=>{const entryRef=doc(database(),'ledger',entry.id);const snapshot=await transaction.get(entryRef);transaction.set(entryRef,build(snapshot.exists() ? snapshot.data() as typeof entry:undefined));});
    },
    async deleteLedgerEntry(id) {
      const actor=active(); if(!['leader','treasurer'].includes(actor.role)) throw new Error('관리자와 회계 담당만 회계를 관리할 수 있어요.');
      if(isDemo){applyDemo({...dataRef.current,ledger:dataRef.current.ledger.filter(item=>item.id!==id)});await deleteDemoImage(`receipt-${id}`);}
      else {const batch=writeBatch(database());batch.delete(doc(database(),'receipts',id));batch.delete(doc(database(),'ledger',id));await batch.commit();}
    },
    async getReceipt(entryId) {
      readable();if(isDemo && !dataRef.current.ledger.some(entry=>entry.id===entryId && entry.hasReceipt))return null;
      if(isDemo){const blob=await readDemoImage(`receipt-${entryId}`);return blob ? JSON.parse(await blob.text()) as Receipt:null;}
      const snapshot=await getDoc(doc(database(),'receipts',entryId));return snapshot.exists() ? snapshot.data() as Receipt:null;
    },
    async saveReceipt(entryId,file) {
      const actor=active();if(!['leader','treasurer'].includes(actor.role))throw new Error('관리자와 회계 담당만 영수증을 관리할 수 있어요.');
      if(isDemo && !dataRef.current.ledger.some(entry=>entry.id===entryId))throw new Error('회계 내역을 찾을 수 없어요.');
      if(file && (file.size>5*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)))throw new Error('JPG, PNG, WebP 영수증 사진을 5MB 이하로 올려주세요.');
      const prepared=file ? await prepareReceipt(file):null;
      if(prepared && (!prepared.fileName || prepared.fileName.length>200 || prepared.imageURL.length>700000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(prepared.imageURL)))throw new Error('영수증 이미지 크기와 형식을 확인해 주세요.');
      const receipt:Receipt|null=prepared ? {entryId,...prepared,uploadedBy:actor.id,updatedAt:new Date().toISOString()}:null;
      if(isDemo){if(receipt)await saveDemoImage(`receipt-${entryId}`,new Blob([JSON.stringify(receipt)],{type:'application/json'}));applyDemo({...dataRef.current,ledger:dataRef.current.ledger.map(entry=>entry.id===entryId ? {...entry,hasReceipt:!!receipt}:entry)});if(!receipt)await deleteDemoImage(`receipt-${entryId}`);}
      else {const batch=writeBatch(database());const receiptRef=doc(database(),'receipts',entryId);if(receipt)batch.set(receiptRef,receipt);else batch.delete(receiptRef);batch.update(doc(database(),'ledger',entryId),{hasReceipt:!!receipt});await batch.commit();}
    },
    async savePreferences(preferences) {
      if(!user)throw new Error('로그인 후 개인 설정을 저장할 수 있어요.');
      if(!['ko','en'].includes(preferences.language) || !['system','light','dark'].includes(preferences.theme))throw new Error('언어와 화면 설정을 확인해 주세요.');
      const id=user.id;const build=(current?:AppData['profiles'][number])=>({...current,id,phone:current?.phone ?? '',area:current?.area ?? '',language:preferences.language,theme:preferences.theme});
      if(isDemo)applyDemo({...dataRef.current,profiles:replace(dataRef.current.profiles,build(dataRef.current.profiles.find(profile=>profile.id===id)))});
      else await runTransaction(database(),async transaction=>{const profileRef=doc(database(),'profiles',id);const snapshot=await transaction.get(profileRef);transaction.set(profileRef,build(snapshot.exists() ? snapshot.data() as AppData['profiles'][number]:undefined));});
    },
    async saveProfile(id,profile) {
      if(!user || (id!==user.id && !isAdmin))throw new Error('프로필을 변경할 권한이 없어요.');
      const name=profile.name.trim(),phone=profile.phone.trim(),area=profile.area.trim(),birthday=profile.birthday?.trim();
      if(!name || name.length>30 || phone.length>30 || area.length>100 || (birthday!==undefined && !validBirthday(birthday)))throw new Error('프로필 입력 내용을 확인해 주세요.');
      const build=(current?:AppData['profiles'][number],member?:Member)=>{const value=birthday===undefined ? member?.birthday ?? current?.birthday:birthday;return {id,phone,area,...(value ? {birthday:value}:{}),...(current?.language ? {language:current.language}:{}),...(current?.theme ? {theme:current.theme}:{})};};
      if(isDemo){const current=dataRef.current;const next=build(current.profiles.find(item=>item.id===id),current.members.find(member=>member.id===id));applyDemo({...current,members:current.members.map(member=>{if(member.id!==id)return member;const {birthday:_oldBirthday,...fields}=member;return {...fields,name,...(next.birthday ? {birthday:next.birthday}:{})};}),profiles:replace(current.profiles,next)});}
      else await runTransaction(database(),async transaction=>{const profileRef=doc(database(),'profiles',id),memberRef=doc(database(),'members',id);const [snapshot,member]=await Promise.all([transaction.get(profileRef),transaction.get(memberRef)]);const next=build(snapshot.exists() ? snapshot.data() as AppData['profiles'][number]:undefined,member.exists() ? member.data() as Member:undefined);transaction.update(memberRef,{name,birthday:next.birthday ?? deleteField()});transaction.set(profileRef,next);});
    },
    async addRosterMember(input) {
      admin();const name=input.name.trim(),phone=input.phone.trim(),area=input.area.trim(),birthday=input.birthday?.trim(),position=input.position?.trim();
      if(!name || name.length>30 || phone.length>30 || area.length>100 || (birthday!==undefined && !validBirthday(birthday)) || !canonicalPositions.includes(position ?? ''))throw new Error('이름, 연락처, 생일과 직책을 확인해 주세요.');
      const id=`roster-${uid()}`;const member:Member={id,name,email:'',role:'member',status:'active',canCreatePoll:false,joinedAt:new Date().toISOString(),isRoster:true,...(position ? {position}:{}),...(birthday ? {birthday}:{})};const profile={id,phone,area,...(birthday ? {birthday}:{})};
      if(isDemo)applyDemo({...dataRef.current,members:[...dataRef.current.members,member],profiles:[...dataRef.current.profiles,profile]});
      else {const batch=writeBatch(database());batch.set(doc(database(),'members',id),member);batch.set(doc(database(),'profiles',id),profile);await batch.commit();}
    },
    async linkRosterMember(rosterId,userId) {
      admin();if(rosterId===userId)throw new Error('연결할 가입 계정을 선택해 주세요.');
      const merge=(source:Member|undefined,target:Member|undefined,sourceProfile?:AppData['profiles'][number],targetProfile?:AppData['profiles'][number])=>{
        if(!source?.isRoster || !target || target.isRoster || !target.email)throw new Error('명부와 가입 계정을 다시 확인해 주세요.');
        const birthday=source.birthday ?? sourceProfile?.birthday ?? target.birthday ?? targetProfile?.birthday;
        const member:Member={...target,name:source.name,status:'active',isRoster:false,...(source.position && canonicalPositions.includes(source.position) ? {position:source.position}:{}),...(birthday ? {birthday}:{})};
        const profile={id:userId,phone:sourceProfile?.phone || targetProfile?.phone || '',area:sourceProfile?.area || targetProfile?.area || '',...(birthday ? {birthday}:{}),...(targetProfile?.language ? {language:targetProfile.language}:{}),...(targetProfile?.theme ? {theme:targetProfile.theme}:{})};
        return {member,profile};
      };
      if(isDemo){const current=dataRef.current;const merged=merge(current.members.find(item=>item.id===rosterId),current.members.find(item=>item.id===userId),current.profiles.find(item=>item.id===rosterId),current.profiles.find(item=>item.id===userId));applyDemo({...current,members:replace(current.members.filter(item=>item.id!==rosterId),merged.member),profiles:replace(current.profiles.filter(item=>item.id!==rosterId),merged.profile)});}
      else await runTransaction(database(),async transaction=>{const sourceRef=doc(database(),'members',rosterId),targetRef=doc(database(),'members',userId),sourceProfileRef=doc(database(),'profiles',rosterId),targetProfileRef=doc(database(),'profiles',userId);const [source,target,sourceProfile,targetProfile]=await Promise.all([transaction.get(sourceRef),transaction.get(targetRef),transaction.get(sourceProfileRef),transaction.get(targetProfileRef)]);const merged=merge(source.exists() ? source.data() as Member:undefined,target.exists() ? target.data() as Member:undefined,sourceProfile.exists() ? sourceProfile.data() as AppData['profiles'][number]:undefined,targetProfile.exists() ? targetProfile.data() as AppData['profiles'][number]:undefined);transaction.set(targetRef,merged.member);transaction.set(targetProfileRef,merged.profile);transaction.delete(sourceRef);if(sourceProfile.exists())transaction.delete(sourceProfileRef);});
    },
    async updateMember(id,patch) {
      const actor=admin(); const current=dataRef.current.members.find(member=>member.id===id); if(!current) throw new Error('멤버를 찾을 수 없어요.');
      if(id===actor.id && ((patch.role && patch.role!=='leader') || (patch.status && patch.status!=='active'))) throw new Error('본인의 관리자 권한은 해제할 수 없어요.');
      if(patch.position!==undefined && patch.position!==current.position && !canonicalPositions.includes(patch.position))throw new Error('직책은 회장, 부회장, 총무 중에서 선택해 주세요.');
      const next={...current,...patch};
      if(!['leader','treasurer','member'].includes(next.role) || !['active','pending','rejected'].includes(next.status)) throw new Error('유효한 역할과 가입 상태를 선택해 주세요.');
      if(isDemo) applyDemo({...dataRef.current,members:replace(dataRef.current.members,next)}); else await updateDoc(doc(database(),'members',id),clean(patch));
    },
    async savePost(post) {
      const actor=active(); const old=dataRef.current.posts.find(item=>item.id===post.id);
      if(old && old.updatedAt!==post.updatedAt) throw new Error('다른 변경이 있어요. 글을 다시 확인한 뒤 수정해 주세요.');
      if(old && old.authorId!==actor.id && !isAdmin) throw new Error('작성자만 글을 수정할 수 있어요.');
      if(!isAdmin && (post.category==='notice' || post.pinned!==(old?.pinned ?? false) || old?.category==='notice')) throw new Error('공지사항은 관리자만 작성할 수 있어요.');
      if(!post.title.trim() || post.title.length>120 || post.body.length>20000 || post.images.length>8) throw new Error('제목, 본문과 사진 개수를 확인해 주세요.');
      const now=new Date().toISOString();
      const next: Post=clean({...post,title:post.title.trim(),authorId:old?.authorId ?? actor.id,createdAt:old?.createdAt ?? now,updatedAt:now,likedBy:old?.likedBy ?? [],images:normalizeImages(post.images)});
      if(isDemo) applyDemo({...dataRef.current,posts:replace(dataRef.current.posts,next)});
      else await runTransaction(database(),async transaction=>{
        const postRef=doc(database(),'posts',post.id); const snapshot=await transaction.get(postRef);
        if(snapshot.exists()) {
          const current=snapshot.data() as Post;
          if(current.updatedAt!==post.updatedAt) throw new Error('다른 변경이 있어요. 글을 다시 확인한 뒤 수정해 주세요.');
          transaction.set(postRef,{...next,authorId:current.authorId,createdAt:current.createdAt,likedBy:current.likedBy});
        } else transaction.set(postRef,next);
      });
    },
    async deletePost(id) {
      const actor=active(); const post=dataRef.current.posts.find(item=>item.id===id); if(!post || (!isAdmin && post.authorId!==actor.id)) throw new Error('글을 삭제할 권한이 없어요.');
      if(!isAdmin && post.category==='notice') throw new Error('공지사항은 관리자만 관리할 수 있어요.');
      if(isDemo) applyDemo({...dataRef.current,posts:dataRef.current.posts.filter(item=>item.id!==id),comments:dataRef.current.comments.filter(item=>item.postId!==id)});
      else { await deleteDoc(doc(database(),'posts',id)); /* Orphaned comments are hidden by the UI's post filter. */ }
    },
    async toggleLike(id) {
      const actor=active();
      if(isDemo) { const post=dataRef.current.posts.find(item=>item.id===id); if(!post) throw new Error('글을 찾을 수 없어요.'); const likedBy=post.likedBy.includes(actor.id) ? post.likedBy.filter(item=>item!==actor.id) : [...post.likedBy,actor.id]; applyDemo({...dataRef.current,posts:replace(dataRef.current.posts,{...post,likedBy})}); }
      else await runTransaction(database(),async transaction=>{ const postRef=doc(database(),'posts',id); const snapshot=await transaction.get(postRef); if(!snapshot.exists()) throw new Error('글을 찾을 수 없어요.'); const likedBy=(snapshot.data().likedBy ?? []) as string[]; transaction.update(postRef,{likedBy:likedBy.includes(actor.id) ? likedBy.filter(item=>item!==actor.id) : [...likedBy,actor.id]}); });
    },
    async addComment(postId,body) {
      const actor=active(); if(!body.trim() || body.length>2000) throw new Error('댓글은 1–2,000자로 입력해 주세요.');
      const comment={id:uid(),postId,authorId:actor.id,body:body.trim(),createdAt:new Date().toISOString()};
      if(isDemo) { if(!dataRef.current.posts.some(post=>post.id===postId)) throw new Error('글을 찾을 수 없어요.'); applyDemo({...dataRef.current,comments:[...dataRef.current.comments,comment]}); } else await setDoc(doc(database(),'comments',comment.id),comment);
    },
    async deleteComment(id) {
      const actor=active(); const comment=dataRef.current.comments.find(item=>item.id===id); if(!comment || (!isAdmin && comment.authorId!==actor.id)) throw new Error('댓글을 삭제할 권한이 없어요.');
      if(isDemo) applyDemo({...dataRef.current,comments:dataRef.current.comments.filter(item=>item.id!==id)}); else await deleteDoc(doc(database(),'comments',id));
    },
    async savePoll(poll) {
      const actor=active(); const old=dataRef.current.polls.find(item=>item.id===poll.id);
      if(old && old.updatedAt!==poll.updatedAt) throw new Error('다른 변경이 있어요. 새로 확인한 뒤 수정해 주세요.');
      if(old) managePoll(old); else if(!canCreatePoll) throw new Error('투표 생성 권한이 필요해요.');
      if(poll.status==='confirmed') throw new Error('결과에서 일정을 확정해 주세요.');
      if(!poll.title.trim() || poll.title.length>120 || poll.description.length>5000 || poll.slots.length<1 || poll.slots.length>2000 || new Set(poll.slots.map(slot=>slot.id)).size!==poll.slots.length || poll.slots.some(slot=>!/^\d{4}-\d{2}-\d{2}$/.test(slot.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(slot.start) || !/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(slot.end) || slot.start>=slot.end)) throw new Error('투표 제목과 후보 날짜·시간을 확인해 주세요.');
      if(poll.deadline!==null && !Number.isFinite(new Date(poll.deadline).getTime())) throw new Error('마감 일시를 확인해 주세요.');
      if(poll.slotMinutes!==undefined && ![30,60].includes(poll.slotMinutes)) throw new Error('선택 단위는 30분 또는 1시간으로 정해 주세요.');
      if(poll.timeWindows && (poll.timeWindows.length>248 || poll.timeWindows.some(window=>!/^\d{4}-\d{2}-\d{2}$/.test(window.date) || !/^\d{2}:\d{2}$/.test(window.start) || !/^\d{2}:\d{2}$/.test(window.end) || window.start>=window.end))) throw new Error('날짜별 시간대를 확인해 주세요.');
      const now=new Date().toISOString();
      const next=clean({...poll,title:poll.title.trim(),slotIds:poll.slots.map(slot=>slot.id),creatorId:old?.creatorId ?? actor.id,createdAt:old?.createdAt ?? now,updatedAt:now});
      if(isDemo) applyDemo({...dataRef.current,polls:replace(dataRef.current.polls,next)});
      else await runTransaction(database(),async transaction=>{ const pollRef=doc(database(),'polls',poll.id); const snapshot=await transaction.get(pollRef); if(snapshot.exists()) { const current=snapshot.data() as Poll; managePoll(current); if(old && current.updatedAt!==poll.updatedAt) throw new Error('다른 변경이 있어요. 새로 확인한 뒤 수정해 주세요.'); } transaction.set(pollRef,{...next,deadlineAt:next.deadline===null ? null : Timestamp.fromDate(new Date(next.deadline))}); });
    },
    async deletePoll(id) {
      const poll=dataRef.current.polls.find(item=>item.id===id); if(!poll) throw new Error('투표를 찾을 수 없어요.'); managePoll(poll);
      if(isDemo) applyDemo({...dataRef.current,polls:dataRef.current.polls.filter(item=>item.id!==id),votes:dataRef.current.votes.filter(item=>item.pollId!==id)});
      else await runTransaction(database(),async transaction=>{const pollRef=doc(database(),'polls',id); const snapshot=await transaction.get(pollRef); if(!snapshot.exists()) return; managePoll(snapshot.data() as Poll); transaction.delete(pollRef);});
    },
    async saveVote(pollId,slotIds) {
      const actor=active(); const id=`${pollId}_${actor.id}`;
      const validate=(poll: Poll)=>{ if(poll.status!=='open' || (poll.deadline!==null && new Date(poll.deadline).getTime()<=Date.now())) throw new Error('투표가 마감됐어요.'); if(slotIds.some(slotId=>!poll.slots.some(slot=>slot.id===slotId))) throw new Error('후보 시간이 변경됐어요. 다시 선택해 주세요.'); };
      const vote={id,pollId,memberId:actor.id,slotIds:[...new Set(slotIds)],updatedAt:new Date().toISOString()};
      if(isDemo) { const poll=dataRef.current.polls.find(item=>item.id===pollId); if(!poll) throw new Error('투표를 찾을 수 없어요.'); validate(poll); applyDemo({...dataRef.current,votes:replace(dataRef.current.votes,vote)}); }
      else await runTransaction(database(),async transaction=>{ const pollSnapshot=await transaction.get(doc(database(),'polls',pollId)); if(!pollSnapshot.exists()) throw new Error('투표를 찾을 수 없어요.'); validate(pollSnapshot.data() as Poll); transaction.set(doc(database(),'votes',id),vote); });
    },
    async confirmPoll(pollId,slotId,location,endSlotId) {
      const actor=admin();
      const build=(poll: Poll) => { if(poll.status==='confirmed') return null; const slot=poll.slots.find(item=>item.id===slotId); if(!slot) throw new Error('후보 시간이 변경됐어요. 다시 확인해 주세요.'); if(!location.trim()) throw new Error('모임 장소를 입력해 주세요.'); const endSlot=poll.slots.find(item=>item.id===(endSlotId ?? slotId)); if(!endSlot || endSlot.date!==slot.date)throw new Error('같은 날짜의 연속된 시간을 선택해 주세요.'); const candidates=poll.slots.filter(item=>item.date===slot.date).sort((a,b)=>a.start.localeCompare(b.start)); const from=candidates.findIndex(item=>item.id===slot.id),to=candidates.findIndex(item=>item.id===endSlot.id); if(to<from || candidates.slice(from,to).some((item,index)=>item.end!==candidates[from+index+1].start))throw new Error('같은 날짜의 연속된 시간을 선택해 주세요.'); const event: MoimEvent={id:`poll-${pollId}`,title:poll.title,description:poll.description,date:slot.date,start:slot.start,end:endSlot.end,location:location.trim(),creatorId:actor.id,createdAt:new Date().toISOString(),pollId}; return event; };
      if(isDemo) { const poll=dataRef.current.polls.find(item=>item.id===pollId); if(!poll) throw new Error('투표를 찾을 수 없어요.'); const event=build(poll); if(!event) return; applyDemo({...dataRef.current,events:replace(dataRef.current.events,event),polls:replace(dataRef.current.polls,{...poll,status:'confirmed',eventId:event.id,updatedAt:new Date().toISOString()})}); }
      else await runTransaction(database(),async transaction=>{const pollRef=doc(database(),'polls',pollId);const snapshot=await transaction.get(pollRef);if(!snapshot.exists())throw new Error('투표를 찾을 수 없어요.');const event=build(snapshot.data() as Poll);if(!event)return;transaction.set(doc(database(),'events',event.id),{...event,endAt:Timestamp.fromDate(eventEnd(event))});transaction.update(pollRef,{status:'confirmed',eventId:event.id,updatedAt:new Date().toISOString()});});
    },
    async saveBallot(ballot) {
      const actor=active();const old=dataRef.current.ballots.find(item=>item.id===ballot.id);
      const allowed=(record:EventBallot)=>{if(record.kind==='mvp'){admin();return;}if(!isAdmin && !(actor.canCreatePoll && record.creatorId===actor.id))throw new Error('투표를 관리할 권한이 없어요.');};
      if(old){allowed(old);if(old.status==='confirmed')throw new Error('확정한 장소 투표는 변경할 수 없어요.');if(old.updatedAt!==ballot.updatedAt)throw new Error('다른 변경이 있어요. 투표를 다시 확인해 주세요.');}
      else if(ballot.kind==='mvp')admin();else if(!canCreatePoll)throw new Error('투표 생성 권한이 필요해요.');
      if(!['venue','mvp'].includes(ballot.kind) || !['open','closed'].includes(ballot.status) || !ballot.title.trim() || ballot.title.length>120 || ballot.options.length<1 || ballot.options.length>30 || new Set(ballot.options.map(option=>option.id)).size!==ballot.options.length || ballot.options.some(option=>!option.id || !option.label.trim() || option.label.length>100 || (option.detail?.length ?? 0)>300 || (option.menu?.length ?? 0)>2000))throw new Error('투표 제목과 후보를 확인해 주세요.');
      if(ballot.kind==='mvp' && (new Set(ballot.options.map(option=>option.memberId)).size!==ballot.options.length || ballot.options.some(option=>!option.memberId || !dataRef.current.members.some(member=>member.id===option.memberId && member.status==='active'))))throw new Error('MVP 후보는 승인된 멤버 중에서 선택해 주세요.');
      const {selectedOptionId:_selected,...fields}=ballot;const now=new Date().toISOString();const next=clean({...fields,title:ballot.title.trim(),optionIds:ballot.options.map(option=>option.id),creatorId:old?.creatorId ?? actor.id,createdAt:old?.createdAt ?? now,updatedAt:now});
      if(isDemo){if(!dataRef.current.events.some(event=>event.id===ballot.eventId))throw new Error('일정을 찾을 수 없어요.');applyDemo({...dataRef.current,ballots:replace(dataRef.current.ballots,next)});}
      else await runTransaction(database(),async transaction=>{const ballotRef=doc(database(),'ballots',ballot.id);const snapshot=await transaction.get(ballotRef);const event=await transaction.get(doc(database(),'events',ballot.eventId));if(!event.exists())throw new Error('일정을 찾을 수 없어요.');if(snapshot.exists()){const current=snapshot.data() as EventBallot;allowed(current);if(current.status==='confirmed' || current.updatedAt!==ballot.updatedAt)throw new Error('다른 변경이 있어요. 투표를 다시 확인해 주세요.');}transaction.set(ballotRef,next);});
    },
    async deleteBallot(id) {
      const actor=active();const validate=(ballot:EventBallot)=>{if(ballot.status==='confirmed')throw new Error('확정한 장소 투표는 삭제할 수 없어요.');if(ballot.kind==='mvp')admin();else if(!isAdmin && !(actor.canCreatePoll && ballot.creatorId===actor.id))throw new Error('투표를 삭제할 권한이 없어요.');};
      if(isDemo){const ballot=dataRef.current.ballots.find(item=>item.id===id);if(!ballot)throw new Error('투표를 찾을 수 없어요.');validate(ballot);applyDemo({...dataRef.current,ballots:dataRef.current.ballots.filter(item=>item.id!==id),ballotResponses:dataRef.current.ballotResponses.filter(item=>item.ballotId!==id)});}
      else {
        const ballotRef=doc(database(),'ballots',id);const closingRevision=new Date().toISOString();
        const exists=await runTransaction(database(),async transaction=>{const snapshot=await transaction.get(ballotRef);if(!snapshot.exists())return false;validate(snapshot.data() as EventBallot);transaction.update(ballotRef,{status:'closed',updatedAt:closingRevision});return true;});
        if(!exists)return;
        const responses=await getDocs(query(collection(database(),'ballotResponses'),where('ballotId','==',id)));
        if(responses.size>450)throw new Error('응답이 많은 투표예요. 관리자 데이터 도구에서 삭제해 주세요.');
        await runTransaction(database(),async transaction=>{const snapshot=await transaction.get(ballotRef);if(!snapshot.exists())return;const current=snapshot.data() as EventBallot;validate(current);if(current.status!=='closed' || current.updatedAt!==closingRevision)throw new Error('삭제 중 투표가 변경됐어요. 다시 확인해 주세요.');for(const response of responses.docs)transaction.delete(response.ref);transaction.delete(ballotRef);});
      }
    },
    async saveBallotResponse(ballotId,optionId) {
      const actor=active();const id=`${ballotId}_${actor.id}`;const validate=(ballot:EventBallot)=>{if(ballot.status!=='open')throw new Error('투표가 마감됐어요.');if(!ballot.options.some(option=>option.id===optionId))throw new Error('후보가 변경됐어요. 다시 선택해 주세요.');};
      if(isDemo){const ballot=dataRef.current.ballots.find(item=>item.id===ballotId);if(!ballot)throw new Error('투표를 찾을 수 없어요.');validate(ballot);applyDemo({...dataRef.current,ballotResponses:replace(dataRef.current.ballotResponses,{id,ballotId,eventId:ballot.eventId,memberId:actor.id,optionId,updatedAt:new Date().toISOString()})});}
      else await runTransaction(database(),async transaction=>{const snapshot=await transaction.get(doc(database(),'ballots',ballotId));if(!snapshot.exists())throw new Error('투표를 찾을 수 없어요.');const ballot=snapshot.data() as EventBallot;validate(ballot);transaction.set(doc(database(),'ballotResponses',id),{id,ballotId,eventId:ballot.eventId,memberId:actor.id,optionId,updatedAt:new Date().toISOString()});});
    },
    async confirmVenue(ballotId,optionId) {
      admin();const prepare=(ballot:EventBallot)=>{if(ballot.kind!=='venue')throw new Error('장소 투표에서 선택해 주세요.');if(ballot.status==='confirmed')return null;const option=ballot.options.find(item=>item.id===optionId);if(!option)throw new Error('후보가 변경됐어요. 다시 확인해 주세요.');const location=`${option.label}${option.detail ? ` · ${option.detail}`:''}`.trim();if(location.length>500)throw new Error('장소 이름과 주소는 합쳐서 500자 이내로 정해 주세요.');return location;};
      if(isDemo){const ballot=dataRef.current.ballots.find(item=>item.id===ballotId);if(!ballot)throw new Error('투표를 찾을 수 없어요.');const location=prepare(ballot);if(location===null)return;const event=dataRef.current.events.find(item=>item.id===ballot.eventId);if(!event)throw new Error('일정을 찾을 수 없어요.');applyDemo({...dataRef.current,ballots:replace(dataRef.current.ballots,{...ballot,status:'confirmed',selectedOptionId:optionId,updatedAt:new Date().toISOString()}),events:replace(dataRef.current.events,{...event,location})});}
      else await runTransaction(database(),async transaction=>{const ballotRef=doc(database(),'ballots',ballotId);const snapshot=await transaction.get(ballotRef);if(!snapshot.exists())throw new Error('투표를 찾을 수 없어요.');const ballot=snapshot.data() as EventBallot;const location=prepare(ballot);if(location===null)return;const eventRef=doc(database(),'events',ballot.eventId);const event=await transaction.get(eventRef);if(!event.exists())throw new Error('일정을 찾을 수 없어요.');transaction.update(ballotRef,{status:'confirmed',selectedOptionId:optionId,updatedAt:new Date().toISOString()});transaction.update(eventRef,{location});});
    },
    async saveEvent(event) {
      const actor=admin(); const old=dataRef.current.events.find(item=>item.id===event.id);
      if(!event.title.trim() || event.title.length>120 || event.description.length>10000 || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.start) || !/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(event.end) || !event.location.trim() || event.location.length>500 || !/^\d{4}-\d{2}-\d{2}$/.test(event.date) || event.start>=event.end) throw new Error('일정 제목, 날짜, 시간과 장소를 확인해 주세요.');
      if(event.calendarLink && !old?.calendarLink) throw new Error('Google 캘린더 초대에서 일정을 연결해 주세요.');
      const {calendarLink:_incomingCalendarLink,...eventFields}=event;
      const build=(current?: MoimEvent) => clean({...eventFields,title:event.title.trim(),location:event.location.trim(),creatorId:current?.creatorId ?? actor.id,createdAt:current?.createdAt ?? new Date().toISOString(),...(current?.pollId ? {pollId:current.pollId}:{}),...(current?.calendarLink ? {calendarLink:current.calendarLink}:{})});
      if(isDemo) applyDemo({...dataRef.current,events:replace(dataRef.current.events,build(old))});
      else await runTransaction(database(),async transaction=>{const eventRef=doc(database(),'events',event.id);const snapshot=await transaction.get(eventRef);const next=build(snapshot.exists() ? snapshot.data() as MoimEvent : undefined);transaction.set(eventRef,{...next,endAt:Timestamp.fromDate(eventEnd(next))});});
    },
    async saveCalendarLink(eventId,link) {
      const actor=admin();
      if(link.ownerId!==actor.id || !link.googleEventId || link.googleEventId.length>1024 || !/^https:\/\/(calendar\.google\.com\/|www\.google\.com\/calendar\/)/.test(link.htmlLink) || link.htmlLink.length>4000 || !Number.isFinite(new Date(link.syncedAt).getTime()) || typeof link.signature!=='string' || link.signature.length>20000 || link.attendeeIds.length>500 || link.attendeeIds.some(id=>typeof id!=='string' || !id || id.length>128) || new Set(link.attendeeIds).size!==link.attendeeIds.length) throw new Error('Google 캘린더 연결 정보를 확인해 주세요.');
      const next: CalendarLink=clean(link);
      const validate=(event: MoimEvent) => {if(event.calendarLink && event.calendarLink.ownerId!==actor.id)throw new Error('처음 캘린더에 연결한 관리자가 업데이트할 수 있어요.');};
      if(isDemo){const event=dataRef.current.events.find(item=>item.id===eventId);if(!event)throw new Error('일정을 찾을 수 없어요.');validate(event);applyDemo({...dataRef.current,events:replace(dataRef.current.events,{...event,calendarLink:next})});}
      else await runTransaction(database(),async transaction=>{const eventRef=doc(database(),'events',eventId);const snapshot=await transaction.get(eventRef);if(!snapshot.exists())throw new Error('일정을 찾을 수 없어요.');validate(snapshot.data() as MoimEvent);transaction.update(eventRef,{calendarLink:next});});
    },
    async deleteEvent(id) {
      admin();
      if(isDemo) {
        const event=dataRef.current.events.find(item=>item.id===id);
        const polls=dataRef.current.polls.map(poll=>{ if(poll.id!==event?.pollId || poll.eventId!==id) return poll; const {eventId: _removed,...remaining}=poll; return {...remaining,status:'closed' as const,updatedAt:new Date().toISOString()}; });
        applyDemo({...dataRef.current,polls,events:dataRef.current.events.filter(item=>item.id!==id),rsvps:dataRef.current.rsvps.filter(item=>item.eventId!==id)});
      } else await runTransaction(database(),async transaction=>{
        const eventRef=doc(database(),'events',id); const snapshot=await transaction.get(eventRef); if(!snapshot.exists())return;
        const event=snapshot.data() as MoimEvent;
        const pollSnapshot=event.pollId ? await transaction.get(doc(database(),'polls',event.pollId)) : null;
        transaction.delete(eventRef);
        if(pollSnapshot?.exists() && pollSnapshot.data().eventId===id && pollSnapshot.data().status==='confirmed') transaction.update(pollSnapshot.ref,{status:'closed',eventId:deleteField(),updatedAt:new Date().toISOString()});
      });
    },
    async saveMvpVote(eventId,candidateId) {
      const actor=active();const id=`${eventId}_${actor.id}`;
      const validate=(event:MoimEvent,voterGoing:boolean,candidateGoing:boolean,candidateActive:boolean)=>{const end=eventEnd(event).getTime();if(Date.now()<end-600000 || Date.now()>=end+86400000)throw new Error('MVP 투표는 모임 종료 10분 전부터 다음 날 같은 시간까지 참여할 수 있어요.');if(!voterGoing)throw new Error('이 모임에 참여한 멤버만 투표할 수 있어요.');if(!candidateGoing || !candidateActive)throw new Error('참여한 멤버 중에서 선택해 주세요.');};
      const next={id,eventId,memberId:actor.id,candidateId,updatedAt:new Date().toISOString()};
      if(isDemo){const event=dataRef.current.events.find(item=>item.id===eventId);if(!event)throw new Error('일정을 찾을 수 없어요.');validate(event,dataRef.current.rsvps.some(item=>item.eventId===eventId && item.memberId===actor.id && item.status==='going'),dataRef.current.rsvps.some(item=>item.eventId===eventId && item.memberId===candidateId && item.status==='going'),dataRef.current.members.some(item=>item.id===candidateId && item.status==='active'));applyDemo({...dataRef.current,mvpVotes:replace(dataRef.current.mvpVotes,next)});}
      else await runTransaction(database(),async transaction=>{const event=await transaction.get(doc(database(),'events',eventId));const voter=await transaction.get(doc(database(),'rsvps',`${eventId}_${actor.id}`));const candidate=await transaction.get(doc(database(),'rsvps',`${eventId}_${candidateId}`));const member=await transaction.get(doc(database(),'members',candidateId));if(!event.exists())throw new Error('일정을 찾을 수 없어요.');validate(event.data() as MoimEvent,voter.data()?.status==='going',candidate.data()?.status==='going',member.data()?.status==='active');transaction.set(doc(database(),'mvpVotes',id),next);});
    },
    async saveRsvp(eventId,status) {
      const actor=active(); if(!['going','notGoing'].includes(status)) throw new Error('참석 여부를 확인해 주세요.');
      const rsvp={id:`${eventId}_${actor.id}`,eventId,memberId:actor.id,status,updatedAt:new Date().toISOString()} as Rsvp;
      if(isDemo) {if(!dataRef.current.events.some(item=>item.id===eventId))throw new Error('일정을 찾을 수 없어요.');applyDemo({...dataRef.current,rsvps:replace(dataRef.current.rsvps,rsvp)});} else await setDoc(doc(database(),'rsvps',rsvp.id),rsvp);
    },
    async uploadImages(files) {
      const actor=active(); if(files.length>8) throw new Error('사진은 최대 8장까지 올릴 수 있어요.');
      if(files.some(file=>!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size>5*1024*1024)) throw new Error('JPG, PNG, WebP, GIF 사진을 장당 5MB 이하로 올려주세요.');
      const generation=imageGeneration.current;
      return await Promise.all(files.map(async file=>{const id=uid();let path:string;let blob:Blob=file;
        if(isDemo){await saveDemoImage(id,file);path=`demo-image:${id}`;}
        else{const prepared=await preparePostPhoto(file);if(prepared.imageURL.length>700000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(prepared.imageURL))throw new Error('사진을 저장할 수 있는 크기로 줄여 주세요.');await setDoc(doc(database(),'photos',id),{id,imageURL:prepared.imageURL,uploadedBy:actor.id,createdAt:new Date().toISOString()});blob=await (await fetch(prepared.imageURL)).blob();path=`photo:${id}`;}
        if(generation!==imageGeneration.current)throw new Error('로그인 상태가 변경됐어요. 다시 시도해 주세요.');const url=URL.createObjectURL(blob);imageCache.current.set(path,url);reverseImages.current.set(url,path);setImageUrls(previous=>({...previous,[path]:url}));return url;
      }));
    },
    resetDemo() { if(!isDemo) return; const next=createDemoData();applyDemo(next);setDemoSignedIn(true);setError(null); },
  }),[data,user,loading,isAdmin,canParticipate,canCreatePoll,error,imageUrls]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp(): AppContextValue {const context=useContext(AppContext);if(!context)throw new Error('AppProvider가 필요해요.');return context;}
