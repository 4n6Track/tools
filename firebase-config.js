// firebase-config.js
// ⚠️ 아래 값을 본인의 Firebase 프로젝트 설정으로 교체하세요.
// Firebase 콘솔 > 프로젝트 설정 > 일반 > "내 앱" 에서 확인할 수 있습니다.
// 자세한 설정 방법은 README.md 를 참고하세요.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyBdCDFljBDwO0O27LfAu2VTRbl6r7tdvtk",
    authDomain: "sudoku-press.firebaseapp.com",
    databaseURL: "https://sudoku-press-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sudoku-press",
    storageBucket: "sudoku-press.firebasestorage.app",
    messagingSenderId: "987974840985",
    appId: "1:987974840985:web:722ac993642ed58aa4fe08",
    measurementId: "G-HXXBJ0EJRS"
  };

// firebaseConfig 가 아직 채워지지 않았으면 온라인 기능(계정/리더보드)을 비활성화하고
// 퍼즐 플레이 자체는 오프라인으로 계속 동작하도록 한다.
export const isFirebaseConfigured =
  !firebaseConfig.apiKey.startsWith('AIzaSyBdCDFljBDwO0O27LfAu2VTRbl6r7tdvtk');

export let app = null;
export let auth = null;
export let db = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}
