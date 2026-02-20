// =====================
// 試合成績モーダル（入力/編集/保存/削除）
// イニングスコア・打撃入力・投手入力を含む
// =====================
import { state } from '../state.js';
import { BATTING_RESULTS, GAME_TYPES } from '../../constants.js';
import * as DB from '../../db.js';
import { generateId, resolveGameType } from '../../domain/game-utils.js';
import { showConfirm } from './confirmModal.js';
import { alertFirestoreWriteError } from '../alerts.js';
// 保存後の画面更新用（循環しない一方向import）
import { renderStatsPage } from '../pages/stats.js';
import { renderSavedList } from '../pages/saved.js';

// =====================
// メンバー表選択モーダル
// =====================
export function openLineupSelectModal() {
    const modal = document.getElementById('lineup-select-modal');
    const container = document.getElementById('lineup-select-list');
    const empty = document.getElementById('lineup-select-empty');

    if (state.lineups.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        const sorted = [...state.lineups].sort((a, b) => new Date(b.date) - new Date(a.date));

        container.innerHTML = sorted.map(l => {
            const hasStats = state.gameStats.some(g => g.lineupId === l.id);
            const statusText = hasStats ? '<span style="color: var(--success);">✓入力済</span>' : '<span style="color: var(--gray);">未入力</span>';

            return `
                <div class="saved-item" onclick="closeLineupSelectModal(); openGameStatFromLineup('${l.id}');">
                    <div class="saved-info">
                        <div class="saved-title">${l.tournament} ${statusText}</div>
                        <div class="saved-meta">${l.date} vs ${l.opponent || '未定'}</div>
                    </div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray)" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </div>
            `;
        }).join('');
    }

    modal.classList.add('active');
}

export function closeLineupSelectModal() {
    document.getElementById('lineup-select-modal').classList.remove('active');
}

// メンバー表から成績入力を開く
export function openGameStatFromLineup(lineupId) {
    const lineup = state.lineups.find(l => l.id === lineupId);
    if (!lineup) {
        alert('メンバー表が見つかりません');
        return;
    }

    // この試合の既存成績があるかチェック
    const existingStat = state.gameStats.find(g => g.lineupId === lineupId);

    if (existingStat) {
        openGameStatModal(existingStat.id, lineupId);
    } else {
        openGameStatModal(null, lineupId);
    }
}

// =====================
// 試合成績モーダル本体
// =====================
export function openGameStatModal(gameId = null, lineupId = null) {
    const modal = document.getElementById('game-stat-modal');
    const title = document.getElementById('game-stat-modal-title');
    const deleteBtn = document.getElementById('game-stat-delete-btn');

    // フォームリセット
    document.getElementById('game-stat-edit-id').value = '';
    document.getElementById('game-stat-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('game-stat-tournament').value = '';
    document.getElementById('game-stat-opponent').value = '';

    // 先攻後攻と試合種別をリセット
    document.getElementById('game-stat-batting-order').value = 'home';
    document.getElementById('game-stat-game-type').value = 'practice';

    // イニングスコアテーブルを描画
    renderInningScoreTable();

    state.currentGameStat = {
        id: generateId(),
        lineupId: lineupId,
        date: new Date().toISOString().split('T')[0],
        tournament: '',
        opponent: '',
        gameType: 'practice',
        ourScore: 0,
        opponentScore: 0,
        playerStats: {},
        battingOrder: 'home',
        ourInningScores: [],
        oppInningScores: [],
        pitcherStats: []
    };

    // メンバー表から情報を取得
    if (lineupId) {
        const lineup = state.lineups.find(l => l.id === lineupId);
        if (lineup) {
            state.currentGameStat.date = lineup.date;
            state.currentGameStat.tournament = lineup.tournament;
            state.currentGameStat.opponent = lineup.opponent;

            document.getElementById('game-stat-date').value = lineup.date;
            document.getElementById('game-stat-tournament').value = lineup.tournament || '';
            document.getElementById('game-stat-opponent').value = lineup.opponent || '';
        }
    }

    if (gameId) {
        const game = state.gameStats.find(g => g.id === gameId);
        if (game) {
            title.textContent = '成績編集';
            deleteBtn.style.display = 'inline-flex';

            document.getElementById('game-stat-edit-id').value = game.id;
            document.getElementById('game-stat-date').value = game.date;
            document.getElementById('game-stat-tournament').value = game.tournament || '';
            document.getElementById('game-stat-opponent').value = game.opponent || '';

            state.currentGameStat = JSON.parse(JSON.stringify(game));
        }
    } else {
        title.textContent = '成績入力';
        deleteBtn.style.display = 'none';
    }

    // 試合種別を設定
    const gameTypeSelect = document.getElementById('game-stat-game-type');
    if (gameTypeSelect) {
        gameTypeSelect.value = resolveGameType(state.currentGameStat);
    }

    // 先攻後攻を設定
    const battingOrderSelect = document.getElementById('game-stat-batting-order');
    if (battingOrderSelect) {
        battingOrderSelect.value = state.currentGameStat.battingOrder || 'home';
    }

    // イニングスコアテーブルを描画
    renderInningScoreTable();

    // イニングスコアを設定
    setInningScores('our', state.currentGameStat.ourInningScores || []);
    setInningScores('opp', state.currentGameStat.oppInningScores || []);

    // ピッチャー入力を初期化
    renderPitcherInputs();

    renderPlayerBattingInputs();
    modal.classList.add('active');
}

// =====================
// 先攻後攻
// =====================
export function updateBattingOrder(value) {
    if (state.currentGameStat) {
        state.currentGameStat.battingOrder = value;
    }
}

// =====================
// 選手打撃入力
// =====================
export function renderPlayerBattingInputs() {
    const container = document.getElementById('player-batting-inputs');
    let playersToShow = [];

    // メンバー表に紐づいている場合は出場選手のみ表示
    if (state.currentGameStat.lineupId) {
        const lineup = state.lineups.find(l => l.id === state.currentGameStat.lineupId);
        if (lineup) {
            const starterPlayers = [];
            (lineup.starters || []).forEach(s => {
                if (s && s.playerId) {
                    const player = state.players.find(p => p.id === s.playerId);
                    if (player) starterPlayers.push({ player, order: s.order, isStarter: true });
                }
            });
            const reserveIds = (lineup.reserves || []).filter(id => id);
            const reservePlayers = reserveIds
                .map(id => state.players.find(p => p.id === id))
                .filter(p => p)
                .map(p => ({ player: p, order: 99, isStarter: false }));

            playersToShow = [...starterPlayers, ...reservePlayers];
        }
    }

    // メンバー表がない場合は全選手
    if (playersToShow.length === 0) {
        playersToShow = state.players
            .filter(p => p.status === 'active')
            .sort((a, b) => a.number - b.number)
            .map(p => ({ player: p, order: p.number, isStarter: true }));
    }

    container.innerHTML = playersToShow.map(({ player, order, isStarter }) => {
        const stats = state.currentGameStat.playerStats[player.id] || { atBats: [] };
        const atBats = stats.atBats || [];
        const rbi = stats.rbi || 0;
        const runs = stats.runs || 0;
        const stolenBases = stats.stolenBases || 0;
        const label = isStarter ? `${order}番` : '控';

        return `
            <div class="batting-input-row">
                <div class="batting-player-name">
                    <span class="order-label">${label}</span>
                    ${player.number}. ${player.name}
                </div>
                <div class="at-bat-container">
                    <div class="at-bat-grid">
                        ${[0, 1, 2, 3, 4].map(i => `
                            <div class="at-bat-cell">
                                <span class="at-bat-label">${i + 1}打席</span>
                                <select class="at-bat-select" onchange="updateAtBat('${player.id}', ${i}, this.value)">
                                    <option value="">-</option>
                                    ${Object.entries(BATTING_RESULTS).map(([key, val]) =>
                                        `<option value="${key}" ${atBats[i] === key ? 'selected' : ''}>${val.label}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        `).join('')}
                    </div>
                    <div class="stats-row">
                        <div class="stat-group">
                            <span class="at-bat-label">打点</span>
                            <input type="number" class="batting-rbi-input" min="0" max="10" value="${rbi}"
                                onchange="updatePlayerStat('${player.id}', 'rbi', this.value)" placeholder="0">
                        </div>
                        <div class="stat-group">
                            <span class="at-bat-label">得点</span>
                            <input type="number" class="batting-rbi-input" min="0" max="10" value="${runs}"
                                onchange="updatePlayerStat('${player.id}', 'runs', this.value)" placeholder="0">
                        </div>
                        <div class="stat-group">
                            <span class="at-bat-label">盗塁</span>
                            <input type="number" class="batting-rbi-input" min="0" max="10" value="${stolenBases}"
                                onchange="updatePlayerStat('${player.id}', 'stolenBases', this.value)" placeholder="0">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

export function updateAtBat(playerId, atBatIndex, result) {
    if (!state.currentGameStat.playerStats[playerId]) {
        state.currentGameStat.playerStats[playerId] = { atBats: [], rbi: 0 };
    }
    if (!state.currentGameStat.playerStats[playerId].atBats) {
        state.currentGameStat.playerStats[playerId].atBats = [];
    }
    state.currentGameStat.playerStats[playerId].atBats[atBatIndex] = result || null;
}

export function updateRbi(playerId, rbi) {
    updatePlayerStat(playerId, 'rbi', rbi);
}

export function updatePlayerStat(playerId, statName, value) {
    if (!state.currentGameStat.playerStats[playerId]) {
        state.currentGameStat.playerStats[playerId] = { atBats: [], rbi: 0, runs: 0, stolenBases: 0 };
    }
    state.currentGameStat.playerStats[playerId][statName] = parseInt(value) || 0;
}

// =====================
// イニングスコア
// =====================
export function calcTotalScore(team) {
    let total = 0;
    for (let i = 1; i <= 7; i++) {
        const input = document.getElementById(`${team}-inning-${i}`);
        if (input && input.value) {
            total += parseInt(input.value) || 0;
        }
    }
    document.getElementById(`${team}-total-score`).textContent = total;

    // state更新
    if (state.currentGameStat) {
        if (team === 'our') {
            state.currentGameStat.ourScore = total;
        } else {
            state.currentGameStat.opponentScore = total;
        }
    }
}

export function getInningScores(team) {
    const scores = [];
    for (let i = 1; i <= 7; i++) {
        const input = document.getElementById(`${team}-inning-${i}`);
        scores.push(input && input.value ? parseInt(input.value) : null);
    }
    return scores;
}

export function setInningScores(team, scores) {
    if (!scores) return;
    for (let i = 1; i <= 7; i++) {
        const input = document.getElementById(`${team}-inning-${i}`);
        if (input && scores[i - 1] !== null && scores[i - 1] !== undefined) {
            input.value = scores[i - 1];
        }
    }
    calcTotalScore(team);
}

export function renderInningScoreTable() {
    const tbody = document.getElementById('inning-score-tbody');
    if (!tbody) return;

    // 現在の入力値を保持
    const ourScores = [];
    const oppScores = [];
    for (let i = 1; i <= 7; i++) {
        const ourInput = document.getElementById(`our-inning-${i}`);
        const oppInput = document.getElementById(`opp-inning-${i}`);
        ourScores.push(ourInput ? ourInput.value : '');
        oppScores.push(oppInput ? oppInput.value : '');
    }
    const ourTotal = document.getElementById('our-total-score')?.textContent || '0';
    const oppTotal = document.getElementById('opp-total-score')?.textContent || '0';

    const battingOrder = document.getElementById('game-stat-batting-order')?.value || 'home';
    const isAway = battingOrder === 'away';

    const createRow = (team, label, scores, total) => `
        <tr>
            <td style="padding: 4px; border: 1px solid var(--border); font-weight: 500;">${label}</td>
            ${[1,2,3,4,5,6,7].map(i => `
                <td style="padding: 2px; border: 1px solid var(--border);">
                    <input type="number" class="inning-input" id="${team}-inning-${i}" min="0" max="99" onchange="calcTotalScore('${team}')" value="${scores[i-1] || ''}">
                </td>
            `).join('')}
            <td style="padding: 4px; border: 1px solid var(--border); font-weight: 600; text-align: center;" id="${team}-total-score">${total}</td>
        </tr>
    `;

    // 先攻なら自チームが上、後攻なら相手が上
    if (isAway) {
        tbody.innerHTML = createRow('our', '自チーム', ourScores, ourTotal) + createRow('opp', '相手', oppScores, oppTotal);
    } else {
        tbody.innerHTML = createRow('opp', '相手', oppScores, oppTotal) + createRow('our', '自チーム', ourScores, ourTotal);
    }
}

// =====================
// 投手入力
// =====================
export function renderPitcherInputs() {
    const container = document.getElementById('pitcher-stats-inputs');
    const pitchers = state.currentGameStat.pitcherStats || [];
    const activePlayers = state.players.filter(p => p.status === 'active').sort((a, b) => a.number - b.number);

    if (pitchers.length === 0) {
        state.currentGameStat.pitcherStats = [{ playerId: '', innings: '', hits: '', runs: '', earnedRuns: '', strikeouts: '', walks: '' }];
    }

    container.innerHTML = (state.currentGameStat.pitcherStats || []).map((pitcher, idx) => `
        <div class="pitcher-entry" data-idx="${idx}">
            <select onchange="updatePitcherStat(${idx}, 'playerId', this.value)">
                <option value="">投手を選択</option>
                ${activePlayers.map(p =>
                    `<option value="${p.id}" ${pitcher.playerId === p.id ? 'selected' : ''}>${p.number}. ${p.name}</option>`
                ).join('')}
            </select>
            <div class="pitcher-stat-group">
                <span class="pitcher-stat-label">回</span>
                <input type="text" class="pitcher-stat-input" value="${pitcher.innings || ''}"
                    onchange="updatePitcherStat(${idx}, 'innings', this.value)" placeholder="0">
            </div>
            <div class="pitcher-stat-group">
                <span class="pitcher-stat-label">被安</span>
                <input type="number" class="pitcher-stat-input" min="0" value="${pitcher.hits || ''}"
                    onchange="updatePitcherStat(${idx}, 'hits', this.value)" placeholder="0">
            </div>
            <div class="pitcher-stat-group">
                <span class="pitcher-stat-label">失点</span>
                <input type="number" class="pitcher-stat-input" min="0" value="${pitcher.runs || ''}"
                    onchange="updatePitcherStat(${idx}, 'runs', this.value)" placeholder="0">
            </div>
            <div class="pitcher-stat-group">
                <span class="pitcher-stat-label">自責</span>
                <input type="number" class="pitcher-stat-input" min="0" value="${pitcher.earnedRuns || ''}"
                    onchange="updatePitcherStat(${idx}, 'earnedRuns', this.value)" placeholder="0">
            </div>
            <div class="pitcher-stat-group">
                <span class="pitcher-stat-label">奪三</span>
                <input type="number" class="pitcher-stat-input" min="0" value="${pitcher.strikeouts || ''}"
                    onchange="updatePitcherStat(${idx}, 'strikeouts', this.value)" placeholder="0">
            </div>
            <div class="pitcher-stat-group">
                <span class="pitcher-stat-label">四球</span>
                <input type="number" class="pitcher-stat-input" min="0" value="${pitcher.walks || ''}"
                    onchange="updatePitcherStat(${idx}, 'walks', this.value)" placeholder="0">
            </div>
            ${idx > 0 ? `<button class="icon-btn danger" onclick="removePitcherEntry(${idx})" title="削除" style="width: 28px; height: 28px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>` : ''}
        </div>
    `).join('');
}

export function updatePitcherStat(idx, field, value) {
    if (!state.currentGameStat.pitcherStats) {
        state.currentGameStat.pitcherStats = [];
    }
    if (!state.currentGameStat.pitcherStats[idx]) {
        state.currentGameStat.pitcherStats[idx] = {};
    }
    state.currentGameStat.pitcherStats[idx][field] = value;
}

export function addPitcherEntry() {
    if (!state.currentGameStat.pitcherStats) {
        state.currentGameStat.pitcherStats = [];
    }
    state.currentGameStat.pitcherStats.push({ playerId: '', innings: '', hits: '', runs: '', earnedRuns: '', strikeouts: '', walks: '' });
    renderPitcherInputs();
}

export function removePitcherEntry(idx) {
    state.currentGameStat.pitcherStats.splice(idx, 1);
    renderPitcherInputs();
}

// =====================
// モーダル閉じる
// =====================
export function closeGameStatModal() {
    document.getElementById('game-stat-modal').classList.remove('active');
    state.currentGameStat = null;
}

// =====================
// 保存
// =====================
export async function saveGameStat() {
    const date = document.getElementById('game-stat-date').value;
    if (!date) {
        alert('試合日を入力してください');
        return;
    }

    state.currentGameStat.date = date;
    state.currentGameStat.tournament = document.getElementById('game-stat-tournament').value.trim();
    state.currentGameStat.opponent = document.getElementById('game-stat-opponent').value.trim();

    // イニングスコアから合計を取得
    state.currentGameStat.ourInningScores = getInningScores('our');
    state.currentGameStat.oppInningScores = getInningScores('opp');

    // 合計スコアを計算
    const ourTotal = state.currentGameStat.ourInningScores.reduce((sum, s) => sum + (s || 0), 0);
    const oppTotal = state.currentGameStat.oppInningScores.reduce((sum, s) => sum + (s || 0), 0);
    state.currentGameStat.ourScore = ourTotal;
    state.currentGameStat.opponentScore = oppTotal;

    // 試合種別を保存
    const gameTypeSelectEl = document.getElementById('game-stat-game-type');
    state.currentGameStat.gameType = gameTypeSelectEl ? gameTypeSelectEl.value : 'practice';

    // 先攻後攻を保存
    const battingOrderSelect = document.getElementById('game-stat-batting-order');
    state.currentGameStat.battingOrder = battingOrderSelect ? battingOrderSelect.value : 'home';

    const editId = document.getElementById('game-stat-edit-id').value;

    try {
        if (editId) {
            // 競合チェック（楽観的ロック: version主体）
            const clientMeta = state.currentGameStat.meta;
            if (clientMeta?.version || clientMeta?.updatedAt) {
                const { conflict, serverData } = await DB.checkConflict(
                    state.teamId, 'gameStats', editId, {
                        version: clientMeta.version,
                        updatedAt: clientMeta.updatedAt
                    }
                );
                if (conflict) {
                    const overwrite = confirm(
                        '他のユーザーがこのデータを更新しています。\n' +
                        '上書きしますか？（キャンセルで最新データを再読込）'
                    );
                    if (!overwrite) {
                        // サーバーデータで上書き
                        const idx = state.gameStats.findIndex(g => g.id === editId);
                        if (idx >= 0 && serverData) {
                            state.gameStats[idx] = serverData;
                        }
                        closeGameStatModal();
                        renderStatsPage();
                        renderSavedList();
                        return;
                    }
                }
            }

            // Firestore更新（meta付き）
            const { id, createdAt, meta, ...statData } = state.currentGameStat;
            statData.type = state.currentGameStat.gameType;  // 正式フィールドとして付与
            const currentVersion = meta?.version || 0;
            const result = await DB.updateGameStatWithMeta(state.teamId, editId, statData, currentVersion);
            const idx = state.gameStats.findIndex(g => g.id === editId);
            if (idx >= 0) {
                state.gameStats[idx] = {
                    ...state.currentGameStat,
                    id: editId,
                    meta: { version: result.version, updatedAt: result.updatedAt }
                };
            }
        } else {
            // Firestore新規作成（meta付き）
            const { id, createdAt, meta, ...statData } = state.currentGameStat;
            statData.type = state.currentGameStat.gameType;  // 正式フィールドとして付与
            const result = await DB.addGameStatWithMeta(state.teamId, statData);
            state.currentGameStat.id = result.id;
            state.currentGameStat.meta = { version: result.version, updatedAt: result.updatedAt };
            state.gameStats.push({
                ...state.currentGameStat,
                id: result.id,
                meta: { version: result.version, updatedAt: result.updatedAt }
            });
        }

        closeGameStatModal();
        renderStatsPage();
        renderSavedList();
    } catch (e) {
        alertFirestoreWriteError('試合成績保存エラー', e);
    }
}

// =====================
// 削除
// =====================
export function deleteGameStatConfirm(gameId) {
    showConfirm('この試合の成績を削除しますか？', async () => {
        try {
            await DB.deleteGameStatDoc(state.teamId, gameId);
            state.gameStats = state.gameStats.filter(g => g.id !== gameId);
            renderStatsPage();
            renderSavedList();
        } catch (e) {
            alertFirestoreWriteError('試合成績削除エラー', e);
        }
    });
}

export function deleteGameStat() {
    const id = document.getElementById('game-stat-edit-id').value;
    if (!id) return;

    showConfirm('この試合の成績を削除しますか？', async () => {
        try {
            await DB.deleteGameStatDoc(state.teamId, id);
            state.gameStats = state.gameStats.filter(g => g.id !== id);
            closeGameStatModal();
            renderStatsPage();
        } catch (e) {
            alertFirestoreWriteError('試合成績削除エラー', e);
        }
    });
}
