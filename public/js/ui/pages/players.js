// =====================
// 選手管理ページ
// =====================
import { state } from '../state.js';
import { POSITIONS } from '../../constants.js';
import * as DB from '../../db.js';
import { getBattingClass, getBattingLabel } from '../../domain/game-utils.js';
import { showConfirm } from '../modals/confirmModal.js';

/** 選手一覧を描画 */
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

/** 選手編集モーダルを表示 */
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

/** 選手モーダルを閉じる */
export function closePlayerModal() {
    document.getElementById('player-modal').classList.remove('active');
}

/** 選手をFirestoreに保存 */
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

/** 選手を削除 */
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
