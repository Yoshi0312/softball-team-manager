// =====================
// メインアプリケーションロジック
// domain層: 純粋関数（計算・フィルタ）
// ui/state: 状態管理
// db.js: Firestoreアクセス
// =====================
import { POSITIONS, FIELD_POSITIONS, BATTING_RESULTS, GAME_TYPES, DEFAULT_DATA, WOBA_WEIGHTS } from './constants.js';
import * as DB from './db.js';

// domain層からimport（純粋関数）
import {
    getGameType, formatAvg, formatPercent,
    getBattingClass, getBattingLabel, getPositionFit, generateId
} from './domain/game-utils.js';
import {
    filterGames,
    calculatePlayerStats as calcStats,
    calculateTeamSummary,
    getAvailableYears
} from './domain/game-stats.js';

// state管理からimport
import {
    state, confirmCallback, setConfirmCallback,
    reserveCount, setReserveCount, incrementReserveCount
} from './ui/state.js';

// domain/ui関数を再export（index.htmlのObject.assign互換維持）
export { state };
export { getGameType, formatAvg, formatPercent, getBattingClass, getBattingLabel, getPositionFit, generateId };
export { filterGames, getAvailableYears, calculateTeamSummary };
export { calcStats as calculatePlayerStats };

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
        state.settings = data.settings || state.settings;
        console.log('Firestoreからデータ読み込み完了:', {
            players: state.players.length,
            lineups: state.lineups.length,
            templates: state.templates.length,
            gameStats: state.gameStats.length
        });
    } catch (e) {
        console.error('Firestoreデータ読み込みエラー:', e);
        alert('データの読み込みに失敗しました');
    }
}

// saveData()は個別のFirestore操作に置き換えるため、互換用のスタブとして残す
// ※ フェーズ4移行完了後に削除予定
export function saveData() {
    console.warn('saveData()はFirestore移行により無効化されています');
}

// =====================
// Navigation
// =====================
export function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(`page-${pageId}`).classList.add('active');

    const navIndex = { home: 0, players: 1, lineup: 2, stats: 3, saved: 4, preview: 4, settings: -1 };
    if (navIndex[pageId] >= 0) {
        document.querySelectorAll('.nav-item')[navIndex[pageId]].classList.add('active');
    }

    const titles = {
        home: 'ホーム',
        players: '選手管理',
        lineup: 'メンバー表作成',
        preview: 'プレビュー',
        stats: '成績管理',
        saved: '保存済み',
        settings: '設定'
    };
    document.getElementById('page-title').textContent = titles[pageId] || '';

    // ページに合わせてコンテンツ更新
    if (pageId === 'home') updateHomePage();
    if (pageId === 'players') renderPlayerList();
    if (pageId === 'stats') renderStatsPage();
    if (pageId === 'saved') renderSavedList();
    if (pageId === 'settings') loadSettings();
}

export function openSettings() {
    showPage('settings');
}

// =====================
// Home Page
// =====================
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

// =====================
// Player Management
// =====================
export function renderPlayerList() {
    const list = document.getElementById('player-list');
    const empty = document.getElementById('player-empty');
    const sortBy = document.getElementById('player-sort').value;

    let players = state.players.filter(p => p.status === 'active');

    // ソート
    players.sort((a, b) => {
        if (sortBy === 'number') return a.number - b.number;
        if (sortBy === 'name') return a.name.localeCompare(b.name, 'ja');
        if (sortBy === 'position') return a.mainPosition - b.mainPosition;
        return 0;
    });

    if (players.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = players.map(p => `
        <li class="player-item" onclick="openPlayerModal('${p.id}')">
            <div class="player-number">${p.number}</div>
            <div class="player-info">
                <div class="player-name">${p.name}</div>
                <div class="player-meta">
                    <span class="player-badge ${getBattingClass(p.batting)}">${getBattingLabel(p.batting)}</span>
                    <span>${p.throwing === 'right' ? '右投' : '左投'}</span>
                    ${p.grade ? `<span>${p.grade}</span>` : ''}
                </div>
            </div>
            <div class="position-badges">
                <span class="pos-badge pos-main">${POSITIONS[p.mainPosition]?.abbr || ''}</span>
                ${p.subPositions?.slice(0, 2).map(sp =>
                    `<span class="pos-badge pos-sub">${POSITIONS[sp]?.abbr || ''}</span>`
                ).join('') || ''}
            </div>
        </li>
    `).join('');
}

// getBattingClass, getBattingLabel → domain/game-utils.js に移動済み

export function openPlayerModal(playerId = null) {
    const modal = document.getElementById('player-modal');
    const title = document.getElementById('player-modal-title');
    const deleteBtn = document.getElementById('player-delete-btn');

    // フォームリセット
    document.getElementById('player-edit-id').value = '';
    document.getElementById('player-name').value = '';
    document.getElementById('player-number').value = '';
    document.getElementById('player-batting').value = 'right';
    document.getElementById('player-throwing').value = 'right';
    document.getElementById('player-main-position').value = '';
    document.getElementById('player-grade').value = '';
    document.getElementById('player-note').value = '';
    document.getElementById('player-status').value = 'active';
    document.querySelectorAll('#player-sub-positions input').forEach(cb => cb.checked = false);

    if (playerId) {
        const player = state.players.find(p => p.id === playerId);
        if (player) {
            title.textContent = '選手編集';
            deleteBtn.style.display = 'inline-flex';

            document.getElementById('player-edit-id').value = player.id;
            document.getElementById('player-name').value = player.name;
            document.getElementById('player-number').value = player.number;
            document.getElementById('player-batting').value = player.batting;
            document.getElementById('player-throwing').value = player.throwing;
            document.getElementById('player-main-position').value = player.mainPosition;
            document.getElementById('player-grade').value = player.grade || '';
            document.getElementById('player-note').value = player.note || '';
            document.getElementById('player-status').value = player.status;

            player.subPositions?.forEach(pos => {
                const cb = document.querySelector(`#player-sub-positions input[value="${pos}"]`);
                if (cb) cb.checked = true;
            });
        }
    } else {
        title.textContent = '選手登録';
        deleteBtn.style.display = 'none';
    }

    modal.classList.add('active');
}

export function closePlayerModal() {
    document.getElementById('player-modal').classList.remove('active');
}

export async function savePlayer() {
    const id = document.getElementById('player-edit-id').value;
    const name = document.getElementById('player-name').value.trim();
    const number = parseInt(document.getElementById('player-number').value);
    const batting = document.getElementById('player-batting').value;
    const throwing = document.getElementById('player-throwing').value;
    const mainPosition = parseInt(document.getElementById('player-main-position').value);
    const grade = document.getElementById('player-grade').value.trim();
    const note = document.getElementById('player-note').value.trim();
    const status = document.getElementById('player-status').value;

    const subPositions = [];
    document.querySelectorAll('#player-sub-positions input:checked').forEach(cb => {
        subPositions.push(parseInt(cb.value));
    });

    // バリデーション
    if (!name || isNaN(number) || !mainPosition) {
        alert('必須項目を入力してください');
        return;
    }

    const playerData = { name, number, batting, throwing, mainPosition, subPositions, grade, note, status };

    try {
        if (id) {
            // Firestore更新
            await DB.updatePlayer(state.teamId, id, playerData);
            const idx = state.players.findIndex(p => p.id === id);
            if (idx >= 0) {
                state.players[idx] = { ...state.players[idx], ...playerData, updatedAt: new Date().toISOString() };
            }
        } else {
            // Firestore新規作成
            const newId = await DB.addPlayer(state.teamId, playerData);
            state.players.push({ id: newId, ...playerData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
        closePlayerModal();
        renderPlayerList();
    } catch (e) {
        console.error('選手保存エラー:', e);
        alert('保存に失敗しました: ' + e.message);
    }
}

export function deletePlayer() {
    const id = document.getElementById('player-edit-id').value;
    if (!id) return;

    showConfirm('選手を削除しますか？', async () => {
        try {
            await DB.deletePlayerDoc(state.teamId, id);
            state.players = state.players.filter(p => p.id !== id);
            closePlayerModal();
            renderPlayerList();
        } catch (e) {
            console.error('選手削除エラー:', e);
            alert('削除に失敗しました: ' + e.message);
        }
    });
}

// =====================
// Lineup Management
// =====================
export function startNewLineup() {
    state.editingLineupId = null;
    state.currentLineup = {
        id: generateId(),
        tournament: '',
        date: new Date().toISOString().split('T')[0],
        teamName: state.settings.teamName || '',
        opponent: '',
        useDP: false,
        starters: Array(9).fill(null).map((_, i) => ({
            order: i + 1,
            position: null,
            playerId: null
        })),
        reserves: [],
        staff: {
            manager: state.settings.defaultManager || '',
            coaches: state.settings.defaultCoach || '',
            scorer: ''
        }
    };

    renderLineupForm();
}

export function renderLineupForm() {
    const lineup = state.currentLineup;
    if (!lineup) return;

    document.getElementById('lineup-tournament').value = lineup.tournament;
    document.getElementById('lineup-date').value = lineup.date;
    document.getElementById('lineup-team').value = lineup.teamName;
    document.getElementById('lineup-opponent').value = lineup.opponent;
    document.getElementById('lineup-use-dp').checked = lineup.useDP;
    document.getElementById('lineup-manager').value = lineup.staff?.manager || '';
    document.getElementById('lineup-coach').value = lineup.staff?.coaches || '';
    document.getElementById('lineup-scorer').value = lineup.staff?.scorer || '';

    renderLineupTable();
    renderReserves();
}

export function renderLineupTable() {
    const tbody = document.getElementById('lineup-starters');
    const useDP = document.getElementById('lineup-use-dp').checked;
    const rows = useDP ? 10 : 9;
    const activePlayers = state.players.filter(p => p.status === 'active').sort((a, b) => a.number - b.number);

    let html = '';
    for (let i = 0; i < rows; i++) {
        const starter = state.currentLineup?.starters[i] || { order: i + 1, position: null, playerId: null };
        const player = activePlayers.find(p => p.id === starter.playerId);
        const rowClass = player ? (player.batting === 'left' ? 'lineup-row left-batter' : (player.batting === 'switch' ? 'lineup-row switch-batter' : 'lineup-row')) : 'lineup-row';

        const positionFit = getPositionFit(player, starter.position);

        // 打順10は「守備」と表示
        const orderDisplay = (i + 1) === 10 ? '守備' : (i + 1);
        html += `
            <tr class="${rowClass}" data-order="${i}">
                <td class="order">${orderDisplay}</td>
                <td class="position">
                    <select onchange="updateStarterPosition(${i}, this.value)">
                        <option value="">-</option>
                        ${Object.entries(POSITIONS).slice(0, useDP ? 11 : 9).map(([val, pos]) =>
                            `<option value="${val}" ${starter.position == val ? 'selected' : ''}>${pos.abbr}</option>`
                        ).join('')}
                    </select>
                </td>
                <td class="player-select">
                    <select onchange="updateStarterPlayer(${i}, this.value)">
                        <option value="">選手を選択</option>
                        ${activePlayers.map(p =>
                            `<option value="${p.id}" ${starter.playerId === p.id ? 'selected' : ''}>${p.number}. ${p.name}</option>`
                        ).join('')}
                    </select>
                    ${positionFit ? `<span class="pos-fit">${positionFit}</span>` : ''}
                </td>
                <td class="number">${player?.number || '-'}</td>
                <td class="batting">${player ? getBattingLabel(player.batting).charAt(0) : '-'}</td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

// getPositionFit → domain/game-utils.js に移動済み

export function updateStarterPosition(order, position) {
    if (state.currentLineup) {
        if (!state.currentLineup.starters[order]) {
            state.currentLineup.starters[order] = { order: order + 1, position: null, playerId: null };
        }
        state.currentLineup.starters[order].position = position ? parseInt(position) : null;
        renderLineupTable();
    }
}

export function updateStarterPlayer(order, playerId) {
    if (state.currentLineup) {
        if (!state.currentLineup.starters[order]) {
            state.currentLineup.starters[order] = { order: order + 1, position: null, playerId: null };
        }
        state.currentLineup.starters[order].playerId = playerId || null;
        renderLineupTable();
    }
}

export function toggleDPRows() {
    renderLineupTable();
}

export function renderReserves() {
    const container = document.getElementById('lineup-reserves');
    const activePlayers = state.players.filter(p => p.status === 'active').sort((a, b) => a.number - b.number);
    const reserves = state.currentLineup?.reserves || [];

    let html = '';
    const count = Math.max(reserves.length, reserveCount);

    for (let i = 0; i < count; i++) {
        const playerId = reserves[i] || '';
        const player = activePlayers.find(p => p.id === playerId);

        html += `
            <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                <select class="form-control" style="flex: 1;" onchange="updateReserve(${i}, this.value)">
                    <option value="">控え選手 ${i + 1}</option>
                    ${activePlayers.map(p =>
                        `<option value="${p.id}" ${playerId === p.id ? 'selected' : ''}>${p.number}. ${p.name}</option>`
                    ).join('')}
                </select>
                ${player ? `<span style="font-size: 12px; color: var(--gray);">${POSITIONS[player.mainPosition]?.abbr || ''}</span>` : ''}
            </div>
        `;
    }
    container.innerHTML = html;
}

export function updateReserve(index, playerId) {
    if (state.currentLineup) {
        if (!state.currentLineup.reserves) state.currentLineup.reserves = [];
        state.currentLineup.reserves[index] = playerId || null;
    }
}

export function addReserveSlot() {
    incrementReserveCount();
    renderReserves();
}

export async function saveLineup(isTemplate = false) {
    // フォームからデータ取得
    const tournament = document.getElementById('lineup-tournament').value.trim();
    const date = document.getElementById('lineup-date').value;

    if (!tournament || !date) {
        alert('大会名と試合日は必須です');
        return;
    }

    state.currentLineup.tournament = tournament;
    state.currentLineup.date = date;
    state.currentLineup.teamName = document.getElementById('lineup-team').value.trim();
    state.currentLineup.opponent = document.getElementById('lineup-opponent').value.trim();
    state.currentLineup.useDP = document.getElementById('lineup-use-dp').checked;
    state.currentLineup.staff = {
        manager: document.getElementById('lineup-manager').value.trim(),
        coaches: document.getElementById('lineup-coach').value.trim(),
        scorer: document.getElementById('lineup-scorer').value.trim()
    };
    state.currentLineup.isTemplate = isTemplate;

    try {
        if (isTemplate) {
            const name = prompt('テンプレート名を入力してください:', `${tournament}オーダー`);
            if (!name) return;
            state.currentLineup.name = name;
            // Firestoreに保存（idはFirestoreが自動生成）
            const { id, createdAt, updatedAt, ...lineupData } = state.currentLineup;
            const newId = await DB.addLineup(state.teamId, lineupData);
            state.templates.push({ ...state.currentLineup, id: newId });
        } else {
            state.currentLineup.name = `${date}_${tournament}_vs${state.currentLineup.opponent || '未定'}`;

            if (state.editingLineupId) {
                // Firestore更新
                const { id, createdAt, updatedAt, ...lineupData } = state.currentLineup;
                await DB.updateLineup(state.teamId, state.editingLineupId, lineupData);
                const idx = state.lineups.findIndex(l => l.id === state.editingLineupId);
                if (idx >= 0) {
                    state.lineups[idx] = { ...state.currentLineup, id: state.editingLineupId };
                }
            } else {
                // Firestore新規作成
                const { id, createdAt, updatedAt, ...lineupData } = state.currentLineup;
                const newId = await DB.addLineup(state.teamId, lineupData);
                state.currentLineup.id = newId;
                state.lineups.push({ ...state.currentLineup });
            }
        }

        alert(isTemplate ? 'テンプレートを保存しました' : 'メンバー表を保存しました');
    } catch (e) {
        console.error('メンバー表保存エラー:', e);
        alert('保存に失敗しました: ' + e.message);
    }
}

export function saveAsTemplate() {
    saveLineup(true);
}

export function loadLineup(lineupId, isTemplate = false) {
    const source = isTemplate ? state.templates : state.lineups;
    const lineup = source.find(l => l.id === lineupId);

    if (!lineup) return;

    state.editingLineupId = isTemplate ? null : lineupId;
    state.currentLineup = JSON.parse(JSON.stringify(lineup));

    if (isTemplate) {
        state.currentLineup.id = generateId();
        state.currentLineup.date = new Date().toISOString().split('T')[0];
    }

    showPage('lineup');
    renderLineupForm();
}

export function deleteLineup(lineupId, isTemplate = false) {
    showConfirm(isTemplate ? 'テンプレートを削除しますか？' : 'メンバー表を削除しますか？', async () => {
        try {
            await DB.deleteLineupDoc(state.teamId, lineupId);
            if (isTemplate) {
                state.templates = state.templates.filter(t => t.id !== lineupId);
            } else {
                state.lineups = state.lineups.filter(l => l.id !== lineupId);
            }
            renderSavedList();
        } catch (e) {
            console.error('メンバー表削除エラー:', e);
            alert('削除に失敗しました: ' + e.message);
        }
    });
}

// =====================
// Preview
// =====================
export function previewLineup() {
    // フォームから現在のデータを更新
    state.currentLineup.tournament = document.getElementById('lineup-tournament').value.trim();
    state.currentLineup.date = document.getElementById('lineup-date').value;
    state.currentLineup.teamName = document.getElementById('lineup-team').value.trim();
    state.currentLineup.opponent = document.getElementById('lineup-opponent').value.trim();
    state.currentLineup.staff = {
        manager: document.getElementById('lineup-manager').value.trim(),
        coaches: document.getElementById('lineup-coach').value.trim(),
        scorer: document.getElementById('lineup-scorer').value.trim()
    };

    showPage('preview');
    renderPreview();
}

export function renderPreview() {
    const lineup = state.currentLineup;
    if (!lineup) return;

    document.getElementById('preview-tournament').textContent = lineup.tournament || '大会名未設定';
    document.getElementById('preview-date').textContent = lineup.date || '';
    document.getElementById('preview-team').textContent = lineup.teamName || 'チーム名';
    document.getElementById('preview-opponent').textContent = lineup.opponent || '未定';
    document.getElementById('preview-manager').textContent = lineup.staff?.manager || '-';
    document.getElementById('preview-coach').textContent = lineup.staff?.coaches || '-';

    // スターター表
    const tbody = document.getElementById('preview-lineup-body');
    tbody.innerHTML = lineup.starters.filter(s => s?.playerId).map(s => {
        const player = state.players.find(p => p.id === s.playerId);
        const rowClass = player?.batting === 'left' ? 'left-batter' : (player?.batting === 'switch' ? 'switch-batter' : '');
        const orderDisplay = s.order === 10 ? '守備' : s.order;
        const posDisplay = s.position === 10 ? 'DP' : (s.position === 11 ? 'EP' : (s.position || '-'));
        return `
            <tr class="${rowClass}">
                <td>${orderDisplay}</td>
                <td>${posDisplay}</td>
                <td style="text-align: left;">${player?.name || '-'}</td>
                <td>${player?.number || '-'}</td>
            </tr>
        `;
    }).join('');

    // 控え選手
    const reservesDiv = document.getElementById('preview-reserves');
    const reserves = (lineup.reserves || []).filter(id => id).map(id => state.players.find(p => p.id === id)).filter(p => p);
    reservesDiv.innerHTML = reserves.length > 0
        ? reserves.map(p => `<span style="margin-right: 12px;">${p.name}(${p.number})</span>`).join('')
        : '<span class="text-muted">なし</span>';

    // 守備位置図
    renderFieldDiagram();
}

export function renderFieldDiagram() {
    const lineup = state.currentLineup;
    if (!lineup) return;

    const playersGroup = document.getElementById('field-players');
    playersGroup.innerHTML = '';

    lineup.starters.filter(s => s?.playerId && s?.position && s.position <= 9).forEach(s => {
        const player = state.players.find(p => p.id === s.playerId);
        const pos = FIELD_POSITIONS[s.position];
        if (!player || !pos) return;

        const battingColor = player.batting === 'left' ? '#f57f17' : (player.batting === 'switch' ? '#2e7d32' : '#1a73e8');

        playersGroup.innerHTML += `
            <g transform="translate(${pos.x}, ${pos.y})">
                <circle r="18" fill="${battingColor}" class="field-player-circle"/>
                <text y="5" class="field-player-text">${player.number}</text>
                <text y="32" class="field-player-name">${player.name.split(' ')[0]}</text>
            </g>
        `;
    });
}

export function switchPreviewTab(tab) {
    document.querySelectorAll('#page-preview .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('preview-table').style.display = tab === 'table' ? 'block' : 'none';
    document.getElementById('preview-field').style.display = tab === 'field' ? 'block' : 'none';
}

export function downloadAsImage() {
    alert('画像保存機能は次のバージョンで実装予定です。\nスクリーンショットをお使いください。');
}

// =====================
// Saved List
// =====================
export function renderSavedList() {
    renderSavedLineups();
    renderSavedTemplates();
}

export function renderSavedLineups() {
    const container = document.getElementById('saved-lineups-list');
    const empty = document.getElementById('saved-lineups-empty');

    if (state.lineups.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    const sorted = [...state.lineups].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sorted.map(l => {
        const hasStats = state.gameStats.some(g => g.lineupId === l.id);
        const statsIcon = hasStats
            ? '<span style="color: var(--success); font-size: 12px; margin-left: 4px;">✓成績入力済</span>'
            : '';

        return `
            <div class="saved-item">
                <div class="saved-info" onclick="loadLineup('${l.id}')">
                    <div class="saved-title">${l.tournament}${statsIcon}</div>
                    <div class="saved-meta">${l.date} vs ${l.opponent || '未定'}</div>
                </div>
                <div class="saved-actions">
                    <button class="icon-btn" onclick="event.stopPropagation(); openGameStatFromLineup('${l.id}')" title="成績入力" style="${hasStats ? 'background: #e8f5e9;' : ''}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="20" x2="18" y2="10"/>
                            <line x1="12" y1="20" x2="12" y2="4"/>
                            <line x1="6" y1="20" x2="6" y2="14"/>
                        </svg>
                    </button>
                    <button class="icon-btn" onclick="event.stopPropagation(); loadLineup('${l.id}')" title="編集">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="icon-btn danger" onclick="event.stopPropagation(); deleteLineup('${l.id}')" title="削除">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

export function renderSavedTemplates() {
    const container = document.getElementById('saved-templates-list');
    const empty = document.getElementById('saved-templates-empty');

    if (state.templates.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    container.innerHTML = state.templates.map(t => `
        <div class="saved-item">
            <div class="saved-info" onclick="loadLineup('${t.id}', true)">
                <div class="saved-title">${t.name || t.tournament}</div>
                <div class="saved-meta">テンプレート</div>
            </div>
            <div class="saved-actions">
                <button class="icon-btn" onclick="loadLineup('${t.id}', true)" title="使用">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                </button>
                <button class="icon-btn danger" onclick="deleteLineup('${t.id}', true)" title="削除">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

export function switchSavedTab(tab) {
    document.querySelectorAll('#page-saved .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('saved-lineups').style.display = tab === 'lineups' ? 'block' : 'none';
    document.getElementById('saved-templates').style.display = tab === 'templates' ? 'block' : 'none';
}

// =====================
// Settings
// =====================
export function loadSettings() {
    document.getElementById('settings-team-name').value = state.settings.teamName || '';
    document.getElementById('settings-manager').value = state.settings.defaultManager || '';
    document.getElementById('settings-coach').value = state.settings.defaultCoach || '';
}

export async function saveSettings() {
    state.settings.teamName = document.getElementById('settings-team-name').value.trim();
    state.settings.defaultManager = document.getElementById('settings-manager').value.trim();
    state.settings.defaultCoach = document.getElementById('settings-coach').value.trim();

    try {
        await DB.updateTeamSettings(state.teamId, state.settings);
        alert('設定を保存しました');
    } catch (e) {
        console.error('設定保存エラー:', e);
        alert('設定の保存に失敗しました: ' + e.message);
    }
}

export function exportData() {
    const data = JSON.stringify({
        players: state.players,
        lineups: state.lineups,
        templates: state.templates,
        gameStats: state.gameStats,
        settings: state.settings,
        exportedAt: new Date().toISOString()
    }, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `softball_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // まず既存データを削除してからインポート
            await DB.deleteAllData(state.teamId);

            // 各コレクションにFirestore書き込み
            const importPromises = [];

            if (data.players) {
                for (const player of data.players) {
                    const { id, createdAt, updatedAt, ...playerData } = player;
                    importPromises.push(DB.addPlayer(state.teamId, playerData));
                }
            }
            if (data.lineups) {
                for (const lineup of data.lineups) {
                    const { id, createdAt, updatedAt, ...lineupData } = lineup;
                    lineupData.isTemplate = false;
                    importPromises.push(DB.addLineup(state.teamId, lineupData));
                }
            }
            if (data.templates) {
                for (const tmpl of data.templates) {
                    const { id, createdAt, updatedAt, ...tmplData } = tmpl;
                    tmplData.isTemplate = true;
                    importPromises.push(DB.addLineup(state.teamId, tmplData));
                }
            }
            if (data.gameStats) {
                for (const stat of data.gameStats) {
                    const { id, createdAt, ...statData } = stat;
                    importPromises.push(DB.addGameStat(state.teamId, statData));
                }
            }
            if (data.settings) {
                importPromises.push(DB.updateTeamSettings(state.teamId, data.settings));
            }

            await Promise.all(importPromises);

            // Firestoreから再読み込み
            await loadData();
            alert('データをインポートしました');
            showPage('home');
        } catch (err) {
            console.error('インポートエラー:', err);
            alert('ファイルの読み込みに失敗しました: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

export function confirmClearData() {
    showConfirm('全てのデータを削除しますか？\nこの操作は取り消せません。', async () => {
        try {
            await DB.deleteAllData(state.teamId);
            state.players = [];
            state.lineups = [];
            state.templates = [];
            state.gameStats = [];
            state.settings = { teamName: '', defaultManager: '', defaultCoach: '' };
            state.currentLineup = null;
            state.editingLineupId = null;
            alert('全てのデータを削除しました');
            showPage('home');
        } catch (e) {
            console.error('全データ削除エラー:', e);
            alert('削除に失敗しました: ' + e.message);
        }
    });
}

// =====================
// Confirm Modal
// =====================
export function showConfirm(message, callback) {
    document.getElementById('confirm-message').textContent = message;
    setConfirmCallback(callback);
    document.getElementById('confirm-modal').classList.add('active');
}

export function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
    setConfirmCallback(null);
}

export function confirmAction() {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
}

// =====================
// Stats Management
// =====================
export function renderStatsPage() {
    updateYearSelector();
    renderTeamSummary();
    renderGameStatsList();
    renderPlayerStats();
}

export function updateYearSelector() {
    const select = document.getElementById('stats-year');
    // domain層のgetAvailableYearsを使用
    const years = getAvailableYears(state.gameStats);
    select.innerHTML = years.map(y =>
        `<option value="${y}" ${y === state.selectedYear ? 'selected' : ''}>${y}年</option>`
    ).join('');
}

export function changeStatsYear(year) {
    state.selectedYear = parseInt(year);
    renderTeamSummary();
    renderGameStatsList();
    renderPlayerStats();
}

export function changeStatsGameType(gameType) {
    state.selectedGameType = gameType;
    renderTeamSummary();
    renderGameStatsList();
    renderPlayerStats();
}

export function switchStatsTab(tab) {
    document.querySelectorAll('#page-stats .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('stats-games').style.display = tab === 'games' ? 'block' : 'none';
    document.getElementById('stats-players').style.display = tab === 'players' ? 'block' : 'none';
}

// getGameType → domain/game-utils.js に移動済み

export function renderTeamSummary() {
    const container = document.getElementById('team-summary-container');
    // domain層の集計関数を使用
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

export function renderGameStatsList() {
    const container = document.getElementById('game-stats-list');
    const empty = document.getElementById('game-stats-empty');

    // domain層のfilterGamesを使用
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
                    <div class="game-stat-meta">${g.date} ${g.tournament || ''} <span style="background:var(--gray-light);padding:1px 6px;border-radius:4px;font-size:11px;">${(GAME_TYPES[getGameType(g)] || {}).label || '練習試合'}</span></div>
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

// メンバー表選択モーダル
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
        // 既存の成績を編集
        openGameStatModal(existingStat.id, lineupId);
    } else {
        // 新規作成
        openGameStatModal(null, lineupId);
    }
}

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
        gameTypeSelect.value = getGameType(state.currentGameStat);
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

export function updateBattingOrder(value) {
    if (state.currentGameStat) {
        state.currentGameStat.battingOrder = value;
    }
}

export function renderPlayerBattingInputs() {
    const container = document.getElementById('player-batting-inputs');
    let playersToShow = [];

    // メンバー表に紐づいている場合は出場選手のみ表示
    if (state.currentGameStat.lineupId) {
        const lineup = state.lineups.find(l => l.id === state.currentGameStat.lineupId);
        if (lineup) {
            const starterIds = (lineup.starters || [])
                .filter(s => s && s.playerId)
                .map(s => s.playerId);

            const reserveIds = (lineup.reserves || []).filter(id => id);

            // スターターを打順で、控えを背番号で並べる
            const starterPlayers = [];
            (lineup.starters || []).forEach(s => {
                if (s && s.playerId) {
                    const player = state.players.find(p => p.id === s.playerId);
                    if (player) starterPlayers.push({ player, order: s.order, isStarter: true });
                }
            });
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
// Inning Score Functions
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
// Pitcher Stats Functions
// =====================
export function renderPitcherInputs() {
    const container = document.getElementById('pitcher-stats-inputs');
    const pitchers = state.currentGameStat.pitcherStats || [];
    const activePlayers = state.players.filter(p => p.status === 'active').sort((a, b) => a.number - b.number);

    if (pitchers.length === 0) {
        // 初期状態：1人の投手入力欄を表示
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

export function closeGameStatModal() {
    document.getElementById('game-stat-modal').classList.remove('active');
    state.currentGameStat = null;
}

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
            // 競合チェック（楽観的ロック）
            const clientUpdatedAt = state.currentGameStat.meta?.updatedAt;
            if (clientUpdatedAt) {
                const { conflict, serverData } = await DB.checkConflict(
                    state.teamId, 'gameStats', editId, clientUpdatedAt
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
        console.error('試合成績保存エラー:', e);
        alert('保存に失敗しました: ' + e.message);
    }
}

export function deleteGameStatConfirm(gameId) {
    showConfirm('この試合の成績を削除しますか？', async () => {
        try {
            await DB.deleteGameStatDoc(state.teamId, gameId);
            state.gameStats = state.gameStats.filter(g => g.id !== gameId);
            renderStatsPage();
            renderSavedList();
        } catch (e) {
            console.error('試合成績削除エラー:', e);
            alert('削除に失敗しました: ' + e.message);
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
            console.error('試合成績削除エラー:', e);
            alert('削除に失敗しました: ' + e.message);
        }
    });
}

// 選手成績のソート基準を変更
export function changeStatsSortBy(sortBy) {
    state.statsSortBy = sortBy;
    renderPlayerStats();
}

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

export function closePlayerStatModal() {
    document.getElementById('player-stat-modal').classList.remove('active');
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
