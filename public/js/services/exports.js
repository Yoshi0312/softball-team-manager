// =====================
// データエクスポート/インポート
// =====================
import { state } from '../ui/state.js';
import * as DB from '../db.js';
import { showConfirm } from '../ui/modals/confirmModal.js';
import { alertFirestoreWriteError } from '../ui/alerts.js';

/**
 * loadData は app.js に定義されている。
 * 循環参照を避けるため、importData 内では window.loadData を使う。
 */

/** JSONエクスポート */
export function exportData() {
    const data = JSON.stringify({
        players: state.players,
        lineups: state.lineups,
        templates: state.templates,
        gameStats: state.gameStats,
        settings: state.settings,
        exportedAt: new Date().toISOString()
    }, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `softball_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/** JSONインポート */
export function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    showConfirm(
        'インポートを実行すると既存データは全て上書きされます。\n実行前に「データをエクスポート」でバックアップ取得を推奨します。\nこのまま続行しますか？',
        () => runImport(file)
    );

    event.target.value = '';
}

async function runImport(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // まず既存データを削除してからインポート
            await DB.deleteAllData(state.teamId);

            // 各コレクションにFirestore書き込み
            const importPromises = [];

            if (data.players) {
                for (const player of data.players) {
                    const { id, createdAt, updatedAt, ...playerData } = player;
                    importPromises.push(DB.addPlayer(state.teamId, playerData));
                }
            }
            if (data.lineups) {
                for (const lineup of data.lineups) {
                    const { id, createdAt, updatedAt, ...lineupData } = lineup;
                    lineupData.isTemplate = false;
                    importPromises.push(DB.addLineup(state.teamId, lineupData));
                }
            }
            if (data.templates) {
                for (const tmpl of data.templates) {
                    const { id, createdAt, updatedAt, ...tmplData } = tmpl;
                    tmplData.isTemplate = true;
                    importPromises.push(DB.addLineup(state.teamId, tmplData));
                }
            }
            if (data.gameStats) {
                for (const stat of data.gameStats) {
                    const { id, createdAt, ...statData } = stat;
                    importPromises.push(DB.addGameStat(state.teamId, statData));
                }
            }
            if (data.settings) {
                importPromises.push(DB.updateTeamSettings(state.teamId, data.settings));
            }

            await Promise.all(importPromises);

            // Firestoreから再読み込み（app.jsのloadDataを使用）
            await window.loadData();
            alert('データをインポートしました');
            window.showPage('home');
        } catch (err) {
            alertFirestoreWriteError('データインポートエラー', err);
        }
    };
    reader.readAsText(file);
}

/** 全データ削除 */
export function confirmClearData() {
    showConfirm('全てのデータを削除しますか？\nこの操作は取り消せません。\n実行前に「データをエクスポート」でバックアップ取得を推奨します。', async () => {
        try {
            await DB.deleteAllData(state.teamId);
            state.players = [];
            state.lineups = [];
            state.templates = [];
            state.gameStats = [];
            state.settings = { teamName: '', defaultManager: '', defaultCoach: '' };
            state.currentLineup = null;
            state.editingLineupId = null;
            alert('全てのデータを削除しました');
            window.showPage('home');
        } catch (e) {
            alertFirestoreWriteError('全データ削除エラー', e);
        }
    });
}
