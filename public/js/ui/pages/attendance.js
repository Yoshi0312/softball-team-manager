// =====================
// 出欠管理ページ
// =====================
import { auth } from '../../firebase-init.js';
import { currentUserRole, updateUIForRole } from '../../auth.js';
import {
    getEvents,
    addEvent,
    updateEvent,
    saveAttendance,
    getAttendancesByEvent
} from '../../db.js';
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

async function refreshEvents() {
    state.events = await getEvents(state.teamId);
}

async function loadAttendances(eventId) {
    if (!eventId) return [];
    if (!attendanceCache[eventId]) {
        attendanceCache[eventId] = await getAttendancesByEvent(state.teamId, eventId);
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

    list.innerHTML = events.map((event) => {
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
}

function renderMyAttendance(event, attendances) {
    const container = document.getElementById('attendance-response');
    const user = auth.currentUser;

    if (!event || !user) {
        container.innerHTML = '<p class="text-muted">イベントを選択してください</p>';
        return;
    }

    const mine = attendances.find((a) => a.id === user.uid);
    const status = mine?.status;

    const answerButton = (value, label) => `
        <button class="btn ${status === value ? 'btn-primary' : 'btn-secondary'}" onclick="saveMyAttendance('${value}')">${label}</button>
    `;

    container.innerHTML = `
        <p style="margin-bottom:8px;">${event.title} へのあなたの回答: <strong>${getStatusLabel(status)}</strong></p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${answerButton('attend', '出席')}
            ${answerButton('absent', '欠席')}
            ${answerButton('pending', '保留')}
        </div>
    `;
}

function renderAttendanceSummary(attendances) {
    const members = state.teamMembers || [];
    const answeredIds = new Set(attendances.map((a) => a.id));
    const statusById = new Map(attendances.map((a) => [a.id, a.status]));

    const counts = {
        attend: attendances.filter((a) => a.status === 'attend').length,
        absent: attendances.filter((a) => a.status === 'absent').length,
        pending: attendances.filter((a) => a.status === 'pending').length
    };

    const unansweredMembers = members.filter((m) => !answeredIds.has(m.id));
    const summary = document.getElementById('attendance-summary');

    summary.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(4, minmax(70px,1fr)); gap:8px; margin-bottom:12px;">
            <div class="card" style="padding:8px; text-align:center;"><strong>${counts.attend}</strong><br><small>出席</small></div>
            <div class="card" style="padding:8px; text-align:center;"><strong>${counts.absent}</strong><br><small>欠席</small></div>
            <div class="card" style="padding:8px; text-align:center;"><strong>${counts.pending}</strong><br><small>保留</small></div>
            <div class="card" style="padding:8px; text-align:center;"><strong>${unansweredMembers.length}</strong><br><small>未回答</small></div>
        </div>
        <div style="margin-bottom:12px;">
            <h4 style="margin-bottom:6px;">メンバー回答状況</h4>
            <ul>
                ${members.map((m) => {
                    const label = getStatusLabel(statusById.get(m.id));
                    return `<li>${m.displayName || m.email || m.id}: <strong>${label}</strong></li>`;
                }).join('')}
            </ul>
        </div>
        <div>
            <h4 style="margin-bottom:6px;">未回答者一覧</h4>
            ${unansweredMembers.length
                ? `<ul>${unansweredMembers.map((m) => `<li>${m.displayName || m.email || m.id}</li>`).join('')}</ul>`
                : '<p class="text-muted">全員回答済みです</p>'}
        </div>
    `;
}

export async function renderAttendancePage() {
    updateUIForRole(currentUserRole);

    if (!selectedEventId && state.events.length > 0) {
        selectedEventId = sortEvents(state.events)[0].id;
    }

    renderEventList();

    if (!selectedEventId) {
        renderMyAttendance(null, []);
        document.getElementById('attendance-summary').innerHTML = '<p class="text-muted">イベントを作成すると集計が表示されます</p>';
        return;
    }

    const event = state.events.find((e) => e.id === selectedEventId);
    const attendances = await loadAttendances(selectedEventId);

    renderMyAttendance(event, attendances);
    renderAttendanceSummary(attendances);
    updateUIForRole(currentUserRole);
}

export async function selectAttendanceEvent(eventId) {
    selectedEventId = eventId;
    await renderAttendancePage();
}

export async function saveMyAttendance(status) {
    if (!selectedEventId || !auth.currentUser) return;

    await saveAttendance(state.teamId, selectedEventId, auth.currentUser.uid, {
        status,
        userName: auth.currentUser.displayName || auth.currentUser.email || ''
    });

    attendanceCache[selectedEventId] = await getAttendancesByEvent(state.teamId, selectedEventId);
    await renderAttendancePage();
}

export function editAttendanceEvent(eventId) {
    const event = state.events.find((e) => e.id === eventId);
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
    if (currentUserRole !== 'admin') {
        alert('イベント作成は管理者のみ実行できます');
        return;
    }

    const title = document.getElementById('attendance-title').value.trim();
    const date = document.getElementById('attendance-date').value;
    const note = document.getElementById('attendance-note').value.trim();

    if (!title || !date) {
        alert('イベント名と日付は必須です');
        return;
    }

    if (editingEventId) {
        await updateEvent(state.teamId, editingEventId, { title, date, note });
        delete attendanceCache[editingEventId];
    } else {
        selectedEventId = await addEvent(state.teamId, { title, date, note });
    }

    await refreshEvents();
    resetAttendanceEventForm();
    await renderAttendancePage();
}

export async function getLatestAttendanceSummary() {
    const events = sortEvents(state.events || []);
    if (!events.length) {
        return { unansweredCount: 0, eventTitle: null, unansweredMembers: [] };
    }

    const latestEvent = events[0];
    const attendances = await loadAttendances(latestEvent.id);
    const answeredIds = new Set(attendances.map((a) => a.id));
    const unansweredMembers = (state.teamMembers || []).filter((m) => !answeredIds.has(m.id));

    return {
        eventTitle: latestEvent.title,
        unansweredCount: unansweredMembers.length,
        unansweredMembers
    };
}
