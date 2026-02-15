// =====================
// 保存済みメンバー表ページ
// =====================
import { state } from '../state.js';

/** 保存済み一覧（メンバー表 + テンプレート）を再描画 */
export function renderSavedList() {
    renderSavedLineups();
    renderSavedTemplates();
}

/** メンバー表リスト描画 */
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

/** テンプレートリスト描画 */
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

/** 保存済みタブ切替 */
export function switchSavedTab(tab) {
    document.querySelectorAll('#page-saved .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('saved-lineups').style.display = tab === 'lineups' ? 'block' : 'none';
    document.getElementById('saved-templates').style.display = tab === 'templates' ? 'block' : 'none';
}
