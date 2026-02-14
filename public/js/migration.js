// =====================
// LocalStorage → Firestore 移行ツール
// 旧アプリ（memberList.html）のデータをFirestoreに一括移行する
// =====================
import * as DB from './db.js';

const LS_KEY = 'softball_data';
const LS_MIGRATED_KEY = 'softball_data_migrated';

// LocalStorageにデータがあるか確認
export function hasLocalStorageData() {
    try {
        const data = localStorage.getItem(LS_KEY);
        if (!data) return false;
        const parsed = JSON.parse(data);
        // players か lineups か gameStats のいずれかにデータがあれば移行対象
        return (parsed.players && parsed.players.length > 0) ||
               (parsed.lineups && parsed.lineups.length > 0) ||
               (parsed.gameStats && parsed.gameStats.length > 0);
    } catch (e) {
        return false;
    }
}

// 移行済みかどうか確認
export function isMigrated() {
    return localStorage.getItem(LS_MIGRATED_KEY) === 'true';
}

// LocalStorageのデータ概要を取得（移行前の確認表示用）
export function getLocalStorageSummary() {
    try {
        const data = JSON.parse(localStorage.getItem(LS_KEY));
        if (!data) return null;
        return {
            players: (data.players || []).length,
            lineups: (data.lineups || []).length,
            templates: (data.templates || []).length,
            gameStats: (data.gameStats || []).length,
            settings: data.settings || null
        };
    } catch (e) {
        return null;
    }
}

// LocalStorage → Firestore 移行実行
export async function migrateLocalStorageToFirestore(teamId) {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { migrated: false, reason: 'no_data' };

    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        return { migrated: false, reason: 'parse_error', error: e.message };
    }

    const counts = { players: 0, lineups: 0, templates: 0, gameStats: 0 };

    try {
        // 1. 選手を移行
        if (data.players && data.players.length > 0) {
            for (const player of data.players) {
                const { id, createdAt, updatedAt, ...playerData } = player;
                await DB.addPlayer(teamId, playerData);
                counts.players++;
            }
        }

        // 2. メンバー表を移行（IDマッピングを保持）
        const lineupIdMap = {};
        if (data.lineups && data.lineups.length > 0) {
            for (const lineup of data.lineups) {
                const oldId = lineup.id;
                const { id, createdAt, updatedAt, ...lineupData } = lineup;
                lineupData.isTemplate = false;
                const newId = await DB.addLineup(teamId, lineupData);
                lineupIdMap[oldId] = newId;
                counts.lineups++;
            }
        }

        // 3. テンプレートを移行
        if (data.templates && data.templates.length > 0) {
            for (const tmpl of data.templates) {
                const oldId = tmpl.id;
                const { id, createdAt, updatedAt, ...tmplData } = tmpl;
                tmplData.isTemplate = true;
                const newId = await DB.addLineup(teamId, tmplData);
                lineupIdMap[oldId] = newId;
                counts.templates++;
            }
        }

        // 4. 試合成績を移行（lineupIdを新IDにマッピング）
        if (data.gameStats && data.gameStats.length > 0) {
            for (const stat of data.gameStats) {
                const { id, createdAt, ...statData } = stat;
                // lineupIdが旧IDの場合、新IDに変換
                if (statData.lineupId && lineupIdMap[statData.lineupId]) {
                    statData.lineupId = lineupIdMap[statData.lineupId];
                }
                await DB.addGameStat(teamId, statData);
                counts.gameStats++;
            }
        }

        // 5. 設定を移行
        if (data.settings) {
            await DB.updateTeamSettings(teamId, data.settings);
        }

        // 移行完了フラグをセット
        localStorage.setItem(LS_MIGRATED_KEY, 'true');

        console.log('LocalStorage → Firestore移行完了:', counts);
        return { migrated: true, counts };

    } catch (e) {
        console.error('移行エラー:', e);
        return { migrated: false, reason: 'write_error', error: e.message, counts };
    }
}
