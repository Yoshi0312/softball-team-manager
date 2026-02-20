// =====================
// ルーター（DOM切替のみ）
// =====================

/**
 * ページ切替（DOM表示/非表示 + タブアクティブ化 + タイトル更新）
 * レンダリングは行わない。app.js の showPageWithRender がラップして呼ぶ。
 */
export function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(`page-${pageId}`).classList.add('active');

    const navIndex = { home: 0, players: 1, lineup: 2, attendance: 3, stats: 4, saved: 5, preview: 5, settings: -1 };
    if (navIndex[pageId] >= 0) {
        document.querySelectorAll('.nav-item')[navIndex[pageId]].classList.add('active');
    }

    const titles = {
        home: 'ホーム',
        players: '選手管理',
        lineup: 'メンバー表作成',
        preview: 'プレビュー',
        attendance: '出欠管理',
        stats: '成績管理',
        saved: '保存済み',
        settings: '設定'
    };
    document.getElementById('page-title').textContent = titles[pageId] || '';
}

/** 設定ページを開く */
export function openSettings() {
    // window.showPage は app.js の showPageWithRender が公開済み
    window.showPage('settings');
}
