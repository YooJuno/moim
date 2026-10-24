import type { Member } from './types';
export const POSITIONS=['회장','부회장','총무'] as const;
export type Position=typeof POSITIONS[number];
export const isPosition=(value?:string):value is Position=>POSITIONS.some(position=>position===value);
export const positionLabel=(member:Pick<Member,'position'|'role'>)=>isPosition(member.position)?member.position:member.role==='leader'?'관리자':'직책 없음';
export const positionRank=(value?:string)=>isPosition(value)?POSITIONS.length-POSITIONS.indexOf(value):0;
