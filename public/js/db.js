// =====================
// Firestoreアクセス層
// teams/{teamId} スコープでの全CRUD操作を提供
// =====================
import { db } from './firebase-init.js';
import {
    collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';

// =====================
// 選手管理 (players)
// =====================

// 全選手を取得
export async function getPlayers(teamId) {
    const ref = collection(db, 'teams', teamId, 'players');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// 選手を追加（Firestore自動IDを使用）
export async function addPlayer(teamId, playerData) {
    const ref = collection(db, 'teams', teamId, 'players');
    const docRef = await addDoc(ref, {
        ...playerData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
}

// 選手を更新
export async function updatePlayer(teamId, playerId, playerData) {
    const ref = doc(db, 'teams', teamId, 'players', playerId);
    await updateDoc(ref, {
        ...playerData,
        updatedAt: serverTimestamp()
    });
}

// 選手を削除
export async function deletePlayerDoc(teamId, playerId) {
    const ref = doc(db, 'teams', teamId, 'players', playerId);
    await deleteDoc(ref);
}

// =====================
// メンバー表 (lineups)
// =====================

// メンバー表一覧を取得（テンプレート除外）
export async function getLineups(teamId) {
    const ref = collection(db, 'teams', teamId, 'lineups');
    const q = query(ref, where('isTemplate', '==', false));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// テンプレート一覧を取得
export async function getTemplates(teamId) {
    const ref = collection(db, 'teams', teamId, 'lineups');
    const q = query(ref, where('isTemplate', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// メンバー表を追加
export async function addLineup(teamId, lineupData) {
    const ref = collection(db, 'teams', teamId, 'lineups');
    const docRef = await addDoc(ref, {
        ...lineupData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
}

// メンバー表を更新
export async function updateLineup(teamId, lineupId, lineupData) {
    const ref = doc(db, 'teams', teamId, 'lineups', lineupId);
    await updateDoc(ref, {
        ...lineupData,
        updatedAt: serverTimestamp()
    });
}

// メンバー表を削除
export async function deleteLineupDoc(teamId, lineupId) {
    const ref = doc(db, 'teams', teamId, 'lineups', lineupId);
    await deleteDoc(ref);
}

// =====================
// 試合成績 (gameStats)
// =====================

// 試合成績一覧を取得
export async function getGameStats(teamId) {
    const ref = collection(db, 'teams', teamId, 'gameStats');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// 試合成績を追加
export async function addGameStat(teamId, statData) {
    const ref = collection(db, 'teams', teamId, 'gameStats');
    const docRef = await addDoc(ref, {
        ...statData,
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

// 試合成績を更新
export async function updateGameStat(teamId, statId, statData) {
    const ref = doc(db, 'teams', teamId, 'gameStats', statId);
    await updateDoc(ref, statData);
}

// 試合成績を削除
export async function deleteGameStatDoc(teamId, statId) {
    const ref = doc(db, 'teams', teamId, 'gameStats', statId);
    await deleteDoc(ref);
}

// =====================
// チーム設定 (info/main)
// =====================

// チーム設定を取得
export async function getTeamSettings(teamId) {
    const ref = doc(db, 'teams', teamId, 'info', 'main');
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return { teamName: '', defaultManager: '', defaultCoach: '' };
    const data = snapshot.data();
    return data.settings || { teamName: '', defaultManager: '', defaultCoach: '' };
}

// チーム設定を更新
export async function updateTeamSettings(teamId, settings) {
    const ref = doc(db, 'teams', teamId, 'info', 'main');
    await updateDoc(ref, {
        settings: settings,
        updatedAt: serverTimestamp()
    });
}

// =====================
// 全データ一括読み込み（init用）
// =====================
export async function loadAllData(teamId) {
    const [players, lineups, templates, gameStats, settings] = await Promise.all([
        getPlayers(teamId),
        getLineups(teamId),
        getTemplates(teamId),
        getGameStats(teamId),
        getTeamSettings(teamId)
    ]);
    return { players, lineups, templates, gameStats, settings };
}

// =====================
// 全データ削除（confirmClearData用）
// =====================
export async function deleteAllData(teamId) {
    // players, lineups, gameStats の全ドキュメントを削除
    const collections = ['players', 'lineups', 'gameStats'];

    for (const col of collections) {
        const ref = collection(db, 'teams', teamId, col);
        const snapshot = await getDocs(ref);
        // バッチ削除（500件制限に注意、通常はこのアプリでは十分）
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
            batch.delete(d.ref);
        });
        if (snapshot.docs.length > 0) {
            await batch.commit();
        }
    }

    // 設定をリセット
    await updateTeamSettings(teamId, {
        teamName: '',
        defaultManager: '',
        defaultCoach: ''
    });
}
