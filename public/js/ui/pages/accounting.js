// =====================
// 会計ページ
// =====================
import { currentUserRole, updateUIForRole } from '../../auth.js';
import {
    getMonthlyAccountingEntries,
    addAccountingEntry,
    deleteAccountingEntry
} from '../../db.js';
import { state } from '../state.js';

function formatCurrency(amount) {
    return `¥${Number(amount || 0).toLocaleString('ja-JP')}`;
}

function getCurrentMonth() {
    return new Date().toISOString().slice(0, 7);
}

function sortEntries(entries) {
    return [...entries].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function getSelectedMonth() {
    const monthInput = document.getElementById('accounting-month');
    return monthInput?.value || getCurrentMonth();
}

function renderSummary(entries) {
    const income = entries
        .filter((entry) => entry.type === 'income')
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const expense = entries
        .filter((entry) => entry.type === 'expense')
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const balance = income - expense;

    const summary = document.getElementById('accounting-summary');
    summary.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(3, minmax(90px,1fr)); gap:8px;">
            <div class="card" style="padding:8px; text-align:center;"><strong>${formatCurrency(income)}</strong><br><small>収入</small></div>
            <div class="card" style="padding:8px; text-align:center;"><strong>${formatCurrency(expense)}</strong><br><small>支出</small></div>
            <div class="card" style="padding:8px; text-align:center;"><strong>${formatCurrency(balance)}</strong><br><small>収支</small></div>
        </div>
    `;
}

function renderList(entries) {
    const list = document.getElementById('accounting-list');

    if (!entries.length) {
        list.innerHTML = '<p class="text-muted">選択した月の収支データはありません</p>';
        return;
    }

    list.innerHTML = sortEntries(entries).map((entry) => `
        <div class="card" style="padding:10px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
                <div>
                    <div style="font-weight:600;">
                        ${entry.type === 'income' ? '収入' : '支出'} / ${entry.category || '未分類'}
                    </div>
                    <div class="text-muted" style="font-size:12px;">${entry.date || '-'}${entry.memo ? ` / ${entry.memo}` : ''}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:700; color:${entry.type === 'income' ? 'var(--success)' : 'var(--danger)'};">
                        ${entry.type === 'income' ? '+' : '-'}${formatCurrency(entry.amount)}
                    </div>
                    <button class="btn btn-danger btn-sm" style="margin-top:6px;" data-role="admin" onclick="deleteAccounting('${entry.id}')">削除</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function reloadMonthlyData() {
    const month = getSelectedMonth();
    const entries = await getMonthlyAccountingEntries(state.teamId, month);
    state.accountingEntries = entries;
    renderSummary(entries);
    renderList(entries);
    updateUIForRole(currentUserRole);
}

export async function renderAccountingPage() {
    const monthInput = document.getElementById('accounting-month');
    if (monthInput && !monthInput.value) {
        monthInput.value = getCurrentMonth();
    }

    await reloadMonthlyData();
}

export async function changeAccountingMonth() {
    await reloadMonthlyData();
}

export async function saveAccountingEntry() {
    if (currentUserRole !== 'admin') {
        alert('会計データの登録は管理者のみ実行できます');
        return;
    }

    const type = document.getElementById('accounting-type').value;
    const amount = Number(document.getElementById('accounting-amount').value);
    const category = document.getElementById('accounting-category').value.trim();
    const date = document.getElementById('accounting-date').value;
    const memo = document.getElementById('accounting-memo').value.trim();

    if (!type || !amount || amount <= 0 || !date) {
        alert('区分・金額・日付は必須です');
        return;
    }

    await addAccountingEntry(state.teamId, {
        type,
        amount,
        category,
        date,
        memo,
        month: date.slice(0, 7)
    });

    document.getElementById('accounting-amount').value = '';
    document.getElementById('accounting-category').value = '';
    document.getElementById('accounting-date').value = '';
    document.getElementById('accounting-memo').value = '';

    await reloadMonthlyData();
}

export async function deleteAccounting(entryId) {
    if (currentUserRole !== 'admin') {
        alert('会計データの削除は管理者のみ実行できます');
        return;
    }

    await deleteAccountingEntry(state.teamId, entryId);
    await reloadMonthlyData();
}
