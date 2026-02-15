# ソフトボールチーム管理アプリ — システム仕様書

> 最終更新: 2025-02 (リファクタリング第2段完了時点)

## 1. プロジェクト概要

### 1.1 ビジョン
草野球・ソフトボールチーム向けの総合管理Webアプリ。最終的に複数チームへSaaS提供し、月額課金で収益化を目指す。

### 1.2 現状
Firebase + ES Modules（バンドラ不使用）によるマルチファイル構成で動作中。Google認証・Firestoreバックエンド・マルチチーム対応・ロール管理を実装済み。LocalStorageからの移行ツールも完備。

### 1.3 リポジトリ
- GitHub: `https://github.com/Yoshi0312/softball-team-manager` (private)
- ホスティング: Firebase Hosting

### 1.4 技術スタック

| 要素 | 技術 | 備考 |
|------|------|------|
| フロントエンド | HTML/CSS/JS（フレームワークなし） | ES Modules、CDN読み込み |
| バックエンド | Firebase (Sparkプラン = 無料) | |
| 認証 | Firebase Authentication (Google) | |
| データベース | Cloud Firestore | version楽観ロック対応 |
| ホスティング | Firebase Hosting | SSL自動 |
| Firebase SDK | v11.1.0 (ESM版 CDN) | `https://www.gstatic.com/firebasejs/11.1.0/` |

---

## 2. ファイル構成

```
softball-team-manager/
├── public/
│   ├── index.html              ← メインアプリ
│   ├── login.html              ← ログイン / チーム選択 / チーム作成・参加
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js              ← エントリ (152行): import集約 + window公開 + init
│   │   ├── app/
│   │   │   └── router.js       ← DOM切替のみ（循環参照回避）
│   │   ├── constants.js        ← 定数定義（POSITIONS, BATTING_RESULTS, GAME_TYPES, WOBA_WEIGHTS等）
│   │   ├── db.js               ← Firestoreアクセス層（CRUD + meta/version管理 + 楽観ロック）
│   │   ├── firebase-init.js    ← Firebase初期化（apiKey等）
│   │   ├── auth.js             ← 認証（Google login/logout, ロール管理, チーム作成/参加）
│   │   ├── migration.js        ← LocalStorage → Firestore 移行ツール
│   │   ├── domain/
│   │   │   ├── game-utils.js   ← 純粋ユーティリティ（formatAvg, resolveGameType, generateId等）
│   │   │   └── game-stats.js   ← 成績計算（filterGames, calculatePlayerStats, calculateTeamSummary等）
│   │   ├── ui/
│   │   │   ├── state.js        ← 共有状態オブジェクト（state, confirmCallback, reserveCount）
│   │   │   ├── pages/
│   │   │   │   ├── home.js     ← ホームページ（updateHomePage）
│   │   │   │   ├── players.js  ← 選手管理（CRUD, モーダル）
│   │   │   │   ├── lineup.js   ← メンバー表作成 + プレビュー + 守備位置図
│   │   │   │   ├── saved.js    ← 保存済み一覧（メンバー表 + テンプレート）
│   │   │   │   └── stats.js    ← 成績管理（チームサマリ, 試合一覧, 選手成績表）
│   │   │   └── modals/
│   │   │       ├── confirmModal.js     ← 確認ダイアログ
│   │   │       ├── playerStatModal.js  ← 選手成績詳細
│   │   │       └── gameStatModal.js    ← 試合成績入力（最大モジュール, ~590行）
│   │   └── services/
│   │       ├── settings.js     ← 設定管理（loadSettings, saveSettings）
│   │       └── exports.js      ← データ入出力（exportData, importData, confirmClearData）
├── firebase.json               ← Firebase Hosting設定
├── firestore.rules             ← セキュリティルール
├── firestore.indexes.json      ← インデックス定義
├── CLAUDE.md                   ← Claude Code設定（日本語, ES6, フレームワーク禁止）
└── HANDOFF.md                  ← 本ファイル（システム仕様書）
```

### 2.1 モジュール依存方向

```
app.js（エントリ）
 ├─ import ← app/router.js（DOM切替のみ）
 ├─ import ← ui/pages/*.js（各ページUI）
 ├─ import ← ui/modals/*.js（モーダル）
 ├─ import ← services/*.js（設定/エクスポート）
 ├─ import ← ui/state.js（状態管理）
 ├─ import ← domain/*.js（純粋関数）
 └─ import ← db.js（Firestore）

ui/pages/*.js, ui/modals/*.js, services/*.js
 ├─ import ← domain/*.js ✅
 ├─ import ← db.js ✅
 ├─ import ← ui/state.js ✅
 └─ import ← ui/modals/*.js ✅（一方向のみ）

domain/*.js → ui/db/state を import しない ✅（純粋関数層）
db.js → ui を import しない ✅
```

### 2.2 window公開パターン

index.html で `import * as appModule from './js/app.js'` → `Object.assign(window, appModule, authModule)` で全export関数をグローバル公開。inline `onclick` 属性から呼び出し可能にしている。

- `app.js` の `export { showPageWithRender as showPage, ... }` で60+関数を再export
- `auth.js` の `logout` 等は `authModule` 経由で公開
- `switchTeam`, `startMigration`, `dismissMigration` は index.html 内で `window.*` に直接定義

---

## 3. 実装済み機能

### 3.1 認証・マルチチーム

- Google認証（Firebase Authentication）
- チーム作成 / 招待コードによるチーム参加
- チーム切替（複数チーム所属対応）
- ロール管理: admin（監督/マネージャー）/ member（一般選手）
- `data-role="admin"` 属性によるUI要素の表示制御
- LocalStorage → Firestore 一括移行ツール

### 3.2 選手マスター管理

- 選手登録/編集/削除
- フィールド: 名前、背番号(0-99)、打席(right/left/switch)、投げ(right/left)、メインポジション(1-11)、サブポジション(配列)、学年/年齢、備考、登録状態(active/休部/退部)
- ポジション定義: 1(P)〜9(RF) + 10(DP) + 11(FLEX/EP)
- ソート: 背番号順 / 名前順 / ポジション順
- 左打者は黄色背景、両打は緑背景で視覚化

### 3.3 メンバー表作成

- 試合情報入力（大会名、試合日、自チーム、相手チーム）
- 打順1〜9（+DP制使用時10番目の守備専門枠）
- 守備位置選択、選手プルダウン選択
- ポジション適性表示（◎メイン / ○サブ / △未経験）
- 控え選手登録（動的に追加可能）
- スタッフ情報（監督、コーチ、スコアラー）
- テンプレート保存・読込
- プレビュー表示（メンバー表形式 + 守備位置図SVG）

### 3.4 試合成績記録

- メンバー表と紐付けた成績入力
- 試合種別: 公式戦（一般）/ 公式戦（壮年）/ 練習試合 / 紅白戦
- 先攻/後攻切替
- イニングスコア（7回まで）
- 打撃成績: 5打席分（単打/二塁打/三塁打/本塁打/凡打/三振/四球/死球/犠打/犠飛/失策/野選）
- 打点、得点、盗塁の個別入力
- 投手成績: 投球回、被安打、失点、自責点、奪三振、四球（複数投手対応）
- 楽観的ロック: version主体 + updatedAt fallback による競合検出

### 3.5 選手別統計（自動計算）

- 年度別・試合種別フィルタ
- 基本指標: 打率(AVG)、出塁率(OBP)、長打率(SLG)、OPS
- セイバーメトリクス: wOBA、ISO、BABIP、K%、BB%
- ソート: wOBA順（デフォルト）/ 打率順 / OPS順 等
- 選手個別詳細モーダル（全指標一覧表示）

### 3.6 チーム成績サマリ

- 年度別の勝敗・得失点・勝率をテーブル表示
- 試合種別ごとの集計（公式戦/練習試合等）

### 3.7 その他

- チーム設定（チーム名、デフォルト監督・コーチ）
- JSONエクスポート/インポート
- 全データ削除（確認ダイアログ付き）
- レスポンシブデザイン（モバイルファースト）
- ボトムナビゲーション（ホーム/選手/作成/成績/保存の5タブ）

---

## 4. データ構造

### 4.1 Firestore コレクション

```
teams/{teamId}/
  info/         → チーム名, 作成者, settings
  members/      → {userId}: displayName, email, role, linkedPlayerId, joinedAt
  players/      → {playerId}: 選手データ
  lineups/      → {lineupId}: メンバー表データ（isTemplate: true/false で統合）
  gameStats/    → {gameStatId}: 試合成績データ（meta付き）
```

### 4.2 gameStats ドキュメント構造

```json
{
  "lineupId": "uuid",
  "date": "2024-04-01",
  "tournament": "春季大会",
  "opponent": "○○チーム",
  "type": "official",
  "gameType": "official",
  "battingOrder": "home",
  "ourScore": 5,
  "opponentScore": 3,
  "ourInningScores": [0, 2, 0, 1, 0, 2, 0],
  "oppInningScores": [1, 0, 0, 0, 2, 0, 0],
  "playerStats": {
    "playerId": {
      "atBats": ["single", "out", "double", null, null],
      "rbi": 2,
      "runs": 1,
      "stolenBases": 0
    }
  },
  "pitcherStats": [
    {
      "playerId": "p001",
      "innings": "7",
      "hits": "5",
      "runs": "3",
      "earnedRuns": "2",
      "strikeouts": "6",
      "walks": "2"
    }
  ],
  "meta": {
    "version": 1,
    "updatedAt": "2024-04-01T12:00:00.000Z"
  }
}
```

### 4.3 試合種別の統一ルール

- 保存時: `type` フィールド（正式）と `gameType` フィールド（互換）の両方に記録
- 読み取り時: `resolveGameType(g)` = `g.type ?? getGameType(g)` で新旧データを統一解決
- フィルタリング: `filterGames(games, { year, type })` で種別フィルタ対応

### 4.4 楽観的ロック

- **version主体**: `meta.version` を比較（同じなら競合なし、異なれば競合）
- **updatedAtフォールバック**: versionがない旧データは `meta.updatedAt` で比較
- **競合発生時**: ユーザーに上書きか再読込かを確認ダイアログで選択させる

### 4.5 打撃結果の定義

```javascript
const BATTING_RESULTS = {
  'single':        { label: '単打',   abbr: '安',   totalBases: 1, isHit: true,  isAtBat: true  },
  'double':        { label: '二塁打', abbr: '2',    totalBases: 2, isHit: true,  isAtBat: true  },
  'triple':        { label: '三塁打', abbr: '3',    totalBases: 3, isHit: true,  isAtBat: true  },
  'homerun':       { label: '本塁打', abbr: 'HR',   totalBases: 4, isHit: true,  isAtBat: true  },
  'out':           { label: '凡打',   abbr: '凡',   totalBases: 0, isHit: false, isAtBat: true  },
  'strikeout':     { label: '三振',   abbr: 'K',    totalBases: 0, isHit: false, isAtBat: true  },
  'walk':          { label: '四球',   abbr: '四',   totalBases: 0, isHit: false, isAtBat: false },
  'hitByPitch':    { label: '死球',   abbr: '死',   totalBases: 0, isHit: false, isAtBat: false },
  'sacrifice':     { label: '犠打',   abbr: '犠',   totalBases: 0, isHit: false, isAtBat: false },
  'sacrificeFly':  { label: '犠飛',   abbr: '犠飛', totalBases: 0, isHit: false, isAtBat: false },
  'error':         { label: '失策',   abbr: 'E',    totalBases: 0, isHit: false, isAtBat: true  },
  'fieldersChoice':{ label: '野選',   abbr: 'FC',   totalBases: 0, isHit: false, isAtBat: true  }
};
```

### 4.6 wOBAウェイト（MLB 2023年基準）

```javascript
const WOBA_WEIGHTS = {
  bb: 0.694, hbp: 0.721, single: 0.885,
  double: 1.262, triple: 1.593, homerun: 2.058
};
```

---

## 5. UI構成

- **ヘッダー**: 固定、ページタイトル + チーム切替ボタン + 設定ボタン + ログアウトボタン
- **ボトムナビ**: 固定、5タブ（ホーム/選手/作成/成績/保存）
- **ページ遷移**: `showPage(pageId)` で `.page` の表示を切り替え（SPA的動作）
  - router.js: DOM切替のみ
  - app.js: `showPageWithRender()` でDOM切替 + レンダリングをラップ
- **モーダル**: 選手登録、成績入力、メンバー表選択、選手詳細、確認ダイアログ
- **カラースキーム**: `--primary: #1a73e8`, `--success: #188038`, `--warning: #f9ab00`, `--danger: #d93025`

---

## 6. Firestore セキュリティルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isTeamMember(teamId) {
      return request.auth != null
        && exists(/databases/$(database)/documents/teams/$(teamId)/members/$(request.auth.uid));
    }
    function isTeamAdmin(teamId) {
      return request.auth != null
        && get(/databases/$(database)/documents/teams/$(teamId)/members/$(request.auth.uid)).data.role == "admin";
    }

    match /teams/{teamId} {
      match /info/{document=**}    { allow read: if isTeamMember(teamId); allow write: if isTeamAdmin(teamId); }
      match /members/{userId}      { allow read: if isTeamMember(teamId); allow create: if isTeamAdmin(teamId) || request.auth.uid == userId; allow update, delete: if isTeamAdmin(teamId); }
      match /players/{playerId}    { allow read: if isTeamMember(teamId); allow write: if isTeamAdmin(teamId); }
      match /lineups/{lineupId}    { allow read: if isTeamMember(teamId); allow write: if isTeamAdmin(teamId); }
      match /gameStats/{statId}    { allow read: if isTeamMember(teamId); allow write: if isTeamAdmin(teamId); }
    }
    match /invites/{inviteId}      { allow read, create, delete: if request.auth != null; }
  }
}
```

---

## 7. 実装ロードマップ

### 完了済み

| Step | 内容 | コミット |
|------|------|----------|
| 1-1 | プロジェクト構成変更（ファイル分割） | c0ccc9e |
| 1-2 | Firebase初期化 + Google認証 | c0ccc9e |
| 1-3 | 認証フロー（ログイン, チーム作成/参加, ロール管理） | c0ccc9e |
| 1-4 | Firestoreアクセス層（db.js） | c0ccc9e |
| 1-5 | 既存機能のFirestore接続 | c0ccc9e |
| 1-6 | LocalStorage移行ツール | c0ccc9e |
| 追加 | wOBA/ISO/BABIP/K%/BB% セイバーメトリクス追加 | c3d801b |
| R1 | リファクタリング第1段: domain層分離 + state管理 + 楽観ロック | 2dca537 |
| 前処理 | resolveGameType統一、version主体ロック、type正式フィールド化 | c085eba |
| R2 | リファクタリング第2段: app.js(1710行)を責務別12ファイルに分割 | f5056d0 |
| 検証 | onclick互換チェック: window公開関数の存在確認コード追加 | 2114af1 |

### 未着手

| Step | 内容 | 優先度 | 目安工数 |
|------|------|--------|----------|
| 2 | 出欠管理機能 | 高 | 5日 |
| 3 | 会計管理機能 | 中 | 5日 |
| 4 | PWA化（manifest.json + Service Worker） | 中 | 2日 |
| 5 | 招待フロー改善（URLリンク共有） | 中 | 3日 |

---

## 8. 将来構想（未実装機能）

| # | 機能 | 現状 | 実装に必要なこと |
|---|------|------|------------------|
| 1 | **選手比較機能** | 未実装 | グラフライブラリ導入（Chart.js等）、比較UI、レーダーチャート |
| 2 | **チーム戦績ダッシュボード** | 部分的（テーブル集計のみ） | 勝率推移グラフ、得失点差トレンド、月別グラフ |
| 3 | **打順最適化提案** | 部分的（OPS/wOBAソートのみ） | 打順アルゴリズム、提案UI、ドラッグ&ドロップ |
| 4 | **MVP投票機能** | 未実装 | Firestore投票コレクション、投票UI、集計表示 |
| 5 | **出欠管理** | 未実装（Firestore設計のみ） | events/attendancesコレクション、回答UI、集計 |
| 6 | **対戦相手分析** | 部分的（opponentフィールドのみ） | 対戦相手別集計ロジック、分析ページUI |

---

## 9. 開発ガイドライン

### 9.1 CLAUDE.md ルール

- すべて日本語で回答、コードコメントも日本語
- ES6構文を使用
- フレームワーク禁止
- クラスより関数＋オブジェクトを優先
- 魔法の数値は定数・データに切り出す

### 9.2 コーディング規約

- 変数名・関数名は英語（キャメルケース）
- UIテキストは全て日本語
- Firebase SDK は ES Modules で import（CDN直接読み込み、bundler不使用）
- async/await を使用（.then() チェーンは避ける）
- domain層（game-utils.js, game-stats.js）は DOM/state/db を import しない純粋関数

### 9.3 新機能追加時の手順

1. domain層に計算ロジックを追加（純粋関数）
2. ui/pages/ または ui/modals/ に UI コードを追加
3. app.js に import + `export { ... }` で再export（window公開）
4. index.html に HTML要素追加（onclick は window公開関数名を直接使用）
5. 必要に応じて db.js に Firestore アクセス関数を追加

### 9.4 テスト方法

- `firebase emulators:start` または `npx http-server public -p 8080` でローカルテスト
- ブラウザ DevTools Console でモジュール読み込みエラーがないことを確認
- index.html のデバッグチェック（L775-797）で全onclick関数のwindow登録を自動検証

---

## 10. Firestoreの無料枠

Sparkプラン（無料）の制限:
- 読み取り: 50,000回/日
- 書き込み: 20,000回/日
- 削除: 20,000回/日
- ストレージ: 1 GiB
- ホスティング: 10 GiB/月の転送量

草野球チーム（15-20名）が日常的に使う範囲では十分。

---

## 11. 収益化ロードマップ

| フェーズ | 価格 | トリガー |
|----------|------|----------|
| β版 | 無料 | ユーザー獲得、フィードバック収集 |
| 正式版 | チーム月額500円（基本機能） | 10チーム以上が定着 |
| Pro版 | チーム月額1,000〜2,000円 | 動画共有、詳細分析、会計レポートPDF出力 |

決済はStripe Checkout（最もシンプル）を想定。Firebase Cloud Functionsでwebhookを処理。
