// =====================
// アラート文言ユーティリティ
// =====================

export const FIRESTORE_WRITE_ERROR_MESSAGE = '保存に失敗しました。通信状況を確認して、もう一度お試しください。';

/**
 * Firestore書き込み失敗時の共通アラート
 * @param {string} context - コンソール出力用の文脈
 * @param {Error} error
 */
export function alertFirestoreWriteError(context, error) {
    console.error(`${context}:`, error);
    alert(FIRESTORE_WRITE_ERROR_MESSAGE);
}
