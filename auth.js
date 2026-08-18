// auth.js
// 사용자에게는 "아이디/비밀번호"만 보이는 간단한 계정 시스템.
// 내부적으로는 Firebase Auth 의 이메일/비밀번호 로그인을
// "{username}@sudoku.local" 형태의 가짜 이메일로 감싸서 사용한다.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  doc, setDoc, getDoc,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { auth, db, isFirebaseConfigured } from './firebase-config.js';

const USERNAME_RE = /^[a-zA-Z0-9가-힣_-]{2,16}$/;

function toFakeEmail(username) {
  return `${username.toLowerCase()}@sudoku.local`;
}

export function validateUsername(username) {
  if (!USERNAME_RE.test(username)) {
    return '아이디는 2~16자, 한글/영문/숫자/_/- 만 사용할 수 있어요.';
  }
  return null;
}

export function validatePassword(password) {
  if (!password || password.length < 4) {
    return '비밀번호는 4자 이상이어야 해요.';
  }
  return null;
}

export async function registerUser(username, password) {
  if (!isFirebaseConfigured) throw new Error('OFFLINE');
  const uErr = validateUsername(username);
  if (uErr) throw new Error(uErr);
  const pErr = validatePassword(password);
  if (pErr) throw new Error(pErr);

  const cred = await createUserWithEmailAndPassword(auth, toFakeEmail(username), password);
  await updateProfile(cred.user, { displayName: username });
  await setDoc(doc(db, 'users', cred.user.uid), {
    username,
    createdAt: Date.now(),
  });
  return cred.user;
}

export async function loginUser(username, password) {
  if (!isFirebaseConfigured) throw new Error('OFFLINE');
  const cred = await signInWithEmailAndPassword(auth, toFakeEmail(username), password);
  return cred.user;
}

export async function logoutUser() {
  if (!isFirebaseConfigured) return;
  await signOut(auth);
}

export function watchAuthState(callback) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function getUsername(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data().username : null;
}

export function friendlyAuthError(err) {
  const code = err?.code || '';
  if (code.includes('email-already-in-use')) return '이미 사용 중인 아이디예요.';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return '아이디 또는 비밀번호가 올바르지 않아요.';
  }
  if (err?.message === 'OFFLINE') return 'Firebase 설정이 완료되지 않아 계정 기능을 사용할 수 없어요. README.md를 확인하세요.';
  return err?.message || '알 수 없는 오류가 발생했어요.';
}
