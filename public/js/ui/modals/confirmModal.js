// =====================
// 確認モーダル
// =====================
import { confirmCallback, setConfirmCallback } from '../state.js';

/**
 * 確認ダイアログを表示
 * @param {string} message - 表示メッセージ
 * @param {Function} callback - 確認時のコールバック
 */
export function showConfirm(message, callback) {
    document.getElementById('confirm-message').textContent = message;
    setConfirmCallback(callback);
    document.getElementById('confirm-modal').classList.add('active');
}

/** 確認モーダルを閉じる */
export function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
    setConfirmCallback(null);
}

/** 確認アクションを実行 */
export function confirmAction() {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
}
