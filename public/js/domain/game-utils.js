// =====================
// 純粋ユーティリティ関数
// DOM操作なし、state参照なし、引数のみで完結
// =====================

/**
 * 試合の種別を取得（未設定なら'practice'を返す）
 * @param {Object} game - 試合データ
 * @returns {string} 'official' | 'official_senior' | 'practice' | 'intrasquad'
 */
export function getGameType(game) {
    return game.gameType || 'practice';
}

/**
 * 打率/OPS等を .000 形式でフォーマット
 * @param {number} value
 * @returns {string}
 */
export function formatAvg(value) {
    if (value === 0) return '.000';
    if (value >= 1) return value.toFixed(3);
    return value.toFixed(3).substring(1);
}

/**
 * パーセント表示フォーマッタ（K%, BB%用）
 * @param {number} value - 0.25 のような数値
 * @returns {string} '25.0%' 形式
 */
export function formatPercent(value) {
    return (value * 100).toFixed(1) + '%';
}

/**
 * 打席区分のCSSクラスを返す
 * @param {string} batting - 'right' | 'left' | 'switch'
 * @returns {string} CSSクラス名
 */
export function getBattingClass(batting) {
    return { right: 'badge-right', left: 'badge-left', switch: 'badge-switch' }[batting] || '';
}

/**
 * 打席区分のラベルを返す
 * @param {string} batting - 'right' | 'left' | 'switch'
 * @returns {string} '右打' | '左打' | '両打'
 */
export function getBattingLabel(batting) {
    return { right: '右打', left: '左打', switch: '両打' }[batting] || '';
}

/**
 * ポジション適性を判定
 * @param {Object|null} player - 選手データ（mainPosition, subPositions含む）
 * @param {number|string|null} position - ポジション番号
 * @returns {string} '◎' | '○' | '△' | ''
 */
export function getPositionFit(player, position) {
    if (!player || !position) return '';
    position = parseInt(position);
    if (player.mainPosition === position) return '◎';
    if (player.subPositions && player.subPositions.includes(position)) return '○';
    if (position >= 1 && position <= 9) return '△';
    return '';
}

/**
 * ユニークIDを生成
 * @returns {string} タイムスタンプベースのID
 */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
