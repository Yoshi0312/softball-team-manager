// =====================
// 設定管理
// =====================
import { state } from '../ui/state.js';
import * as DB from '../db.js';
import {
    currentUserRole,
    createInviteCode,
    getTeamInvites,
    revokeInviteCode,
    reissueInviteCode,
    buildInviteUrl
} from '../auth.js';
import { alertFirestoreWriteError } from '../ui/alerts.js';

/** 設定フォームを読み込み */
export function loadSettings() {
    document.getElementById('settings-team-name').value = state.settings.teamName || '';
    document.getElementById('settings-manager').value = state.settings.defaultManager || '';
    document.getElementById('settings-coach').value = state.settings.defaultCoach || '';
    loadInviteManagement();
}

function formatDateTime(value) {
    if (!value) return '-';
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ja-JP');
}

function getStatusLabel(invite) {
    if (invite.status === 'revoked') return '無効';
    if (invite.status === 'used' || invite.usedBy || invite.usedAt) return '使用済み';
    if (invite.expiresAt?.toDate && invite.expiresAt.toDate() < new Date()) return '期限切れ';
    return '有効';
}

function getMemberLabelByUid(uid) {
    if (!uid) return '-';
    const member = (state.teamMembers || []).find(m => m.id === uid);
    if (!member) return uid;
    return member.displayName || member.email || uid;
}

function renderInviteRows(invites) {
    const tbody = document.getElementById('invite-list-body');
    if (!tbody) return;

    if (!invites.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="font-size:12px;">まだ招待リンクはありません</td></tr>';
        return;
    }

    tbody.innerHTML = invites.map(invite => {
        const status = getStatusLabel(invite);
        const isActive = status === '有効';
        return `
            <tr>
                <td>
                    <div style="font-weight:600;">${invite.code}</div>
                    <div style="font-size:11px; color:var(--gray);">${buildInviteUrl(invite.code)}</div>
                </td>
                <td>${status}</td>
                <td>${formatDateTime(invite.expiresAt)}</td>
                <td>${getMemberLabelByUid(invite.usedBy)}</td>
                <td>${formatDateTime(invite.usedAt)}</td>
                <td>
                    <button class="btn btn-secondary" style="padding:6px 8px; font-size:11px;" onclick="copyInviteLink('${invite.code}')">コピー</button>
                    <button class="btn btn-secondary" style="padding:6px 8px; font-size:11px;" onclick="reissueInviteFromAdmin('${invite.code}')">再発行</button>
                    ${isActive ? `<button class="btn btn-danger" style="padding:6px 8px; font-size:11px;" onclick="invalidateInviteFromAdmin('${invite.code}')">無効化</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

export async function loadInviteManagement() {
    const wrap = document.getElementById('invite-admin-card');
    if (!wrap) return;
    if (currentUserRole !== 'admin') return;

    try {
        const invites = await getTeamInvites(state.teamId);
        renderInviteRows(invites);
    } catch (e) {
        console.error('招待一覧取得エラー:', e);
    }
}

export async function createInviteLinkFromAdmin() {
    try {
        const code = await createInviteCode(state.teamId);
        const url = buildInviteUrl(code);
        document.getElementById('invite-latest-url').value = url;
        await loadInviteManagement();
    } catch (e) {
        alertFirestoreWriteError('招待リンク生成エラー', e);
    }
}

export async function copyInviteLink(inviteCode) {
    const url = buildInviteUrl(inviteCode);
    try {
        await navigator.clipboard.writeText(url);
        alert('招待URLをコピーしました');
    } catch (e) {
        const input = document.getElementById('invite-latest-url');
        if (input) {
            input.value = url;
            input.select();
        }
        alert('クリップボードにアクセスできないため、URLを手動コピーしてください');
    }
}

export async function reissueInviteFromAdmin(inviteCode) {
    try {
        const newCode = await reissueInviteCode(inviteCode, state.teamId);
        document.getElementById('invite-latest-url').value = buildInviteUrl(newCode);
        await loadInviteManagement();
    } catch (e) {
        alertFirestoreWriteError('招待リンク再発行エラー', e);
    }
}

export async function invalidateInviteFromAdmin(inviteCode) {
    try {
        await revokeInviteCode(inviteCode);
        await loadInviteManagement();
    } catch (e) {
        alertFirestoreWriteError('招待リンク無効化エラー', e);
    }
}

/** 設定をFirestoreに保存 */
export async function saveSettings() {
    state.settings.teamName = document.getElementById('settings-team-name').value.trim();
    state.settings.defaultManager = document.getElementById('settings-manager').value.trim();
    state.settings.defaultCoach = document.getElementById('settings-coach').value.trim();

    try {
        await DB.updateTeamSettings(state.teamId, state.settings);
        alert('設定を保存しました');
    } catch (e) {
        alertFirestoreWriteError('設定保存エラー', e);
    }
}

/** 互換用スタブ（Firestore移行後は不要） */
export function saveData() {
    console.warn('saveData()はFirestore移行により無効化されています');
}
