// =====================
// 成績管理ページ
// =====================
import { state } from '../state.js';
import { GAME_TYPES, BATTING_RESULTS } from '../../constants.js';
import {
    filterGames,
    calculatePlayerStats as calcStats,
    calculateTeamSummary,
    getAvailableYears
} from '../../domain/game-stats.js';
import { resolveGameType, formatAvg, formatPercent } from '../../domain/game-utils.js';

/** 成績ページ全体を描画 */
export function renderStatsPage() {
    updateYearSelector();
    renderTeamSummary();
    renderGameStatsList();
    renderPlayerStats();
}

/** 年度プルダウンを更新 */
export function updateYearSelector() {
    const select = document.getElementById('stats-year');
    const years = getAvailableYears(state.gameStats);
    select.innerHTML = years.map(y =>
        `<option value="${y}" ${y === state.selectedYear ? 'selected' : ''}>${y}年</option>`
    ).join('');
}

/** 年度変更 */
export function changeStatsYear(year) {
    state.selectedYear = parseInt(year);
    renderTeamSummary();
    renderGameStatsList();
    renderPlayerStats();
}

/** 試合種別変更 */
export function changeStatsGameType(gameType) {
    state.selectedGameType = gameType;
    renderTeamSummary();
    renderGameStatsList();
    renderPlayerStats();
}

/** タブ切替 */
export function switchStatsTab(tab) {
    document.querySelectorAll('#page-stats .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('stats-games').style.display = tab === 'games' ? 'block' : 'none';
    document.getElementById('stats-players').style.display = tab === 'players' ? 'block' : 'none';
}

/** チームサマリを描画 */
export function renderTeamSummary() {
    const container = document.getElementById('team-summary-container');
    const summaries = calculateTeamSummary(state.gameStats, { year: state.selectedYear });

    container.innerHTML = `
        <div class="card" style="padding: 12px;">
            <h2 class="card-title" style="margin-bottom: 8px;">チーム成績サマリ（${state.selectedYear}年）</h2>
            <div style="overflow-x: auto;">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>種別</th><th>試合</th><th>勝</th><th>敗</th><th>分</th>
                            <th>得点</th><th>失点</th><th>差</th><th>勝率</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summaries.map(s => `
                            <tr>
                                <td>${s.label}</td><td>${s.count}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.draws}</td>
                                <td>${s.scored}</td><td>${s.conceded}</td><td>${s.diff >= 0 ? '+' : ''}${s.diff}</td>
                                <td>${s.winRate !== null ? s.winRate.toFixed(3) : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/** 試合一覧を描画 */
export function renderGameStatsList() {
    const container = document.getElementById('game-stats-list');
    const empty = document.getElementById('game-stats-empty');

    const filtered = filterGames(state.gameStats, {
        year: state.selectedYear,
        type: state.selectedGameType
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filtered.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    container.innerHTML = filtered.map(g => {
        const ourScore = g.ourScore || 0;
        const oppScore = g.opponentScore || 0;
        let scoreClass = 'draw';
        if (ourScore > oppScore) scoreClass = 'win';
        else if (ourScore < oppScore) scoreClass = 'lose';

        return `
            <div class="game-stat-item" onclick="openGameStatModal('${g.id}')">
                <div class="game-stat-score ${scoreClass}">${ourScore}-${oppScore}</div>
                <div class="game-stat-info">
                    <div class="game-stat-title">vs ${g.opponent || '未設定'}</div>
                    <div class="game-stat-meta">${g.date} ${g.tournament || ''} <span style="background:var(--gray-light);padding:1px 6px;border-radius:4px;font-size:11px;">${(GAME_TYPES[resolveGameType(g)] || {}).label || '練習試合'}</span></div>
                </div>
                <button class="icon-btn danger" onclick="event.stopPropagation(); deleteGameStatConfirm('${g.id}')" title="削除">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        `;
    }).join('');
}

/** 選手成績のソート基準を変更 */
export function changeStatsSortBy(sortBy) {
    state.statsSortBy = sortBy;
    renderPlayerStats();
}

/** 選手成績表を描画 */
export function renderPlayerStats() {
    const tbody = document.getElementById('player-stats-body');
    const detailBody = document.getElementById('player-detail-body');
    const activePlayers = state.players.filter(p => p.status === 'active');

    const sortKey = state.statsSortBy || 'woba';
    const playerStats = activePlayers.map(player => ({
        player,
        stats: calcStats(state.gameStats, player.id, { year: state.selectedYear, type: state.selectedGameType })
    })).filter(ps => ps.stats.games > 0)
      .sort((a, b) => b.stats[sortKey] - a.stats[sortKey]);

    if (playerStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-muted" style="padding: 20px;">データがありません</td></tr>';
        detailBody.innerHTML = '<tr><td colspan="12" class="text-muted" style="padding: 20px;">データがありません</td></tr>';
        return;
    }

    tbody.innerHTML = playerStats.map(ps => {
        const s = ps.stats;
        const p = ps.player;
        return `
            <tr onclick="showPlayerStatDetail('${p.id}')">
                <td>${p.name.split(' ')[0]}</td>
                <td>${s.games}</td>
                <td>${s.atBats}</td>
                <td>${s.hits}</td>
                <td class="highlight">${formatAvg(s.avg)}</td>
                <td>${formatAvg(s.obp)}</td>
                <td>${formatAvg(s.slg)}</td>
                <td>${formatAvg(s.ops)}</td>
                <td class="highlight woba-col">${formatAvg(s.woba)}</td>
            </tr>
        `;
    }).join('');

    detailBody.innerHTML = playerStats.map(ps => {
        const s = ps.stats;
        const p = ps.player;
        return `
            <tr onclick="showPlayerStatDetail('${p.id}')">
                <td>${p.name.split(' ')[0]}</td>
                <td>${s.doubles}</td>
                <td>${s.triples}</td>
                <td>${s.homeRuns}</td>
                <td>${s.rbi}</td>
                <td>${s.walks}</td>
                <td>${s.strikeouts}</td>
                <td>${s.sacrifices}</td>
                <td class="highlight">${formatAvg(s.iso)}</td>
                <td>${formatAvg(s.babip)}</td>
                <td>${formatPercent(s.kRate)}</td>
                <td>${formatPercent(s.bbRate)}</td>
            </tr>
        `;
    }).join('');
}
