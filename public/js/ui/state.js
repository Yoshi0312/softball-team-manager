// =====================
// アプリケーション状態の中央管理
// =====================

// メインstate（オブジェクト参照なので、どのモジュールからimportしてもプロパティ変更が共有される）
export const state = {
    teamId: null,
    players: [],
    lineups: [],
    templates: [],
    gameStats: [],
    events: [],
    teamMembers: [],
    settings: {
        teamName: '',
        defaultManager: '',
        defaultCoach: ''
    },
    currentLineup: null,
    editingLineupId: null,
    currentGameStat: null,
    selectedYear: new Date().getFullYear(),
    selectedGameType: 'all',
    statsSortBy: 'woba'
};

// 確認ダイアログのコールバック（ESMのexport letはimport側から再代入不可のためsetter関数を提供）
export let confirmCallback = null;
export function setConfirmCallback(cb) { confirmCallback = cb; }

// 控え選手枠数
export let reserveCount = 3;
export function setReserveCount(n) { reserveCount = n; }
export function incrementReserveCount() { reserveCount++; }
