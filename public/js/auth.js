// =====================
// 認証モジュール
// Firebase Authentication + Firestore ユーザー/チーム管理
// =====================

import { auth, db } from './firebase-init.js';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import {
  doc, getDoc, setDoc,
  collection, serverTimestamp, writeBatch,
  getDocs, query, where, updateDoc
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';

// =====================
// モジュールスコープ変数
// =====================
export let currentTeamId = null;
export let currentUserRole = null;

// =====================
// 認証関数
// =====================


// Firebase Authエラーをユーザー向けメッセージに変換
function getAuthErrorMessage(error) {
  const rawMessage = error?.message || '不明なエラー';
  const code = error?.code || '';

  // APIキーのHTTPリファラー制限でブロックされたケース
  if (
    code === 'auth/requests-from-referer-are-blocked' ||
    rawMessage.includes('requests-from-referer')
  ) {
    return [
      'ログインに失敗しました: APIキーのリファラー制限によりブロックされています。',
      'Firebase Console / Google Cloud Console で、現在のアクセス元ドメイン（例: membermanage-softball.firebaseapp.com, membermanage-softball.web.app, localhost）を許可してください。'
    ].join('\n');
  }

  if (code === 'auth/invalid-api-key') {
    return 'ログインに失敗しました: Firebase APIキーが無効です。firebase-init.js の設定値を確認してください。';
  }

  if (code === 'auth/unauthorized-domain') {
    return 'ログインに失敗しました: このドメインは認証許可ドメインに登録されていません。Firebase Authentication の設定を確認してください。';
  }

  return 'ログインに失敗しました: ' + rawMessage;
}

// Googleログイン（ポップアップ優先、ブロック時はリダイレクトにフォールバック）
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    return await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
      return signInWithRedirect(auth, provider);
    }
    console.error('ログインエラー:', e);
    alert(getAuthErrorMessage(e));
    throw e;
  }
}

// リダイレクトログインの結果を確認（ページ読み込み時に呼び出す）
export async function checkRedirectResult() {
  try {
    return await getRedirectResult(auth);
  } catch (e) {
    console.error('リダイレクト結果の取得エラー:', e);
    alert(getAuthErrorMessage(e));
    return null;
  }
}

// ログアウト
export async function logout() {
  try {
    await signOut(auth);
    localStorage.removeItem('selectedTeamId');
    window.location.href = '/login.html';
  } catch (e) {
    console.error('ログアウトエラー:', e);
    alert('ログアウトに失敗しました');
  }
}

// 現在のユーザーを取得
export function getCurrentUser() {
  return auth.currentUser;
}

// 認証状態リスナーを設定
export function setupAuthListener(callback) {
  return onAuthStateChanged(auth, callback);
}

// =====================
// チーム管理関数
// =====================

// ユーザーの所属チーム一覧を取得（users/{userId}ドキュメントから）
export async function getUserTeams(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return [];
    const data = userDoc.data();
    if (!data.teams) return [];
    // teamsマップを配列に変換
    return Object.entries(data.teams).map(([teamId, info]) => ({
      teamId,
      teamName: info.teamName || 'チーム名なし',
      role: info.role || 'member'
    }));
  } catch (e) {
    console.error('チーム一覧取得エラー:', e);
    return [];
  }
}

// 新しいチームを作成
export async function createTeam(teamName, user) {
  try {
    const batch = writeBatch(db);
    const teamRef = doc(collection(db, 'teams'));
    const teamId = teamRef.id;

    // チーム情報ドキュメント
    batch.set(doc(db, `teams/${teamId}/info`, 'main'), {
      name: teamName,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      settings: {
        teamName: teamName,
        defaultManager: '',
        defaultCoach: '',
        teamColor: '#1a73e8'
      }
    });

    // メンバーとして自分をadminで登録
    batch.set(doc(db, `teams/${teamId}/members`, user.uid), {
      displayName: user.displayName || '',
      email: user.email || '',
      role: 'admin',
      linkedPlayerId: null,
      joinedAt: serverTimestamp()
    });

    // ユーザードキュメントにチーム情報を追加
    batch.set(doc(db, 'users', user.uid), {
      displayName: user.displayName || '',
      email: user.email || '',
      teams: {
        [teamId]: {
          teamName: teamName,
          role: 'admin',
          joinedAt: new Date().toISOString()
        }
      }
    }, { merge: true });

    await batch.commit();
    console.log('チーム作成完了:', teamId);
    return teamId;
  } catch (e) {
    console.error('チーム作成エラー:', e);
    alert('チームの作成に失敗しました: ' + e.message);
    throw e;
  }
}

// 招待コードでチームに参加
export async function joinTeamByInviteCode(inviteCode, user) {
  try {
    const normalizedCode = inviteCode.trim();

    // 招待ドキュメントを取得
    const inviteRef = doc(db, 'invites', normalizedCode);
    const inviteDoc = await getDoc(inviteRef);

    if (!inviteDoc.exists()) {
      return { success: false, error: 'invalid_code', message: '無効な招待コードです' };
    }

    const inviteData = inviteDoc.data();

    const availability = evaluateInviteAvailability(inviteData);
    if (!availability.ok) {
      return { success: false, error: availability.error, message: availability.message };
    }

    const teamId = inviteData.teamId;

    // チーム名を取得
    const teamInfoDoc = await getDoc(doc(db, `teams/${teamId}/info`, 'main'));
    const teamName = teamInfoDoc.exists() ? teamInfoDoc.data().name : 'チーム名なし';

    // バッチ書き込み
    const batch = writeBatch(db);

    // メンバーとして登録
    batch.set(doc(db, `teams/${teamId}/members`, user.uid), {
      displayName: user.displayName || '',
      email: user.email || '',
      role: 'member',
      linkedPlayerId: null,
      joinedAt: serverTimestamp()
    });

    // ユーザードキュメントにチーム情報を追加
    batch.set(doc(db, 'users', user.uid), {
      displayName: user.displayName || '',
      email: user.email || '',
      teams: {
        [teamId]: {
          teamName: teamName,
          role: 'member',
          joinedAt: new Date().toISOString()
        }
      }
    }, { merge: true });

    // 招待の利用状態を更新
    batch.update(inviteRef, {
      status: 'used',
      usedBy: user.uid,
      usedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
    console.log('チーム参加完了:', teamId);
    return { success: true, teamId, teamName };
  } catch (e) {
    console.error('チーム参加エラー:', e);
    return { success: false, error: 'unknown', message: '参加に失敗しました: ' + e.message };
  }
}

function evaluateInviteAvailability(inviteData) {
  if (!inviteData?.teamId) {
    return { ok: false, error: 'invalid_code', message: '無効な招待コードです' };
  }

  if (inviteData.status === 'revoked') {
    return { ok: false, error: 'revoked', message: 'この招待リンクは無効化されています' };
  }

  if (inviteData.status === 'used' || inviteData.usedBy || inviteData.usedAt) {
    return { ok: false, error: 'already_used', message: 'この招待リンクはすでに使用されています' };
  }

  const expiresAtDate = parseInviteDate(inviteData.expiresAt);
  if (expiresAtDate && expiresAtDate < new Date()) {
    return { ok: false, error: 'expired', message: '招待コードの有効期限が切れています' };
  }

  return { ok: true, error: null, message: '' };
}

function parseInviteDate(value) {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeInviteData(rawInvite = {}) {
  return {
    ...rawInvite,
    status: rawInvite.status || (rawInvite.usedBy || rawInvite.usedAt ? 'used' : 'active'),
    expiresAt: rawInvite.expiresAt || null,
    usedBy: rawInvite.usedBy || null,
    usedAt: rawInvite.usedAt || null
  };
}

// 招待コードの状態をログイン画面で事前確認
export async function inspectInviteCode(inviteCode) {
  const normalizedCode = inviteCode.trim();
  if (!normalizedCode) {
    return { ok: false, error: 'invalid_code', message: '招待コードが指定されていません', invite: null };
  }

  const inviteRef = doc(db, 'invites', normalizedCode);
  const inviteDoc = await getDoc(inviteRef);
  if (!inviteDoc.exists()) {
    return { ok: false, error: 'invalid_code', message: '無効な招待コードです', invite: null };
  }

  const inviteData = normalizeInviteData(inviteDoc.data());
  const availability = evaluateInviteAvailability(inviteData);
  return {
    ok: availability.ok,
    error: availability.error,
    message: availability.ok ? 'この招待リンクは有効です' : availability.message,
    invite: { code: normalizedCode, ...inviteData }
  };
}

// 招待コードを生成（adminが使用）
export async function createInviteCode(teamId) {
  try {
    const code = generateInviteId();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7日間有効

    await setDoc(doc(db, 'invites', code), {
      teamId: teamId,
      createdBy: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: expiresAt,
      usedBy: null,
      usedAt: null,
      status: 'active'
    });

    console.log('招待コード生成:', code);
    return code;
  } catch (e) {
    console.error('招待コード生成エラー:', e);
    alert('招待コードの生成に失敗しました');
    throw e;
  }
}

// チームに紐づく招待一覧を取得（管理者向け）
export async function getTeamInvites(teamId) {
  const invitesRef = collection(db, 'invites');
  const q = query(invitesRef, where('teamId', '==', teamId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(d => {
      const data = normalizeInviteData(d.data());
      return {
        code: d.id,
        ...data,
      };
    })
    .sort((a, b) => {
      const aTs = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bTs = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bTs - aTs;
    });
}

// 招待コードを無効化
export async function revokeInviteCode(inviteCode) {
  const inviteRef = doc(db, 'invites', inviteCode);
  await updateDoc(inviteRef, {
    status: 'revoked',
    updatedAt: serverTimestamp()
  });
}

// 招待コードを再発行（旧コードを無効化して新規コードを作成）
export async function reissueInviteCode(inviteCode, teamId) {
  await revokeInviteCode(inviteCode);
  return createInviteCode(teamId);
}

// 招待URLを生成
export function buildInviteUrl(inviteCode) {
  return `${window.location.origin}/login.html?invite=${encodeURIComponent(inviteCode)}`;
}

// =====================
// 権限管理関数
// =====================

// ユーザーのチーム内ロールを取得
export async function getUserRole(teamId, userId) {
  try {
    const memberDoc = await getDoc(doc(db, `teams/${teamId}/members`, userId));
    if (!memberDoc.exists()) return null;
    return memberDoc.data().role || 'member';
  } catch (e) {
    console.error('ロール取得エラー:', e);
    return null;
  }
}

// 現在のチームとロールを設定
export function setCurrentTeam(teamId, role) {
  currentTeamId = teamId;
  currentUserRole = role;
  localStorage.setItem('selectedTeamId', teamId);
}

// ロールに基づいてUI要素の表示/非表示を切り替え
export function updateUIForRole(role) {
  const adminElements = document.querySelectorAll('[data-role="admin"]');
  adminElements.forEach(el => {
    el.style.display = role === 'admin' ? '' : 'none';
  });
}

// =====================
// ユーティリティ
// =====================

// 6文字の英数字ランダムコードを生成
export function generateInviteId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
