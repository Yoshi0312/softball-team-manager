// =====================
// 設定管理
// =====================
import { state } from '../ui/state.js';
import * as DB from '../db.js';

/** 設定フォームを読み込み */
export function loadSettings() {
    document.getElementById('settings-team-name').value = state.settings.teamName || '';
    document.getElementById('settings-manager').value = state.settings.defaultManager || '';
    document.getElementById('settings-coach').value = state.settings.defaultCoach || '';
}

/** 設定をFirestoreに保存 */
export async function saveSettings() {
    state.settings.teamName = document.getElementById('settings-team-name').value.trim();
    state.settings.defaultManager = document.getElementById('settings-manager').value.trim();
    state.settings.defaultCoach = document.getElementById('settings-coach').value.trim();

    try {
        await DB.updateTeamSettings(state.teamId, state.settings);
        alert('設定を保存しました');
    } catch (e) {
        console.error('設定保存エラー:', e);
        alert('設定の保存に失敗しました: ' + e.message);
    }
}

/** 互換用スタブ（Firestore移行後は不要） */
export function saveData() {
    console.warn('saveData()はFirestore移行により無効化されています');
}
