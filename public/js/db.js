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

// =====================
// 出欠イベント (events)
// =====================

// イベント一覧を取得
export async function getEvents(teamId) {
    const ref = collection(db, 'teams', teamId, 'events');
    const q = query(ref, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// イベント一覧を取得（attendance向け最小API alias）
export async function listEvents(teamId) {
    return getEvents(teamId);
}

// イベントを追加
export async function addEvent(teamId, eventData) {
    const ref = collection(db, 'teams', teamId, 'events');
    const docRef = await addDoc(ref, {
        ...eventData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
}

// イベントを作成（attendance向け最小API alias）
export async function createEvent(teamId, eventData) {
    return addEvent(teamId, eventData);
}

// イベントを更新
export async function updateEvent(teamId, eventId, eventData) {
    const ref = doc(db, 'teams', teamId, 'events', eventId);
    await updateDoc(ref, {
        ...eventData,
        updatedAt: serverTimestamp()
    });
}

// MVP投票設定を更新
export async function updateVoteSettings(teamId, eventId, voteSettings) {
    return updateEvent(teamId, eventId, voteSettings);
}

// 出欠回答を保存（event配下attendances/{userId}）
export async function saveAttendance(teamId, eventId, userId, attendanceData) {
    const ref = doc(db, 'teams', teamId, 'events', eventId, 'attendances', userId);
    await setDoc(ref, {
        ...attendanceData,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

// 出欠回答を保存（attendance向け最小API alias）
export async function saveAttendanceResponse(teamId, eventId, userId, attendanceData) {
    return saveAttendance(teamId, eventId, userId, attendanceData);
}

// イベントの出欠回答一覧を取得
export async function getAttendancesByEvent(teamId, eventId) {
    const ref = collection(db, 'teams', teamId, 'events', eventId, 'attendances');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// 回答一覧を取得（attendance向け最小API alias）
export async function listAttendances(teamId, eventId) {
    return getAttendancesByEvent(teamId, eventId);
}

// MVP投票を保存（events/{eventId}/votes/{userId}）
export async function saveMvpVote(teamId, eventId, userId, voteData) {
    const ref = doc(db, 'teams', teamId, 'events', eventId, 'votes', userId);
    await setDoc(ref, {
        ...voteData,
        updatedAt: serverTimestamp()
    }, { merge: false });
}

// MVP投票一覧を取得
export async function getMvpVotesByEvent(teamId, eventId) {
    const ref = collection(db, 'teams', teamId, 'events', eventId, 'votes');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// チームメンバー一覧を取得
export async function getTeamMembers(teamId) {
    const ref = collection(db, 'teams', teamId, 'members');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// =====================
// 会計管理 (accounting)
// =====================

// 会計データ一覧を取得
export async function getAccountingEntries(teamId) {
    const ref = collection(db, 'teams', teamId, 'accounting');
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// 会計データを追加（収入/支出）
export async function addAccountingEntry(teamId, entryData) {
    const ref = collection(db, 'teams', teamId, 'accounting');
    const docRef = await addDoc(ref, {
        ...entryData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
}

// 月次会計データを取得（YYYY-MM）
export async function getMonthlyAccountingEntries(teamId, month) {
    const ref = collection(db, 'teams', teamId, 'accounting');
    const q = query(ref, where('month', '==', month));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// 会計データを削除
export async function deleteAccountingEntry(teamId, entryId) {
    const ref = doc(db, 'teams', teamId, 'accounting', entryId);
    await deleteDoc(ref);
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
// meta付き試合成績操作（楽観的ロック対応）
// =====================

/**
 * meta付きで試合成績を追加
 * @param {string} teamId
 * @param {Object} statData - 試合データ
 * @returns {Object} { id, version, updatedAt }
 */
export async function addGameStatWithMeta(teamId, statData) {
    const now = new Date().toISOString();
    const ref = collection(db, 'teams', teamId, 'gameStats');
    const docRef = await addDoc(ref, {
        ...statData,
        meta: { version: 1, updatedAt: now },
        createdAt: serverTimestamp()
    });
    return { id: docRef.id, version: 1, updatedAt: now };
}

/**
 * meta付きで試合成績を更新（versionをインクリメント）
 * @param {string} teamId
 * @param {string} statId - ドキュメントID
 * @param {Object} statData - 更新データ
 * @param {number} currentVersion - クライアント側の現在のバージョン
 * @returns {Object} { version, updatedAt }
 */
export async function updateGameStatWithMeta(teamId, statId, statData, currentVersion) {
    const now = new Date().toISOString();
    const newVersion = (currentVersion || 0) + 1;
    const ref = doc(db, 'teams', teamId, 'gameStats', statId);
    await updateDoc(ref, {
        ...statData,
        meta: { version: newVersion, updatedAt: now }
    });
    return { version: newVersion, updatedAt: now };
}

/**
 * 楽観的ロック: 競合を検出（version主体 + updatedAt補助）
 *
 * 判定順序:
 *   1. ドキュメント不存在 → conflict=false
 *   2. サーバーにmetaなし（旧データ）→ conflict=false
 *   3. クライアントにversion/updatedAtなし（旧データ初回更新）→ conflict=false
 *   4. version比較（主）: server > client → conflict=true
 *   5. versionが一致 → conflict=false
 *   6. versionがない場合のみ updatedAt比較（補助フォールバック）
 *
 * @param {string} teamId
 * @param {string} collectionName - 'gameStats' | 'lineups' 等
 * @param {string} docId - ドキュメントID
 * @param {Object} [clientMeta={}] - { version?: number, updatedAt?: string }
 * @returns {Object} { conflict: boolean, serverData?: Object }
 */
export async function checkConflict(teamId, collectionName, docId, clientMeta = {}) {
    const ref = doc(db, 'teams', teamId, collectionName, docId);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
        return { conflict: false };
    }

    const serverData = { id: snapshot.id, ...snapshot.data() };
    const serverMeta = serverData.meta;

    // サーバーにmeta情報がない場合（旧データ）→ 競合なし
    if (!serverMeta) {
        return { conflict: false };
    }

    // クライアントにmeta情報がない場合（旧データからの初回更新）→ 競合なし
    if (!clientMeta.version && !clientMeta.updatedAt) {
        return { conflict: false };
    }

    // version比較（主）: 両方にversionがあればversionで判定
    if (clientMeta.version !== undefined && serverMeta.version !== undefined) {
        if (serverMeta.version > clientMeta.version) {
            return { conflict: true, serverData };
        }
        // versionが一致 → 競合なし
        return { conflict: false };
    }

    // updatedAt比較（補助/フォールバック）: versionがない場合のみ
    if (clientMeta.updatedAt && serverMeta.updatedAt) {
        if (serverMeta.updatedAt > clientMeta.updatedAt) {
            return { conflict: true, serverData };
        }
    }

    return { conflict: false };
}

// =====================
// 全データ一括読み込み（init用）
// =====================
export async function loadAllData(teamId) {
    const [players, lineups, templates, gameStats, settings, events, teamMembers, accountingEntries] = await Promise.all([
        getPlayers(teamId),
        getLineups(teamId),
        getTemplates(teamId),
        getGameStats(teamId),
        getTeamSettings(teamId),
        getEvents(teamId),
        getTeamMembers(teamId),
        getAccountingEntries(teamId)
    ]);
    return { players, lineups, templates, gameStats, settings, events, teamMembers, accountingEntries };
}

// =====================
// 全データ削除（confirmClearData用）
// =====================
export async function deleteAllData(teamId) {
    // players, lineups, gameStats の全ドキュメントを削除
    const collections = ['players', 'lineups', 'gameStats', 'accounting'];

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

    // events と配下 attendances を削除
    const eventsRef = collection(db, 'teams', teamId, 'events');
    const eventSnapshot = await getDocs(eventsRef);
    for (const eventDoc of eventSnapshot.docs) {
        const attendanceRef = collection(db, 'teams', teamId, 'events', eventDoc.id, 'attendances');
        const attendanceSnapshot = await getDocs(attendanceRef);
        if (attendanceSnapshot.docs.length > 0) {
            const attendanceBatch = writeBatch(db);
            attendanceSnapshot.docs.forEach(d => attendanceBatch.delete(d.ref));
            await attendanceBatch.commit();
        }
        await deleteDoc(eventDoc.ref);
    }

    // 設定をリセット
    await updateTeamSettings(teamId, {
        teamName: '',
        defaultManager: '',
        defaultCoach: ''
    });
}
