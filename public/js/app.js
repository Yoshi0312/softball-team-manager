// =====================
// エントリファイル
// 全モジュールの import + window 公開 + init
// =====================
import * as DB from './db.js';

// domain層（純粋関数）
import {
    getGameType, resolveGameType, formatAvg, formatPercent,
    getBattingClass, getBattingLabel, getPositionFit, generateId
} from './domain/game-utils.js';
import {
    filterGames,
    calculatePlayerStats,
    calculateTeamSummary,
    getAvailableYears,
    aggregateGamesByPeriod,
    aggregateMonthlySummary
} from './domain/game-stats.js';

// state管理
import { state } from './ui/state.js';

// router（DOM切替のみ）
import { showPage as showPageRaw, openSettings } from './app/router.js';

// pages
import { updateHomePage } from './ui/pages/home.js';
import {
    renderAttendancePage, selectAttendanceEvent, saveMyAttendance, editAttendanceEvent,
    resetAttendanceEventForm, saveAttendanceEvent
} from './ui/pages/attendance.js';
import { renderPlayerList, openPlayerModal, closePlayerModal, savePlayer, deletePlayer } from './ui/pages/players.js';
import {
    startNewLineup, renderLineupForm, renderLineupTable,
    updateStarterPosition, updateStarterPlayer, toggleDPRows,
    renderReserves, updateReserve, addReserveSlot,
    saveLineup, saveAsTemplate, loadLineup, deleteLineup,
    previewLineup, renderPreview, renderFieldDiagram,
    switchPreviewTab, downloadAsImage
} from './ui/pages/lineup.js';
import { renderSavedList, renderSavedLineups, renderSavedTemplates, switchSavedTab } from './ui/pages/saved.js';
import {
    renderStatsPage, updateYearSelector, changeStatsYear, changeStatsGameType,
    switchStatsTab, renderTeamSummary, renderGameStatsList, renderPlayerStats, changeStatsSortBy, togglePlayerCompare
} from './ui/pages/stats.js';

// modals
import {
    openLineupSelectModal, closeLineupSelectModal,
    openGameStatFromLineup, openGameStatModal,
    updateBattingOrder, renderPlayerBattingInputs,
    updateAtBat, updateRbi, updatePlayerStat,
    calcTotalScore, getInningScores, setInningScores, renderInningScoreTable,
    renderPitcherInputs, updatePitcherStat, addPitcherEntry, removePitcherEntry,
    closeGameStatModal, saveGameStat, deleteGameStatConfirm, deleteGameStat
} from './ui/modals/gameStatModal.js';
import { showPlayerStatDetail, closePlayerStatModal } from './ui/modals/playerStatModal.js';
import { showConfirm, closeConfirmModal, confirmAction } from './ui/modals/confirmModal.js';

// services
import {
    loadSettings, saveSettings, saveData,
    loadInviteManagement, createInviteLinkFromAdmin, copyInviteLink, reissueInviteFromAdmin, invalidateInviteFromAdmin
} from './services/settings.js';
import { exportData, importData, confirmClearData } from './services/exports.js';

// =====================
// showPage ラッパー（DOM切替 + レンダリング）
// =====================
function showPageWithRender(pageId) {
    showPageRaw(pageId);

    // ページに合わせてコンテンツ更新
    if (pageId === 'home') updateHomePage();
    if (pageId === 'players') renderPlayerList();
    if (pageId === 'attendance') renderAttendancePage();
    if (pageId === 'stats') renderStatsPage();
    if (pageId === 'saved') renderSavedList();
    if (pageId === 'settings') loadSettings();
}

// =====================
// Firestoreデータ読み込み
// =====================
export async function loadData() {
    try {
        const data = await DB.loadAllData(state.teamId);
        state.players = data.players || [];
        state.lineups = data.lineups || [];
        state.templates = data.templates || [];
        state.gameStats = data.gameStats || [];
        state.events = data.events || [];
        state.teamMembers = data.teamMembers || [];
        state.settings = data.settings || state.settings;
        console.log('Firestoreからデータ読み込み完了:', {
            players: state.players.length,
            lineups: state.lineups.length,
            templates: state.templates.length,
            gameStats: state.gameStats.length,
            events: state.events.length,
            teamMembers: state.teamMembers.length
        });
    } catch (e) {
        console.error('Firestoreデータ読み込みエラー:', e);
        alert('データの読み込みに失敗しました');
    }
}

// =====================
// 初期化
// =====================
export async function init(teamId) {
    state.teamId = teamId;
    await loadData();
    updateHomePage();
    startNewLineup();
}

// =====================
// window 公開（互換API維持）
// showPage は showPageWithRender をエイリアスとして公開
// =====================
export {
    // router
    showPageWithRender as showPage,
    openSettings,
    // home
    updateHomePage,
    renderAttendancePage, selectAttendanceEvent, saveMyAttendance, editAttendanceEvent,
    resetAttendanceEventForm, saveAttendanceEvent,
    // players
    renderPlayerList, openPlayerModal, closePlayerModal, savePlayer, deletePlayer,
    // lineup
    startNewLineup, renderLineupForm, renderLineupTable,
    updateStarterPosition, updateStarterPlayer, toggleDPRows,
    renderReserves, updateReserve, addReserveSlot,
    saveLineup, saveAsTemplate, loadLineup, deleteLineup,
    previewLineup, renderPreview, renderFieldDiagram,
    switchPreviewTab, downloadAsImage,
    // saved
    renderSavedList, renderSavedLineups, renderSavedTemplates, switchSavedTab,
    // stats
    renderStatsPage, updateYearSelector, changeStatsYear, changeStatsGameType,
    switchStatsTab, renderTeamSummary, renderGameStatsList, renderPlayerStats, changeStatsSortBy, togglePlayerCompare,
    // gameStatModal
    openLineupSelectModal, closeLineupSelectModal,
    openGameStatFromLineup, openGameStatModal,
    updateBattingOrder, renderPlayerBattingInputs,
    updateAtBat, updateRbi, updatePlayerStat,
    calcTotalScore, getInningScores, setInningScores, renderInningScoreTable,
    renderPitcherInputs, updatePitcherStat, addPitcherEntry, removePitcherEntry,
    closeGameStatModal, saveGameStat, deleteGameStatConfirm, deleteGameStat,
    // playerStatModal
    showPlayerStatDetail, closePlayerStatModal,
    // confirmModal
    showConfirm, closeConfirmModal, confirmAction,
    // exports
    exportData, importData, confirmClearData,
    // settings
    loadSettings, saveSettings, saveData,
    loadInviteManagement, createInviteLinkFromAdmin, copyInviteLink, reissueInviteFromAdmin, invalidateInviteFromAdmin,
    // domain再export
    state,
    getGameType, resolveGameType, formatAvg, formatPercent,
    getBattingClass, getBattingLabel, getPositionFit, generateId,
    filterGames, getAvailableYears, calculateTeamSummary, calculatePlayerStats,
    aggregateGamesByPeriod, aggregateMonthlySummary
};
