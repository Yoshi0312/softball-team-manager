// =====================
// ホームページ
// =====================
import { state } from '../state.js';

/** ホーム画面を更新（選手サマリ + 直近メンバー表） */
export function updateHomePage() {
    const activePlayers = state.players.filter(p => p.status === 'active');
    const summary = document.getElementById('home-player-summary');

    if (activePlayers.length > 0) {
        summary.innerHTML = `<p><strong>${activePlayers.length}</strong> 名の選手が登録されています</p>`;
    } else {
        summary.innerHTML = `<p class="text-muted">選手を登録してください</p>`;
    }

    const recentContainer = document.getElementById('home-recent-lineups');
    const recent = state.lineups.slice(-3).reverse();

    if (recent.length > 0) {
        recentContainer.innerHTML = recent.map(l => {
            const hasStats = state.gameStats.some(g => g.lineupId === l.id);
            const gameStat = state.gameStats.find(g => g.lineupId === l.id);
            const scoreText = gameStat ? `${gameStat.ourScore || 0}-${gameStat.opponentScore || 0}` : '';
            const scoreClass = gameStat ? (gameStat.ourScore > gameStat.opponentScore ? 'win' : (gameStat.ourScore < gameStat.opponentScore ? 'lose' : 'draw')) : '';

            return `
                <div class="card" style="padding: 12px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;" onclick="loadLineup('${l.id}')" style="cursor: pointer;">
                            <div style="font-weight: 500; margin-bottom: 4px;">${l.tournament}</div>
                            <div style="font-size: 13px; color: var(--gray);">${l.date} vs ${l.opponent || '未定'}</div>
                            ${scoreText ? `<div class="game-stat-score ${scoreClass}" style="font-size: 16px; margin-top: 4px;">${scoreText}</div>` : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-sm ${hasStats ? 'btn-secondary' : 'btn-primary'}" onclick="event.stopPropagation(); openGameStatFromLineup('${l.id}')">
                                ${hasStats ? '成績編集' : '成績入力'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        recentContainer.innerHTML = `<p class="text-muted">保存されたメンバー表はありません</p>`;
    }
}
