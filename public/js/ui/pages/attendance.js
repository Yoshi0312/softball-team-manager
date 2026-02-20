// =====================
// 出欠管理ページ
// =====================
import { auth } from '../../firebase-init.js';
import { currentUserRole, updateUIForRole } from '../../auth.js';
import * as DB from '../../db.js';
import { state } from '../state.js';

let selectedEventId = null;
let editingEventId = null;
const attendanceCache = {};

function getStatusLabel(status) {
    if (status === 'attend') return '出席';
    if (status === 'absent') return '欠席';
    if (status === 'pending') return '保留';
    return '未回答';
}

function sortEvents(events) {
    return [...events].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

async function ensureEventAttendance(eventId) {
    if (!eventId) return [];
    if (!attendanceCache[eventId]) {
        attendanceCache[eventId] = await DB.getAttendancesByEvent(state.teamId, eventId);
    }
    return attendanceCache[eventId];
}

function renderEventList() {
    const list = document.getElementById('attendance-event-list');
    const events = sortEvents(state.events || []);

    if (events.length === 0) {
        list.innerHTML = '<p class="text-muted">イベントがまだありません</p>';
        return;
    }

    list.innerHTML = events.map(event => {
        const selected = event.id === selectedEventId ? 'border:2px solid var(--primary);' : '';
        return `
            <div class="card" style="padding:10px; margin-bottom:8px; ${selected}">
                <div onclick="selectAttendanceEvent('${event.id}')" style="cursor:pointer;">
                    <div style="font-weight:600;">${event.title || '名称未設定'}</div>
                    <div class="text-muted" style="font-size:12px;">${event.date || '日付未設定'} ${event.note ? ` / ${event.note}` : ''}</div>
                </div>
                <div data-role="admin" style="margin-top:8px;">
                    <button class="btn btn-secondary btn-sm" onclick="editAttendanceEvent('${event.id}')">編集</button>
                </div>
            </div>
        `;
    }).join('');
    updateUIForRole(currentUserRole);
}


function renderMyAttendance(event, attendances) {
    const container = document.getElementById('attendance-response');
    const user = auth.currentUser;

    if (!event || !user) {
        container.innerHTML = '<p class="text-muted">イベントを選択してください</p>';
        return;
    }

    const mine = attendances.find(a => a.id === user.uid);
    const status = mine?.status;

    const button = (value, label, cls) => `
        <button class="btn ${status === value ? 'btn-primary' : cls}" onclick="saveMyAttendance('${value}')">${label}</button>
    `;

    container.innerHTML = `
        <p style="margin-bottom:8px;">${event.title} へのあなたの回答: <strong>${getStatusLabel(status)}</strong></p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${button('attend', '出席', 'btn-secondary')}
            ${button('absent', '欠席', 'btn-secondary')}
            ${button('pending', '保留', 'btn-secondary')}
        </div>
    `;
}

function renderAttendanceSummary(attendances) {
    const members = state.teamMembers || [];
    const activeMembers = members.filter(m => m.role);
    const answeredIds = new Set(attendances.map(a => a.id));

    const counts = {
        attend: attendances.filter(a => a.status === 'attend').length,
        absent: attendances.filter(a => a.status === 'absent').length,
        pending: attendances.filter(a => a.status === 'pending').length
    };

    const unanswered = activeMembers.filter(m => !answeredIds.has(m.id));
    const summary = document.getElementById('attendance-summary');
    summary.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(4, minmax(70px,1fr)); gap:8px; margin-bottom:12px;">
            <div class="card" style="padding:8px; text-align:center;"><strong>${counts.attend}</strong><br><small>出席</small></div>
            <div class="card" style="padding:8px; text-align:center;"><strong>${counts.absent}</strong><br><small>欠席</small></div>
            <div class="card" style="padding:8px; text-align:center;"><strong>${counts.pending}</strong><br><small>保留</small></div>
            <div class="card" style="padding:8px; text-align:center;"><strong>${unanswered.length}</strong><br><small>未回答</small></div>
        </div>
        <div>
            <h4 style="margin-bottom:6px;">未回答者一覧</h4>
            ${unanswered.length
                ? `<ul>${unanswered.map(m => `<li>${m.displayName || m.email || m.id}</li>`).join('')}</ul>`
                : '<p class="text-muted">全員回答済みです</p>'}
        </div>
    `;
}

export async function renderAttendancePage() {
    renderEventList();

    if (!selectedEventId && state.events.length > 0) {
        selectedEventId = sortEvents(state.events)[0].id;
    }

    if (!selectedEventId) {
        renderMyAttendance(null, []);
        document.getElementById('attendance-summary').innerHTML = '<p class="text-muted">イベントを作成すると集計が表示されます</p>';
        return;
    }

    const event = state.events.find(e => e.id === selectedEventId);
    const attendances = await ensureEventAttendance(selectedEventId);

    renderMyAttendance(event, attendances);
    renderAttendanceSummary(attendances);
}

export async function selectAttendanceEvent(eventId) {
    selectedEventId = eventId;
    await renderAttendancePage();
}

export async function saveMyAttendance(status) {
    if (!selectedEventId || !auth.currentUser) return;

    await DB.saveAttendance(state.teamId, selectedEventId, auth.currentUser.uid, {
        status,
        userName: auth.currentUser.displayName || auth.currentUser.email || ''
    });

    attendanceCache[selectedEventId] = await DB.getAttendancesByEvent(state.teamId, selectedEventId);
    await renderAttendancePage();
}

export function editAttendanceEvent(eventId) {
    const event = state.events.find(e => e.id === eventId);
    if (!event) return;

    editingEventId = eventId;
    document.getElementById('attendance-title').value = event.title || '';
    document.getElementById('attendance-date').value = event.date || '';
    document.getElementById('attendance-note').value = event.note || '';
    document.getElementById('attendance-save-btn').textContent = 'イベント更新';
}

export function resetAttendanceEventForm() {
    editingEventId = null;
    document.getElementById('attendance-title').value = '';
    document.getElementById('attendance-date').value = '';
    document.getElementById('attendance-note').value = '';
    document.getElementById('attendance-save-btn').textContent = 'イベント作成';
}

export async function saveAttendanceEvent() {
    const title = document.getElementById('attendance-title').value.trim();
    const date = document.getElementById('attendance-date').value;
    const note = document.getElementById('attendance-note').value.trim();

    if (!title || !date) {
        alert('イベント名と日付は必須です');
        return;
    }

    if (editingEventId) {
        await DB.updateEvent(state.teamId, editingEventId, { title, date, note });
    } else {
        selectedEventId = await DB.addEvent(state.teamId, { title, date, note });
    }

    state.events = await DB.getEvents(state.teamId);
    if (editingEventId) {
        delete attendanceCache[editingEventId];
    }
    resetAttendanceEventForm();
    await renderAttendancePage();
}

export async function getLatestAttendanceSummary() {
    const events = sortEvents(state.events || []);
    if (!events.length) {
        return { unansweredCount: 0, eventTitle: null, unansweredMembers: [] };
    }

    const latestEvent = events[0];
    const attendances = await ensureEventAttendance(latestEvent.id);
    const answeredIds = new Set(attendances.map(a => a.id));
    const unansweredMembers = (state.teamMembers || []).filter(m => m.role && !answeredIds.has(m.id));

    return {
        eventTitle: latestEvent.title,
        unansweredCount: unansweredMembers.length,
        unansweredMembers
    };
}
