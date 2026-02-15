// =====================
// 選手成績詳細モーダル
// =====================
import { state } from '../state.js';
import { GAME_TYPES } from '../../constants.js';
import { calculatePlayerStats as calcStats } from '../../domain/game-stats.js';
import { formatAvg, formatPercent } from '../../domain/game-utils.js';

/**
 * 選手成績詳細を表示
 * @param {string} playerId - 選手ID
 */
export function showPlayerStatDetail(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    const stats = calcStats(state.gameStats, playerId, { year: state.selectedYear, type: state.selectedGameType });
    const modal = document.getElementById('player-stat-modal');
    const title = document.getElementById('player-stat-modal-title');
    const body = document.getElementById('player-stat-modal-body');

    const typeLabel = state.selectedGameType !== 'all' ? ` (${GAME_TYPES[state.selectedGameType].label})` : '';
    title.textContent = `${player.name} - ${state.selectedYear}年成績${typeLabel}`;

    body.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
            <div class="card" style="margin: 0;">
                <div style="font-size: 12px; color: var(--gray);">打率</div>
                <div style="font-size: 24px; font-weight: 600;">${formatAvg(stats.avg)}</div>
            </div>
            <div class="card" style="margin: 0;">
                <div style="font-size: 12px; color: var(--gray);">OPS</div>
                <div style="font-size: 24px; font-weight: 600;">${formatAvg(stats.ops)}</div>
            </div>
            <div class="card" style="margin: 0; background: #e3f2fd;">
                <div style="font-size: 12px; color: var(--gray);">wOBA</div>
                <div style="font-size: 24px; font-weight: 600; color: #1a73e8;">${formatAvg(stats.woba)}</div>
            </div>
        </div>

        <table class="stats-table mt-4">
            <tr><th>項目</th><th>数値</th></tr>
            <tr><td>試合数</td><td>${stats.games}</td></tr>
            <tr><td>打席数</td><td>${stats.pa}</td></tr>
            <tr><td>打数</td><td>${stats.atBats}</td></tr>
            <tr><td>安打</td><td>${stats.hits}</td></tr>
            <tr><td>二塁打</td><td>${stats.doubles}</td></tr>
            <tr><td>三塁打</td><td>${stats.triples}</td></tr>
            <tr><td>本塁打</td><td>${stats.homeRuns}</td></tr>
            <tr><td>打点</td><td>${stats.rbi}</td></tr>
            <tr><td>四球</td><td>${stats.walks}</td></tr>
            <tr><td>死球</td><td>${stats.hitByPitch}</td></tr>
            <tr><td>三振</td><td>${stats.strikeouts}</td></tr>
            <tr><td>犠打</td><td>${stats.sacrifices}</td></tr>
            <tr><td>犠飛</td><td>${stats.sacrificeFlies}</td></tr>
            <tr><td>塁打</td><td>${stats.totalBases}</td></tr>
            <tr><td>打率</td><td>${formatAvg(stats.avg)}</td></tr>
            <tr><td>出塁率</td><td>${formatAvg(stats.obp)}</td></tr>
            <tr><td>長打率</td><td>${formatAvg(stats.slg)}</td></tr>
            <tr><td>OPS</td><td>${formatAvg(stats.ops)}</td></tr>
            <tr style="background: #e3f2fd; font-weight: 600;"><td>wOBA</td><td>${formatAvg(stats.woba)}</td></tr>
            <tr><td>ISO</td><td>${formatAvg(stats.iso)}</td></tr>
            <tr><td>BABIP</td><td>${formatAvg(stats.babip)}</td></tr>
            <tr><td>K%</td><td>${formatPercent(stats.kRate)}</td></tr>
            <tr><td>BB%</td><td>${formatPercent(stats.bbRate)}</td></tr>
        </table>
    `;

    modal.classList.add('active');
}

/** 選手成績モーダルを閉じる */
export function closePlayerStatModal() {
    document.getElementById('player-stat-modal').classList.remove('active');
}
