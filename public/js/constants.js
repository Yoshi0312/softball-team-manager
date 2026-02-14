// =====================
// 定数定義
// =====================

// ポジション定義
export const POSITIONS = {
    1: { name: '投手', abbr: 'P' },
    2: { name: '捕手', abbr: 'C' },
    3: { name: '一塁手', abbr: '1B' },
    4: { name: '二塁手', abbr: '2B' },
    5: { name: '三塁手', abbr: '3B' },
    6: { name: '遊撃手', abbr: 'SS' },
    7: { name: '左翼手', abbr: 'LF' },
    8: { name: '中堅手', abbr: 'CF' },
    9: { name: '右翼手', abbr: 'RF' },
    10: { name: 'DP', abbr: 'DP' },
    11: { name: 'FLEX', abbr: 'FLEX' }
};

// 守備位置座標（SVG用）
export const FIELD_POSITIONS = {
    1: { x: 200, y: 250 },   // P
    2: { x: 200, y: 300 },   // C
    3: { x: 280, y: 240 },   // 1B
    4: { x: 240, y: 200 },   // 2B
    5: { x: 120, y: 240 },   // 3B
    6: { x: 160, y: 200 },   // SS
    7: { x: 60, y: 120 },    // LF
    8: { x: 200, y: 80 },    // CF
    9: { x: 340, y: 120 }    // RF
};

// 打撃結果の定義
export const BATTING_RESULTS = {
    'single': { label: '単打', abbr: '安', totalBases: 1, isHit: true, isAtBat: true },
    'double': { label: '二塁打', abbr: '2', totalBases: 2, isHit: true, isAtBat: true },
    'triple': { label: '三塁打', abbr: '3', totalBases: 3, isHit: true, isAtBat: true },
    'homerun': { label: '本塁打', abbr: 'HR', totalBases: 4, isHit: true, isAtBat: true },
    'out': { label: '凡打', abbr: '凡', totalBases: 0, isHit: false, isAtBat: true },
    'strikeout': { label: '三振', abbr: 'K', totalBases: 0, isHit: false, isAtBat: true },
    'walk': { label: '四球', abbr: '四', totalBases: 0, isHit: false, isAtBat: false },
    'hitByPitch': { label: '死球', abbr: '死', totalBases: 0, isHit: false, isAtBat: false },
    'sacrifice': { label: '犠打', abbr: '犠', totalBases: 0, isHit: false, isAtBat: false },
    'sacrificeFly': { label: '犠飛', abbr: '犠飛', totalBases: 0, isHit: false, isAtBat: false },
    'error': { label: '失策', abbr: 'E', totalBases: 0, isHit: false, isAtBat: true },
    'fieldersChoice': { label: '野選', abbr: 'FC', totalBases: 0, isHit: false, isAtBat: true }
};

// 試合種別の定義
export const GAME_TYPES = {
    'official': { label: '公式戦（一般）' },
    'official_senior': { label: '公式戦（壮年）' },
    'practice': { label: '練習試合' },
    'intrasquad': { label: '紅白戦' }
};

// デフォルトデータ（さわやかソフトボール 2025年区民大会登録名簿）
export const DEFAULT_DATA = {
    settings: {
        teamName: 'さわやかソフトボール',
        defaultManager: '岩佐 有吾',
        defaultCoach: '本木'
    },
    players: [
        { id: 'p001', name: '岩佐 有吾', number: 1, batting: 'right', throwing: 'right', mainPosition: 1, subPositions: [], grade: '', note: '監督', status: 'active' },
        { id: 'p002', name: '田中 幸治', number: 10, batting: 'right', throwing: 'right', mainPosition: 6, subPositions: [4, 5], grade: '', note: '', status: 'active' },
        { id: 'p003', name: '加藤 英世', number: 11, batting: 'right', throwing: 'right', mainPosition: 8, subPositions: [7, 9], grade: '', note: '', status: 'active' },
        { id: 'p004', name: '渡邉 一樹', number: 12, batting: 'right', throwing: 'right', mainPosition: 3, subPositions: [7], grade: '', note: '', status: 'active' },
        { id: 'p005', name: '矢口 稀久', number: 15, batting: 'right', throwing: 'right', mainPosition: 5, subPositions: [3, 7], grade: '', note: '', status: 'active' },
        { id: 'p006', name: '小森 慎也', number: 16, batting: 'right', throwing: 'right', mainPosition: 9, subPositions: [7, 8], grade: '', note: '', status: 'active' },
        { id: 'p007', name: '立花 康久', number: 17, batting: 'right', throwing: 'right', mainPosition: 4, subPositions: [6], grade: '', note: '', status: 'active' },
        { id: 'p008', name: '阿部 健聖', number: 18, batting: 'right', throwing: 'right', mainPosition: 2, subPositions: [3], grade: '18歳', note: '', status: 'active' },
        { id: 'p009', name: '諸角 雅明', number: 14, batting: 'right', throwing: 'right', mainPosition: 7, subPositions: [9, 8], grade: '', note: '', status: 'active' },
        { id: 'p010', name: '白井 誠', number: 19, batting: 'right', throwing: 'right', mainPosition: 1, subPositions: [7], grade: '', note: '', status: 'active' },
        { id: 'p011', name: '崎坂 隆', number: 32, batting: 'right', throwing: 'right', mainPosition: 8, subPositions: [7, 9], grade: '', note: '', status: 'active' },
        { id: 'p012', name: '船山 浩二', number: 4, batting: 'left', throwing: 'right', mainPosition: 3, subPositions: [7], grade: '', note: '', status: 'active' },
        { id: 'p013', name: '柘 志千智', number: 21, batting: 'right', throwing: 'right', mainPosition: 6, subPositions: [4, 5], grade: '', note: '', status: 'active' },
        { id: 'p014', name: '関川 智', number: 23, batting: 'right', throwing: 'right', mainPosition: 9, subPositions: [7, 8], grade: '', note: '', status: 'active' },
        { id: 'p015', name: '大江 信昭', number: 5, batting: 'right', throwing: 'right', mainPosition: 2, subPositions: [3], grade: '', note: '主将', status: 'active' },
        { id: 'p016', name: '林 昭宏', number: 7, batting: 'right', throwing: 'right', mainPosition: 4, subPositions: [6, 5], grade: '', note: '連絡責任者', status: 'active' }
    ]
};
