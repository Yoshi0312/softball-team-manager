# ソフトボールチーム管理アプリ — Claude Code 引き継ぎドキュメント

## 1. プロジェクト概要

### 1.1 ビジョン
草野球・ソフトボールチーム向けの総合管理Webアプリ。最終的に複数チームへSaaS提供し、月額課金で収益化を目指す。

### 1.2 現状
単一HTMLファイル（`memberList.html`）でLocalStorageベースのアプリが動作中。選手管理・メンバー表作成・試合成績記録が実装済み。これをFirebaseバックエンドに移行し、マルチユーザー・マルチチーム対応のPWAに進化させる。

### 1.3 リポジトリ
- GitHub: `https://github.com/Yoshi0312/softball-member-list`
- ファイル構成（現状）:
  - `memberList.html` — アプリ本体（HTML/CSS/JS全て含む単一ファイル）
  - `specification.md` — 初期仕様書

---

## 2. 既存アプリの技術詳細

### 2.1 実装済み機能

#### 選手マスター管理
- 選手登録/編集/削除（名前、背番号、打席、投げ、メインポジション、サブポジション、学年/年齢、備考、登録状態）
- ポジション定義: 1(P)〜9(RF) + 10(DP) + 11(FLEX/EP)
- ソート（背番号順/名前順/ポジション順）
- サンプルデータ「青空ウィンズ」16名がデフォルトで登録される

#### メンバー表作成
- 試合情報入力（大会名、試合日、自チーム、相手チーム）
- 打順1〜9（+DP制使用時10番目の守備専門枠）
- 守備位置選択、選手プルダウン選択
- ポジション適性表示（◎メイン/○サブ/△未経験）
- 左打者は黄色背景、両打は緑背景で打順バランスを視覚化
- 控え選手登録（動的に追加可能）
- スタッフ情報（監督、コーチ、スコアラー）
- テンプレート保存・読込
- プレビュー表示（メンバー表形式 + 守備位置図SVG）

#### 試合成績記録
- メンバー表と紐付けた成績入力
- イニングスコア（7回まで、先攻/後攻切り替え対応）
- 打撃成績: 5打席分の結果入力（単打/二塁打/三塁打/本塁打/凡打/三振/四球/死球/犠打/犠飛/失策/野選）
- 打点、得点、盗塁の個別入力
- 投手成績: 投球回、被安打、失点、自責点、奪三振、四球（複数投手対応）

#### 選手別統計（自動計算）
- 年度別表示
- 打率、出塁率、長打率、OPS
- 詳細成績（二塁打、三塁打、本塁打、打点、四球、三振、犠打）
- 選手個別詳細モーダル

#### その他
- チーム設定（チーム名、デフォルト監督・コーチ）
- JSONエクスポート/インポート
- レスポンシブデザイン（モバイルファースト）
- ボトムナビゲーション（ホーム/選手/作成/成績/保存の5タブ）

### 2.2 データ構造（現行 LocalStorage）

LocalStorageキー: `softball_data`

```json
{
  "players": [
    {
      "id": "p001",
      "name": "星野 太一",
      "number": 1,
      "batting": "right",       // "right" | "left" | "switch"
      "throwing": "right",      // "right" | "left"
      "mainPosition": 1,        // 1-11
      "subPositions": [4, 5],   // number[]
      "grade": "3年",
      "note": "監督",
      "status": "active",       // "active" | "休部" | "退部"
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "lineups": [
    {
      "id": "uuid",
      "name": "2024-04-01_春季大会_vs○○",
      "date": "2024-04-01",
      "tournament": "春季大会",
      "teamName": "青空ウィンズ",
      "opponent": "○○チーム",
      "useDP": false,
      "starters": [
        { "order": 1, "position": 8, "playerId": "p003" }
        // ... 9-10名
      ],
      "reserves": ["p011", "p014"],
      "staff": {
        "manager": "星野 太一",
        "coaches": "山本",
        "scorer": ""
      },
      "isTemplate": false,
      "updatedAt": "ISO8601"
    }
  ],
  "templates": [
    // lineupsと同じ構造、isTemplate: true
  ],
  "gameStats": [
    {
      "id": "uuid",
      "lineupId": "uuid",          // 紐付くメンバー表のID
      "date": "2024-04-01",
      "tournament": "春季大会",
      "opponent": "○○チーム",
      "battingOrder": "home",       // "home"(後攻) | "away"(先攻)
      "ourScore": 5,
      "opponentScore": 3,
      "ourInningScores": [0, 2, 0, 1, 0, 2, 0],
      "oppInningScores": [1, 0, 0, 0, 2, 0, 0],
      "playerStats": {
        "p003": {
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
      ]
    }
  ],
  "settings": {
    "teamName": "青空ウィンズ",
    "defaultManager": "星野 太一",
    "defaultCoach": "山本"
  }
}
```

### 2.3 打撃結果の定義

```javascript
const BATTING_RESULTS = {
  'single':        { label: '単打',   totalBases: 1, isHit: true,  isAtBat: true  },
  'double':        { label: '二塁打', totalBases: 2, isHit: true,  isAtBat: true  },
  'triple':        { label: '三塁打', totalBases: 3, isHit: true,  isAtBat: true  },
  'homerun':       { label: '本塁打', totalBases: 4, isHit: true,  isAtBat: true  },
  'out':           { label: '凡打',   totalBases: 0, isHit: false, isAtBat: true  },
  'strikeout':     { label: '三振',   totalBases: 0, isHit: false, isAtBat: true  },
  'walk':          { label: '四球',   totalBases: 0, isHit: false, isAtBat: false },
  'hitByPitch':    { label: '死球',   totalBases: 0, isHit: false, isAtBat: false },
  'sacrifice':     { label: '犠打',   totalBases: 0, isHit: false, isAtBat: false },
  'sacrificeFly':  { label: '犠飛',   totalBases: 0, isHit: false, isAtBat: false },
  'error':         { label: '失策',   totalBases: 0, isHit: false, isAtBat: true  },
  'fieldersChoice':{ label: '野選',   totalBases: 0, isHit: false, isAtBat: true  }
};
```

### 2.4 UI構成

- **ヘッダー**: 固定、ページタイトル + 設定ボタン
- **ボトムナビ**: 固定、5タブ（ホーム/選手/作成/成績/保存）
- **ページ遷移**: `showPage(pageId)` で `.page` の表示を切り替え（SPA的動作）
- **モーダル**: 選手登録、成績入力、選手詳細、確認ダイアログ
- **カラースキーム**: `--primary: #1a73e8`, `--success: #188038`, `--warning: #f9ab00`, `--danger: #d93025`

---

## 3. 移行先アーキテクチャ

### 3.1 技術スタック

| 要素 | 技術 | 理由 |
|------|------|------|
| フロントエンド | HTML/CSS/JS（フレームワークなし） | 既存資産の活用、学習コスト最小化 |
| バックエンド | Firebase (Sparkプラン = 無料) | リアルタイム同期、認証、ホスティングが一体 |
| 認証 | Firebase Authentication (Google) | チームメンバーが簡単にログイン |
| データベース | Cloud Firestore | リアルタイム同期、オフライン対応 |
| ホスティング | Firebase Hosting | SSL自動、カスタムドメイン対応 |
| アプリ形態 | PWA | インストール不要、ホーム画面追加可能 |

### 3.2 Firestore データ構造

```
teams/
  {teamId}/
    info/
      name: string
      createdBy: string (userId)
      createdAt: timestamp
      settings: {
        teamName: string
        defaultManager: string
        defaultCoach: string
        teamColor: string
      }

    members/
      {userId}/
        displayName: string
        email: string
        role: "admin" | "member"    // admin=監督/マネージャー, member=一般選手
        linkedPlayerId: string | null  // playersの選手IDと紐付け（本人の場合）
        joinedAt: timestamp

    players/
      {playerId}/
        name: string
        number: number (0-99)
        batting: "right" | "left" | "switch"
        throwing: "right" | "left"
        mainPosition: number (1-11)
        subPositions: number[]
        grade: string
        note: string
        status: "active" | "休部" | "退部"
        createdAt: timestamp
        updatedAt: timestamp

    lineups/
      {lineupId}/
        name: string
        date: string (YYYY-MM-DD)
        tournament: string
        teamName: string
        opponent: string
        useDP: boolean
        starters: [{ order, position, playerId }]
        reserves: string[]
        staff: { manager, coaches, scorer }
        isTemplate: boolean
        createdBy: string (userId)
        createdAt: timestamp
        updatedAt: timestamp

    gameStats/
      {gameStatId}/
        lineupId: string
        date: string
        tournament: string
        opponent: string
        battingOrder: "home" | "away"
        ourScore: number
        opponentScore: number
        ourInningScores: number[]
        oppInningScores: number[]
        playerStats: {
          [playerId]: {
            atBats: string[]
            rbi: number
            runs: number
            stolenBases: number
          }
        }
        pitcherStats: [{
          playerId, innings, hits, runs, earnedRuns, strikeouts, walks
        }]
        createdBy: string (userId)
        createdAt: timestamp

    events/                        // ★新規：出欠管理
      {eventId}/
        type: "game" | "practice"
        title: string
        date: string (YYYY-MM-DD)
        time: string (HH:MM)
        location: string
        opponent: string | null    // 試合の場合
        lineupId: string | null    // メンバー表と紐付け
        note: string
        createdBy: string (userId)
        createdAt: timestamp

        attendances/               // サブコレクション
          {userId}/
            status: "attend" | "absent" | "pending"
            comment: string
            updatedAt: timestamp

    accounting/                    // ★新規：会計管理
      settings/
        monthlyFee: number         // 月会費（円）
        fiscalYearStart: number    // 会計年度開始月（1-12）

      income/
        {incomeId}/
          type: "monthly_fee" | "event_fee" | "other"
          amount: number
          date: string
          paidBy: string (userId or playerId)
          month: string (YYYY-MM)  // 月会費の場合の対象月
          note: string
          createdBy: string (userId)
          createdAt: timestamp

      expense/
        {expenseId}/
          category: "ground" | "equipment" | "ball" | "uniform" | "transportation" | "other"
          amount: number
          date: string
          description: string
          receipt: string | null    // 将来的に画像URL
          createdBy: string (userId)
          createdAt: timestamp
```

### 3.3 Firestore セキュリティルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ユーザーがチームメンバーであることを確認するヘルパー
    function isTeamMember(teamId) {
      return request.auth != null
        && exists(/databases/$(database)/documents/teams/$(teamId)/members/$(request.auth.uid));
    }

    // ユーザーがチームのadminであることを確認するヘルパー
    function isTeamAdmin(teamId) {
      return request.auth != null
        && get(/databases/$(database)/documents/teams/$(teamId)/members/$(request.auth.uid)).data.role == "admin";
    }

    match /teams/{teamId} {
      // チーム情報: メンバーは読み取り可、adminのみ書き込み可
      match /info/{document=**} {
        allow read: if isTeamMember(teamId);
        allow write: if isTeamAdmin(teamId);
      }

      // メンバー管理: メンバーは一覧読み取り可、adminのみ追加・削除可
      match /members/{userId} {
        allow read: if isTeamMember(teamId);
        allow create: if isTeamAdmin(teamId) || request.auth.uid == userId;
        allow update: if isTeamAdmin(teamId);
        allow delete: if isTeamAdmin(teamId);
      }

      // 選手データ: メンバーは読み取り可、adminのみ書き込み可
      match /players/{playerId} {
        allow read: if isTeamMember(teamId);
        allow write: if isTeamAdmin(teamId);
      }

      // メンバー表: メンバーは読み取り可、adminのみ書き込み可
      match /lineups/{lineupId} {
        allow read: if isTeamMember(teamId);
        allow write: if isTeamAdmin(teamId);
      }

      // 試合成績: メンバーは読み取り可、adminのみ書き込み可
      match /gameStats/{statId} {
        allow read: if isTeamMember(teamId);
        allow write: if isTeamAdmin(teamId);
      }

      // 出欠管理: メンバーは読み取り可、adminはイベント作成可
      match /events/{eventId} {
        allow read: if isTeamMember(teamId);
        allow write: if isTeamAdmin(teamId);

        // 出欠回答: 本人のみ書き込み可
        match /attendances/{userId} {
          allow read: if isTeamMember(teamId);
          allow write: if request.auth.uid == userId;
        }
      }

      // 会計: メンバーは読み取り可、adminのみ書き込み可
      match /accounting/{document=**} {
        allow read: if isTeamMember(teamId);
        allow write: if isTeamAdmin(teamId);
      }
    }

    // 招待トークン（チーム参加用）
    match /invites/{inviteId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;  // admin チェックはアプリ側で
      allow delete: if request.auth != null;
    }
  }
}
```

---

## 4. 実装ロードマップ

### Step 1: Firebase導入 + 認証 + 既存機能のFirestore移行

**目標**: 複数端末から同じデータにアクセスできる状態を作る

#### 1-1. プロジェクト構成の変更

現在の単一HTMLファイルを以下の構成に分割:

```
softball-app/
├── public/
│   ├── index.html          ← メインアプリ（既存memberList.htmlベース）
│   ├── login.html          ← ログイン画面
│   ├── css/
│   │   └── style.css       ← 既存HTMLの<style>を抽出
│   ├── js/
│   │   ├── app.js          ← メインロジック（既存<script>を抽出）
│   │   ├── firebase-init.js ← Firebase初期化
│   │   ├── auth.js         ← 認証関連
│   │   ├── db.js           ← Firestoreアクセス層（CRUD関数群）
│   │   └── migration.js    ← LocalStorage → Firestore移行ツール
│   ├── manifest.json       ← PWAマニフェスト
│   └── sw.js               ← Service Worker
├── firebase.json           ← Firebase Hosting設定
├── firestore.rules         ← セキュリティルール
├── firestore.indexes.json  ← インデックス定義
└── .firebaserc             ← プロジェクト設定
```

#### 1-2. Firebase初期化

```javascript
// js/firebase-init.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.x.x/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.x.x/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.x.x/firebase-firestore.js';

const firebaseConfig = {
  // ← Firebaseコンソールから取得した設定を貼る
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

#### 1-3. 認証フロー

```
ログイン画面
  └─ Googleログインボタン
       ├─ 初回ログイン → チーム作成 or 招待コード入力
       │     ├─ チーム作成 → admin として teams/{teamId}/members に追加
       │     └─ 招待コード → member として teams/{teamId}/members に追加
       └─ 2回目以降 → 所属チーム一覧 → チーム選択 → アプリホーム
```

#### 1-4. Firestoreアクセス層（db.js）

既存の `saveData()` / `loadData()` を置き換える関数群:

```javascript
// db.js — 全てのFirestore操作を集約

// --- 選手 ---
async function getPlayers(teamId) { ... }
async function addPlayer(teamId, playerData) { ... }
async function updatePlayer(teamId, playerId, playerData) { ... }
async function deletePlayer(teamId, playerId) { ... }

// --- メンバー表 ---
async function getLineups(teamId) { ... }
async function addLineup(teamId, lineupData) { ... }
async function updateLineup(teamId, lineupId, lineupData) { ... }
async function deleteLineup(teamId, lineupId) { ... }

// --- 試合成績 ---
async function getGameStats(teamId, year) { ... }
async function addGameStat(teamId, statData) { ... }
async function updateGameStat(teamId, statId, statData) { ... }
async function deleteGameStat(teamId, statId) { ... }

// --- 出欠 ---
async function getEvents(teamId) { ... }
async function addEvent(teamId, eventData) { ... }
async function updateAttendance(teamId, eventId, userId, status) { ... }
async function getAttendances(teamId, eventId) { ... }

// --- 会計 ---
async function getIncomes(teamId, fiscalYear) { ... }
async function addIncome(teamId, incomeData) { ... }
async function getExpenses(teamId, fiscalYear) { ... }
async function addExpense(teamId, expenseData) { ... }

// --- リアルタイムリスナー ---
function onPlayersChanged(teamId, callback) { ... }
function onEventsChanged(teamId, callback) { ... }
```

#### 1-5. LocalStorage → Firestore 移行ツール

既存ユーザー向けに、ブラウザのLocalStorageに保存されたデータをFirestoreに一括移行する機能:

```javascript
// migration.js
async function migrateLocalStorageToFirestore(teamId) {
  const data = JSON.parse(localStorage.getItem('softball_data'));
  if (!data) return { migrated: false, reason: 'no_data' };

  // 1. players を移行
  for (const player of data.players) {
    await addPlayer(teamId, player);
  }

  // 2. lineups を移行（IDのマッピングを保持）
  const lineupIdMap = {};
  for (const lineup of data.lineups) {
    const oldId = lineup.id;
    const newId = await addLineup(teamId, lineup);
    lineupIdMap[oldId] = newId;
  }

  // 3. gameStats を移行（lineupIdを新IDに変換）
  for (const stat of data.gameStats) {
    stat.lineupId = lineupIdMap[stat.lineupId] || stat.lineupId;
    await addGameStat(teamId, stat);
  }

  // 4. settings を移行
  await updateTeamSettings(teamId, data.settings);

  return { migrated: true, counts: { players: data.players.length, lineups: data.lineups.length, gameStats: data.gameStats.length } };
}
```

#### 1-6. 既存app.jsの修正方針

既存コードへの変更を最小限にするため、以下のアプローチを取る:

1. `state` オブジェクトはそのまま維持（UIレンダリングのソース）
2. `loadData()` を `loadDataFromFirestore()` に置き換え → Firestoreから読み込んで `state` に格納
3. `saveData()` を削除し、各操作（savePlayer, saveLineup等）で直接Firestoreに書き込み
4. リアルタイムリスナーで他端末の変更を `state` に反映 → UIを再レンダリング

```javascript
// 変更前
function savePlayer() {
  // ... バリデーション ...
  state.players.push(newPlayer);
  saveData();  // LocalStorage
  renderPlayerList();
}

// 変更後
async function savePlayer() {
  // ... バリデーション ...（変更なし）
  await addPlayer(currentTeamId, newPlayer);  // Firestoreに書き込み
  // stateの更新はリアルタイムリスナーが自動で行う
}
```

---

### Step 2: 出欠管理機能の追加

**目標**: 試合・練習の出欠をチーム全員で管理できる

#### 2-1. 画面追加

ボトムナビに「出欠」タブを追加（既存5タブ → 6タブ、またはホームタブ内にセクション追加）

```
出欠管理画面
├── イベント一覧（今後の予定）
│   ├── 各イベントの出欠サマリー（参加○名/不参加×名/未回答△名）
│   └── タップで詳細表示
├── イベント詳細
│   ├── 日時、場所、対戦相手（試合の場合）
│   ├── 自分の出欠回答ボタン（参加/不参加/コメント）
│   └── メンバー全員の回答状況一覧
└── イベント作成（admin専用）
    ├── 種別（試合/練習）
    ├── 日時、場所
    └── メモ
```

#### 2-2. UIコンポーネント

イベント一覧アイテム:
```html
<div class="event-item">
  <div class="event-date">4/12(土)</div>
  <div class="event-info">
    <div class="event-title">練習試合 vs ○○チーム</div>
    <div class="event-location">△△グラウンド 9:00〜</div>
  </div>
  <div class="event-attendance-summary">
    <span class="attend">○8</span>
    <span class="absent">×2</span>
    <span class="pending">△5</span>
  </div>
</div>
```

出欠回答UI:
```html
<div class="attendance-buttons">
  <button class="attend-btn active">参加</button>
  <button class="absent-btn">不参加</button>
</div>
<input type="text" placeholder="コメント（遅刻します等）">
```

#### 2-3. 通知

- PWA通知（Service Worker経由）でイベント作成時・リマインダーを送信
- 未回答者へのリマインダー（イベント2日前）

---

### Step 3: 会計管理機能の追加

**目標**: 部費の徴収状況と支出を透明に管理

#### 3-1. 画面構成

```
会計管理画面
├── サマリーカード
│   ├── 現在の残高
│   ├── 今月の収入合計
│   └── 今月の支出合計
├── 月会費徴収状況
│   ├── 対象月の選択
│   ├── メンバー一覧（支払済/未払い）
│   └── 支払い記録ボタン（admin）
├── 支出記録
│   ├── 支出一覧（カテゴリ、金額、日付）
│   └── 支出追加（admin）
└── 年間レポート
    ├── 月別収支グラフ
    └── カテゴリ別支出内訳
```

#### 3-2. 支出カテゴリ

```javascript
const EXPENSE_CATEGORIES = {
  ground:         { label: 'グラウンド代', icon: '🏟️' },
  equipment:      { label: '用具・備品',   icon: '🧤' },
  ball:           { label: 'ボール代',     icon: '🥎' },
  uniform:        { label: 'ユニフォーム', icon: '👕' },
  transportation: { label: '交通費',       icon: '🚗' },
  entry_fee:      { label: '大会参加費',   icon: '🏆' },
  other:          { label: 'その他',       icon: '📦' }
};
```

---

### Step 4: PWA化 + Firebase Hosting デプロイ

#### 4-1. manifest.json

```json
{
  "name": "ソフトボールチーム管理",
  "short_name": "チーム管理",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a73e8",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

#### 4-2. Service Worker

```javascript
// sw.js
const CACHE_NAME = 'softball-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/css/style.css',
  '/js/app.js',
  '/js/firebase-init.js',
  '/js/auth.js',
  '/js/db.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('fetch', event => {
  // Network-first for API calls, Cache-first for static assets
  if (event.request.url.includes('firestore.googleapis.com')) {
    event.respondWith(fetch(event.request));
  } else {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});
```

#### 4-3. Firebase Hosting デプロイ

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # publicディレクトリ: public, SPA: yes
firebase deploy
```

---

### Step 5: ロール管理・マルチチーム対応

#### 5-1. チーム招待フロー

```
admin が「招待リンク生成」をタップ
  → Firestore に invites/{randomCode} を作成（teamId, expiresAt を含む）
  → URLを生成: https://yourapp.web.app/join?code={randomCode}
  → LINEやメールで共有

メンバーがリンクを開く
  → ログイン（未ログインなら）
  → invites/{code} を読み取り、teamId を取得
  → teams/{teamId}/members/{userId} を作成（role: "member"）
  → inviteを削除 or 使用済みマーク
  → アプリホームへ遷移
```

#### 5-2. 権限によるUI制御

```javascript
// admin のみ表示する要素
function updateUIForRole(role) {
  const adminElements = document.querySelectorAll('[data-role="admin"]');
  adminElements.forEach(el => {
    el.style.display = role === 'admin' ? '' : 'none';
  });
}
```

HTML側:
```html
<button class="btn btn-primary" data-role="admin" onclick="openPlayerModal()">選手を登録</button>
<!-- memberには表示されない -->
```

---

## 5. 実装上の注意事項

### 5.1 Firebase SDK の読み込み

フレームワークを使わないので、CDNからESM版を直接読み込む:

```html
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
  import { getAuth, signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
  import { getFirestore, collection, doc, setDoc, getDocs, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';
</script>
```

### 5.2 既存コードの移行方針

**最小限の変更で段階的に移行する。一気に全て書き換えない。**

1. まず `firebase-init.js`, `auth.js`, `db.js` を作成
2. `app.js`（既存ロジック）は最初はそのまま維持
3. `loadData()` と `saveData()` だけをFirestore版に差し替え
4. 動作確認後、各機能を順次リファクタリング
5. 新機能（出欠、会計）はFirestore前提で新規実装

### 5.3 オフライン対応

Firestoreにはビルトインのオフラインキャッシュがある:

```javascript
import { enableIndexedDbPersistence } from 'firebase/firestore';
enableIndexedDbPersistence(db).catch(err => {
  console.warn('Offline persistence failed:', err);
});
```

これにより、オフラインでもデータの読み取りが可能。書き込みはオンライン復帰時に自動同期。

### 5.4 パフォーマンス考慮

- Firestoreの読み取り回数を最小化するため、リアルタイムリスナー（`onSnapshot`）を使う
- 選手一覧、メンバー表一覧など頻繁にアクセスするデータはリスナーでキャッシュ
- 統計計算（打率等）はクライアント側で行う（現行と同じ）

### 5.5 Firestoreの無料枠

Sparkプラン（無料）の制限:
- Firestore 読み取り: 50,000回/日
- Firestore 書き込み: 20,000回/日
- Firestore 削除: 20,000回/日
- ストレージ: 1 GiB
- ホスティング: 10 GiB/月の転送量

草野球チーム（15-20名）が日常的に使う範囲では十分。チームが50+に増えた場合はBlazeプラン（従量課金）への移行を検討。

---

## 6. テスト観点

### 6-1. 認証
- [ ] Googleログインが正常に動作するか
- [ ] 未ログイン状態でアプリにアクセスするとログイン画面にリダイレクトされるか
- [ ] ログアウト後にデータにアクセスできないか

### 6-2. データ分離
- [ ] チームAのメンバーがチームBのデータを読めないか
- [ ] adminでないメンバーが選手登録・編集できないか
- [ ] memberが自分の出欠のみ変更できるか

### 6-3. 既存機能の互換性
- [ ] 選手管理（CRUD）が正常動作するか
- [ ] メンバー表作成・保存・読込が正常動作するか
- [ ] 成績入力・統計表示が正常動作するか
- [ ] LocalStorageからの移行が正しく行われるか

### 6-4. リアルタイム同期
- [ ] 端末Aで選手を追加したとき、端末Bにリアルタイムで反映されるか
- [ ] 出欠回答がリアルタイムで他端末に反映されるか

### 6-5. PWA
- [ ] ホーム画面に追加できるか
- [ ] オフラインでもデータ閲覧ができるか
- [ ] オンライン復帰時にデータが同期されるか

---

## 7. 優先度と見積もり

| Step | 内容 | 優先度 | 目安工数 |
|------|------|--------|----------|
| 1-1 | プロジェクト構成変更（ファイル分割） | 最高 | 2日 |
| 1-2 | Firebase初期化 + Googleログイン | 最高 | 1日 |
| 1-3 | 認証フロー（ログイン画面、チーム作成/参加） | 最高 | 3日 |
| 1-4 | Firestoreアクセス層（db.js） | 最高 | 3日 |
| 1-5 | 既存機能のFirestore接続（app.jsの修正） | 最高 | 5日 |
| 1-6 | LocalStorage移行ツール | 高 | 1日 |
| 2 | 出欠管理機能 | 高 | 5日 |
| 3 | 会計管理機能 | 中 | 5日 |
| 4 | PWA化 + デプロイ | 中 | 2日 |
| 5 | ロール管理・招待フロー | 中 | 3日 |

---

## 8. 開発時のCLAUDE.md（Claude Code用）

Claude Codeでこのプロジェクトを開発する際、リポジトリルートに以下の `CLAUDE.md` を配置すること:

```markdown
# CLAUDE.md

## プロジェクト概要
ソフトボールチーム管理PWAアプリ。Firebase + vanilla JS。

## 技術スタック
- フロントエンド: HTML/CSS/JavaScript（フレームワークなし）
- バックエンド: Firebase (Auth, Firestore, Hosting)
- Firebase SDK: ESM版をCDNから読み込み（bundlerは使わない）

## ディレクトリ構成
- `public/` — 配信対象ファイル
- `public/js/` — JavaScriptモジュール
- `public/css/` — スタイルシート
- `firestore.rules` — セキュリティルール

## コーディング規約
- コメントは日本語で記述
- 変数名・関数名は英語（キャメルケース）
- UIテキストは全て日本語
- Firebase SDKはES Modulesで import
- async/await を使用（.then() チェーンは避ける）

## 重要な制約
- フレームワーク（React, Vue等）は使わない
- npm bundler (webpack, vite等) は使わない
- 既存のUI/UXを大きく変更しない（既存ユーザーの混乱を避ける）
- Firestoreセキュリティルールは必ず設定する（クライアント側のチェックだけに頼らない）

## テスト方法
- `firebase emulators:start` でローカルテスト
- ブラウザの開発者ツールでFirestoreの読み書きを確認

## デプロイ
- `firebase deploy` でHosting + Firestore Rulesをデプロイ
```

---

## 9. 補足: 収益化ロードマップ

| フェーズ | 価格 | トリガー |
|----------|------|----------|
| β版 | 無料 | ユーザー獲得、フィードバック収集 |
| 正式版 | チーム月額500円（基本機能） | 10チーム以上が定着 |
| Pro版 | チーム月額1,000〜2,000円 | 動画共有、詳細分析、会計レポートPDF出力 |

決済はStripe Checkout（最もシンプル）を想定。Firebase Cloud Functionsでwebhookを処理。
