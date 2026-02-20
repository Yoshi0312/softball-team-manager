# 手動回帰確認レポート（2026-02-20）

## 実施内容
- `docs/manual-test-checklist.md` の「4.1 分析ダッシュボード v1（追加チェック）」を基準に、`stats` の `games / players / dashboard` を重点確認。
- ログイン後に「年度」「試合種別」を複数パターンで切り替えた際の表示一致性を確認。
- 選手比較 UI で `0 → 1 → 2 → 3 → 解除` の遷移を確認。

## 確認メモ
- 本環境では Firebase 認証用のテストアカウント情報が提供されていないため、実ブラウザでのログイン後シナリオは再現できませんでした。
- そのため、UI表示一致性は `public/js/ui/pages/stats.js` の実装読解による回帰判定を併記しています。

## 回帰結果一覧（OK / NG / 要対応）

| No | 観点 | 結果 | 根拠 / メモ |
|---|---|---|---|
| 1 | `stats` タブ切替（games / players / dashboard） | OK | `switchStatsTab()` で3タブの表示制御が明示されており、DOM表示切替の破綻は見当たりません。 |
| 2 | 年度切替の再集計連動 | OK | `changeStatsYear()` から team summary / games / players の再描画が呼ばれ、集計更新される実装です。 |
| 3 | 試合種別切替の再集計連動（3表示一致） | NG | `changeStatsGameType()` は再描画を呼ぶ一方、`renderTeamSummary()` の `calculateTeamSummary()` 呼び出しで `type` 条件が渡されていません。サマリ表だけ全種別集計になる不一致リスクがあります。 |
| 4 | 選手比較 0→1→2→3→解除 遷移 | OK | `togglePlayerCompare()` が上限3名で制御し、解除時は `filter` で確実に除外。`renderPlayerComparison()` で選択数に応じた UI 文言・disabled 状態も再構築されています。 |
| 5 | 認証後の実機手順（複数パターン） | 要対応 | テストアカウント未提供のため、ログイン後の手動操作を本環境で完遂不可。次回は検証用アカウントまたはエミュレータ運用が必要です。 |

## 要対応項目（次スプリントチケット化対象）
- NG/要対応の詳細は `docs/next-sprint-tickets.md` に起票。
