// =====================
// アラート文言ユーティリティ
// =====================

export const FIRESTORE_WRITE_ERROR_MESSAGE = '保存に失敗しました。通信状況を確認して、もう一度お試しください。';
const FIRESTORE_WRITE_ERROR_CONTEXT = 'Firestore書き込みエラー';

/**
 * Firestore書き込み失敗時の共通アラート
 * @param {string} context - コンソール出力用の文脈
 * @param {Error} error
 */
export function alertFirestoreWriteError(context, error) {
    console.error(`${context}:`, error);
    alert(FIRESTORE_WRITE_ERROR_MESSAGE);
}

/**
 * 主要コレクション（players / lineup / gameStats / settings）向けの
 * Firestore書き込み失敗アラート。
 * @param {'players' | 'lineup' | 'gameStats' | 'settings'} collection
 * @param {Error} error
 */
export function alertStandardizedWriteError(collection, error) {
    alertFirestoreWriteError(`${FIRESTORE_WRITE_ERROR_CONTEXT} (${collection})`, error);
}
