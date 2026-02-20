// =====================
// メンバー表作成ページ
// =====================
import { state, reserveCount, incrementReserveCount } from '../state.js';
import { POSITIONS, FIELD_POSITIONS } from '../../constants.js';
import * as DB from '../../db.js';
import { generateId, getPositionFit, getBattingLabel } from '../../domain/game-utils.js';
import { showConfirm } from '../modals/confirmModal.js';
import { alertFirestoreWriteError } from '../alerts.js';
import { renderSavedList } from './saved.js';

/** 新規メンバー表を初期化 */
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

/** メンバー表フォームを描画 */
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

/** スターター表を描画 */
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

/** ポジション変更 */
export function updateStarterPosition(order, position) {
    if (state.currentLineup) {
        if (!state.currentLineup.starters[order]) {
            state.currentLineup.starters[order] = { order: order + 1, position: null, playerId: null };
        }
        state.currentLineup.starters[order].position = position ? parseInt(position) : null;
        renderLineupTable();
    }
}

/** 選手変更 */
export function updateStarterPlayer(order, playerId) {
    if (state.currentLineup) {
        if (!state.currentLineup.starters[order]) {
            state.currentLineup.starters[order] = { order: order + 1, position: null, playerId: null };
        }
        state.currentLineup.starters[order].playerId = playerId || null;
        renderLineupTable();
    }
}

/** DPロー切替 */
export function toggleDPRows() {
    renderLineupTable();
}

/** 控え選手を描画 */
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

/** 控え選手変更 */
export function updateReserve(index, playerId) {
    if (state.currentLineup) {
        if (!state.currentLineup.reserves) state.currentLineup.reserves = [];
        state.currentLineup.reserves[index] = playerId || null;
    }
}

/** 控えスロット追加 */
export function addReserveSlot() {
    incrementReserveCount();
    renderReserves();
}

/** メンバー表をFirestoreに保存 */
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
        alertFirestoreWriteError('メンバー表保存エラー', e);
    }
}

/** テンプレートとして保存 */
export function saveAsTemplate() {
    saveLineup(true);
}

/**
 * メンバー表を読み込み
 * ※ showPage は app.js のラッパー経由で呼ぶため window.showPage を使う
 */
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

    window.showPage('lineup');
    renderLineupForm();
}

/** メンバー表を削除 */
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
            alertFirestoreWriteError('メンバー表削除エラー', e);
        }
    });
}

// =====================
// プレビュー
// =====================

/** プレビュー表示 */
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

    window.showPage('preview');
    renderPreview();
}

/** プレビューを描画 */
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

/** 守備位置図SVGを描画 */
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

/** プレビュータブ切替 */
export function switchPreviewTab(tab) {
    document.querySelectorAll('#page-preview .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('preview-table').style.display = tab === 'table' ? 'block' : 'none';
    document.getElementById('preview-field').style.display = tab === 'field' ? 'block' : 'none';
}

function sanitizeForFilename(value, fallback = 'unknown') {
    const cleaned = (value || '')
        .toString()
        .trim()
        .replace(/[\\/:*?"<>|\s]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return cleaned || fallback;
}

const IMAGE_SAVE_ERROR_MESSAGE = '画像の保存に失敗しました。通信状態をご確認のうえ、プレビューを開き直してから再度お試しください。';

/** プレビュー内で現在表示中のカードを取得 */
function getActivePreviewTarget() {
    const table = document.getElementById('preview-table');
    const field = document.getElementById('preview-field');

    if (!table || !field) return null;
    return window.getComputedStyle(field).display !== 'none' ? field : table;
}

/** 画像ダウンロード */
export async function downloadAsImage() {
    const target = getActivePreviewTarget();
    if (!target) {
        alert(IMAGE_SAVE_ERROR_MESSAGE);
        return;
    }

    if (!window.html2canvas) {
        alert(IMAGE_SAVE_ERROR_MESSAGE);
        return;
    }

    const lineup = state.currentLineup || {};
    const date = sanitizeForFilename(lineup.date, new Date().toISOString().slice(0, 10));
    const opponent = sanitizeForFilename(lineup.opponent, 'unknown');
    const targetName = target.id === 'preview-field' ? 'field' : 'table';
    const fileName = `lineup_${date}_vs-${opponent}_${targetName}.png`;

    try {
        const canvas = await window.html2canvas(target, {
            backgroundColor: '#ffffff',
            scale: Math.min(3, window.devicePixelRatio || 1.5),
            useCORS: true
        });

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Blobの生成に失敗しました');

        const imageFile = new File([blob], fileName, { type: 'image/png' });
        const canUseShare = !!navigator.share && (!navigator.canShare || navigator.canShare({ files: [imageFile] }));

        if (canUseShare) {
            await navigator.share({
                files: [imageFile],
                title: 'メンバー表画像',
                text: `${lineup.date || ''} vs ${lineup.opponent || '未定'} のメンバー表`
            });
            return;
        }

        const imageUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(imageUrl), 10000);
    } catch (error) {
        if (error?.name === 'AbortError') return;
        console.error('画像保存エラー:', error);
        alert(IMAGE_SAVE_ERROR_MESSAGE);
    }
}
