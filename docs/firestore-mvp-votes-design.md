# Firestore MVP投票データ設計

## 採用パス
`teams/{teamId}/events/{eventId}/votes/{userId}` を採用します。

- 既存のイベント（試合/出欠）にぶら下げることで、投票対象を自然に管理できる。
- ドキュメントIDを `userId` に固定し、物理的に「1ユーザー1票」を担保する。
- 集計は `votes` サブコレクション全件読み込みで実装可能。

## ドキュメント構造

### 1) イベント本体: `teams/{teamId}/events/{eventId}`

```json
{
  "title": "春季リーグ第3節",
  "date": "2026-03-20",
  "note": "雨天予備日あり",

  "voteEnabled": true,
  "voteLocked": false,
  "voteDeadline": "2026-03-21T12:00:00.000Z",

  "updatedAt": "serverTimestamp"
}
```

- `voteEnabled` : 投票機能のON/OFF（管理者が設定）。
- `voteLocked` : 管理者による即時締切フラグ。
- `voteDeadline` : 締切日時（null可）。

### 2) 投票: `teams/{teamId}/events/{eventId}/votes/{userId}`

```json
{
  "playerId": "player_xxx",
  "playerName": "山田 太郎",
  "voterName": "佐藤 花子",
  "updatedAt": "serverTimestamp"
}
```

- `playerId` : 投票対象選手ID（必須）。
- `playerName` : 表示高速化用スナップショット。
- `voterName` : 監査・表示補助。
- `updatedAt` : 作成時刻（更新不可運用）。

## セキュリティルール要件

- 読み取り: チームメンバー全員可。
- 作成: `request.auth.uid == userId` の本人のみ。
- 重複防止: `!exists(.../votes/{userId})` を必須にして2票目を拒否。
- 更新/削除: 禁止（1票提出後の改ざんを防止）。
- 受付期間: `voteEnabled == true && voteLocked != true && (voteDeadline == null || request.time <= voteDeadline)`。

## 集計仕様

- ランキングは `votes` を `playerId` で集計し、得票数降順で表示。
- 同票時は `playerName` 昇順で安定ソート。

