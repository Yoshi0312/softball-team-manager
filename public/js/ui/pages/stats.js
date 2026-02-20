// =====================
// 成績管理ページ
// =====================
import { state } from '../state.js';
import { GAME_TYPES, BATTING_RESULTS } from '../../constants.js';
import {
    filterGames,
    calculatePlayerStats as calcStats,
    calculateTeamSummary,
    getAvailableYears,
    aggregateMonthlySummary,
    buildGameTrendData
} from '../../domain/game-stats.js';
import { resolveGameType, formatAvg, formatPercent } from '../../domain/game-utils.js';

const MAX_COMPARE_PLAYERS = 3;

/** 成績ページ全体を描画 */
export function renderStatsPage() {
    updateYearSelector();
    renderTeamSummary();
    renderGameStatsList();
    renderPlayerStats();
}

function renderLineChartSvg(series, options = {}) {
    if (!series.length) return '<p class="text-muted" style="font-size:12px;">データがありません</p>';

    const width = options.width || 560;
    const height = options.height || 180;
    const pad = 24;
    const min = options.min ?? Math.min(...series.map(p => p.value));
    const maxRaw = options.max ?? Math.max(...series.map(p => p.value));
    const max = maxRaw === min ? min + 1 : maxRaw;
    const xStep = series.length > 1 ? (width - pad * 2) / (series.length - 1) : 0;

    const points = series.map((p, i) => {
        const x = pad + i * xStep;
        const yRatio = (p.value - min) / (max - min);
        const y = height - pad - yRatio * (height - pad * 2);
        return { ...p, x, y };
    });

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return `
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto;">
            <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="var(--gray-border)" stroke-width="1" />
            <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" stroke="var(--gray-border)" stroke-width="1" />
            <path d="${path}" fill="none" stroke="${options.color || 'var(--accent)'}" stroke-width="2.5" stroke-linecap="round" />
            ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${options.color || 'var(--accent)'}"><title>${p.label}: ${options.valueFormatter ? options.valueFormatter(p.value) : p.value}</title></circle>`).join('')}
            ${points.map((p, i) => i % Math.ceil(points.length / 6 || 1) === 0 || i === points.length - 1
                ? `<text x="${p.x}" y="${height - 8}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${p.label}</text>`
                : '').join('')}
        </svg>
    `;
}

function renderMonthlyBarChartSvg(series) {
    const width = 560;
    const height = 180;
    const pad = 24;
    const barW = (width - pad * 2) / series.length;
    const maxValue = Math.max(...series.map(v => v.value), 1);

    return `
        <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto;">
            <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="var(--gray-border)" stroke-width="1" />
            ${series.map((point, i) => {
                const h = (point.value / maxValue) * (height - pad * 2);
                const x = pad + i * barW + 2;
                const y = height - pad - h;
                return `<rect x="${x}" y="${y}" width="${Math.max(barW - 4, 2)}" height="${h}" fill="var(--accent-light)"><title>${point.label}: ${point.value}試合</title></rect>`;
            }).join('')}
            ${series.map((point, i) => i % 2 === 0
                ? `<text x="${pad + i * barW + barW / 2}" y="${height - 8}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${point.label}</text>`
                : '').join('')}
        </svg>
    `;
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
    const targetTab = ['games', 'players', 'dashboard'].includes(tab) ? tab : 'games';

    document.querySelectorAll('#page-stats [data-stats-tab]').forEach(t => {
        t.classList.toggle('active', t.dataset.statsTab === targetTab);
    });

    document.getElementById('stats-games').style.display = targetTab === 'games' ? 'block' : 'none';
    document.getElementById('stats-players').style.display = targetTab === 'players' ? 'block' : 'none';
    document.getElementById('stats-dashboard').style.display = targetTab === 'dashboard' ? 'block' : 'none';
}

/** チームサマリを描画 */
export function renderTeamSummary() {
    const container = document.getElementById('team-summary-container');
    const trendContainer = document.getElementById('dashboard-trend-chart-container');
    const runDiffContainer = document.getElementById('dashboard-run-diff-chart-container');
    const monthlyContainer = document.getElementById('dashboard-monthly-chart-container');
    const chartPanels = document.getElementById('dashboard-chart-panels');
    const emptyContainer = document.getElementById('dashboard-empty');
    const emptyTitle = document.getElementById('dashboard-empty-title');
    const emptyDescription = document.getElementById('dashboard-empty-description');
    const summaries = calculateTeamSummary(state.gameStats, { year: state.selectedYear });
    const trendData = buildGameTrendData(state.gameStats, {
        year: state.selectedYear,
        gameType: state.selectedGameType
    });
    const monthly = aggregateMonthlySummary(state.gameStats, {
        year: state.selectedYear,
        type: state.selectedGameType
    });

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

    const winRateSeries = trendData.series.monthlyWinRate;
    const diffSeries = trendData.series.monthlyRunDiff;
    const monthlySeries = monthly
        .filter(m => m.count > 0)
        .map(m => ({ label: m.label, value: m.count }));
    const filteredGames = filterGames(state.gameStats, {
        year: state.selectedYear,
        type: state.selectedGameType
    });

    if (!trendContainer || !runDiffContainer || !monthlyContainer) return;

    const selectedTypeLabel = state.selectedGameType === 'all'
        ? '全ての種別'
        : ((GAME_TYPES[state.selectedGameType] || {}).label || '選択種別');

    if (filteredGames.length === 0) {
        if (emptyContainer) emptyContainer.style.display = 'block';
        if (chartPanels) chartPanels.style.display = 'none';
        if (emptyTitle) {
            emptyTitle.textContent = '表示できる成績データがありません';
        }
        if (emptyDescription) {
            emptyDescription.textContent = `${state.selectedYear}年 / ${selectedTypeLabel} の条件では試合成績が0件です。年度・種別を変更するか、試合成績を入力してください。`;
        }
        trendContainer.innerHTML = '';
        runDiffContainer.innerHTML = '';
        monthlyContainer.innerHTML = '';
        return;
    }

    if (emptyContainer) emptyContainer.style.display = 'none';
    if (chartPanels) chartPanels.style.display = 'block';

    trendContainer.innerHTML = renderLineChartSvg(winRateSeries, {
        min: 0,
        max: 1,
        color: '#2f7ef7',
        valueFormatter: v => v.toFixed(3)
    });
    runDiffContainer.innerHTML = renderLineChartSvg(diffSeries, {
        color: '#19a974',
        valueFormatter: v => `${v >= 0 ? '+' : ''}${v}`
    });
    monthlyContainer.innerHTML = monthlySeries.length > 0
        ? renderMonthlyBarChartSvg(monthlySeries)
        : '<p class="text-muted" style="font-size:12px;">月別成績を表示するデータがありません。</p>';
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
        const compareContainer = document.getElementById('player-compare-container');
        if (compareContainer) compareContainer.innerHTML = '';
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

    renderPlayerComparison(playerStats);
}

function getSelectedComparePlayerIds(playerStats) {
    return (state.comparePlayerIds || [])
        .filter(id => playerStats.some(ps => ps.player.id === id))
        .slice(0, MAX_COMPARE_PLAYERS);
}

function renderPlayerComparison(playerStats) {
    const container = document.getElementById('player-compare-container');
    if (!container) return;

    const selectedIds = getSelectedComparePlayerIds(playerStats);
    state.comparePlayerIds = selectedIds;

    const compared = playerStats.filter(ps => selectedIds.includes(ps.player.id));
    const metricRows = [
        { label: 'OPS', formatter: s => formatAvg(s.ops) },
        { label: 'wOBA', formatter: s => formatAvg(s.woba) },
        { label: 'K%', formatter: s => formatPercent(s.kRate) },
        { label: 'BB%', formatter: s => formatPercent(s.bbRate) },
        { label: 'AVG', formatter: s => formatAvg(s.avg) }
    ];

    container.innerHTML = `
        <div class="card">
            <h2 class="card-title" style="margin-bottom: 8px;">選手比較（2〜3名）</h2>
            <p class="text-muted" style="font-size:12px; margin-bottom:8px;">比較したい選手を2〜3名選択してください。</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom: 10px;">
                ${playerStats.map(ps => {
                    const checked = selectedIds.includes(ps.player.id);
                    const disabled = !checked && selectedIds.length >= MAX_COMPARE_PLAYERS;
                    return `
                        <label style="display:flex; align-items:center; gap:4px; font-size:12px; opacity:${disabled ? 0.55 : 1};">
                            <input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="togglePlayerCompare('${ps.player.id}', this.checked)">
                            ${ps.player.name.split(' ')[0]}
                        </label>
                    `;
                }).join('')}
            </div>
            ${compared.length === 0
                ? '<p class="text-muted" style="font-size:12px;">候補: 打席数が多い選手や、同じ打順の選手を選ぶと違いが見えやすくなります。</p>'
                : compared.length === 1
                    ? '<p class="text-muted" style="font-size:12px;">比較するには、もう1名以上選択してください（2〜3名）。</p>'
                    : `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-bottom:10px;">
                        ${metricRows.map(metric => {
                            const values = compared.map(c => metric.formatter(c.stats));
                            return `<div style="padding:8px; border:1px solid var(--gray-border); border-radius:8px; background:var(--gray-light);">
                                <div style="font-size:11px; color:var(--text-muted);">${metric.label}</div>
                                <div style="font-weight:600; margin-top:2px;">${values.join(' / ')}</div>
                            </div>`;
                        }).join('')}
                    </div>
                    <div style="overflow-x:auto;"><table class="stats-table"><thead><tr><th>指標</th>${compared.map(c => `<th>${c.player.name.split(' ')[0]}</th>`).join('')}</tr></thead><tbody>
                        ${metricRows.map(metric => `<tr><td>${metric.label}</td>${compared.map(c => `<td>${metric.formatter(c.stats)}</td>`).join('')}</tr>`).join('')}
                    </tbody></table></div>`}
        </div>
    `;
}

export function togglePlayerCompare(playerId, checked) {
    state.comparePlayerIds = state.comparePlayerIds || [];
    if (checked) {
        if (!state.comparePlayerIds.includes(playerId) && state.comparePlayerIds.length < MAX_COMPARE_PLAYERS) {
            state.comparePlayerIds.push(playerId);
        }
    } else {
        state.comparePlayerIds = state.comparePlayerIds.filter(id => id !== playerId);
    }
    renderPlayerStats();
}
