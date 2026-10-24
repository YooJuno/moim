#!/usr/bin/env node
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const value = flag => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const projectId = value('--project');
const email = value('--email');
const uid = value('--uid');
if (!projectId || (!email && !uid) || (email && uid)) {
  console.error('사용법: npm run bootstrap:admin -- --project moim-juno --email 사용자@gmail.com');
  console.error('이메일 대신 --uid FIREBASE_AUTH_UID도 사용할 수 있어요. Application Default Credentials가 필요해요.');
  process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const db = getFirestore();
try {
  const account = uid ? await auth.getUser(uid) : await auth.getUserByEmail(email);
  if (account.disabled) throw new Error('사용 중지된 계정은 관리자으로 지정할 수 없어요.');
  const now = new Date().toISOString();
  await db.runTransaction(async transaction => {
    const memberRef = db.doc(`members/${account.uid}`);
    const profileRef = db.doc(`profiles/${account.uid}`);
    const settingsRef = db.doc('settings/club');
    const bylawsRef = db.doc('settings/bylaws');
    const [member, profile, settings, bylaws] = await Promise.all([
      transaction.get(memberRef), transaction.get(profileRef), transaction.get(settingsRef), transaction.get(bylawsRef),
    ]);
    transaction.set(memberRef, {
      id: account.uid,
      name: member.data()?.name || account.displayName || '관리자',
      email: account.email || '',
      ...(account.photoURL ? { photoURL: account.photoURL } : {}),
      joinedAt: member.data()?.joinedAt || now,
      role: 'leader', status: 'active', canCreatePoll: true,
    });
    if (!profile.exists) transaction.set(profileRef, { id: account.uid, phone: '', area: '' });
    if (!settings.exists) transaction.set(settingsRef, { name: '우리 모임', description: '함께 채우는 우리의 시간' });
    if (!bylaws.exists) transaction.set(bylawsRef, { content: '', updatedAt: now, editorId: account.uid });
  });
  console.log(`관리자 등록 완료: ${account.email || account.uid} (${projectId})`);
} catch (error) {
  console.error(error instanceof Error ? error.message : '관리자 등록에 실패했어요.');
  console.error('Google 로그인으로 계정을 먼저 만든 뒤, 해당 프로젝트의 관리자 인증 정보를 확인해 주세요.');
  process.exitCode = 1;
}
