// =====================
// Firebase 初期化モジュール
// Firebase SDK (CDN ESM版 v11.1.0) を直接import
// =====================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';

// =====================
// Firebase設定
// Firebase Console → プロジェクト設定 → マイアプリ → ウェブアプリ から取得した値を貼り付ける
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyAHFOWgxWXy7KaCXr0OBCkM7KTcrx_qSFk",
  authDomain: "membermanage-softball.firebaseapp.com",
  projectId: "membermanage-softball",
  storageBucket: "membermanage-softball.firebasestorage.app",
  messagingSenderId: "682635469616",
  appId: "1:682635469616:web:20cfa3441e9880b0f2def5",
  measurementId: "G-KY4YL4DN7H"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);

// 認証インスタンス（auth.js等から利用）
export const auth = getAuth(app);

// Firestoreインスタンス（db.js等から利用）
export const db = getFirestore(app);

// オフライン永続化を有効化（ネットワーク切断時もキャッシュデータで動作可能にする）
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    // 複数タブが開いている場合、1つのタブでのみ永続化が有効
    console.warn('オフライン永続化: 複数タブが開いているため有効化できません');
  } else if (err.code === 'unimplemented') {
    // ブラウザがIndexedDB永続化に対応していない
    console.warn('オフライン永続化: このブラウザは非対応です');
  }
});

console.log('Firebase初期化完了:', firebaseConfig.projectId);
