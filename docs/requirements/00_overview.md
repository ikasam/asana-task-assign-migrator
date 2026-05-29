# 00 — 現時点の理解

## 目的

- Asana で **旧アカウントが担当者になっている未完了タスクの assignee を、新アカウントに一括で付け替える** CLI ツールを開発する。

## 対象

- 単一の Asana workspace 内、単一の旧→新ペア（email 指定）を 1 回の実行で処理する。
- assignee フィールドのみを変更し、follower / collaborator / コメント著者・添付ファイルなどは触らない。
- subtask も `assignee` が一致すれば移行対象に含める。

## 私の解釈

- このツールは Asana 側の制約（企業ドメイン管理アカウントが別企業ドメインへ移行・統合できない）を回避するためのワークアラウンド。
- 本来は Asana 側で自然に移行されるべきで、当ツールは Asana の改善により不要になることが望ましい短命ツール。
- 機能拡張ではなく **確実な単機能完遂** が価値の源泉。

## 明示した前提

- 新アカウントは **対象 workspace の member として事前に追加済み**（招待は人手で実施）。
- 旧アカウントの PAT が発行可能（Asana 開発者コンソールで発行する）。
- 本実行は対話的環境で人間が起動する。非対話環境（CI、cron、パイプなど）は想定外。
- 移行対象 workspace の Asana プランは制限要因にならない（[H-API5](02_hypotheses.md) で確認予定）。

## 曖昧な点（最終時点で解消済み / 未解消）

| 項目 | 状態 |
|---|---|
| 「すべての未完了タスク」の境界（workspace / project 単位） | 解消（[判断 1-B](06_decisions.md)） |
| 旧→新の対応関係の入力形式（単一 / 複数） | 解消（[判断 2-A](06_decisions.md)） |
| 「担当者」の範囲（assignee / follower / 著者） | 解消（[判断 3-A](06_decisions.md)） |
| 「新規作成アカウント限定」制約の意味 | 解消（[判断 4-A](06_decisions.md)、ドメイン制約の確認済み） |
| エラー時の挙動（fail-fast / 継続 / ロールバック） | 解消（[判断 5-B](06_decisions.md)） |
| 実装言語 / ランタイム | 解消（[判断 6-B](06_decisions.md)、Deno 第一候補） |
| 認証方式（PAT / OAuth） | 解消（[判断 13-A](06_decisions.md)、PAT 採用） |
| 検索 API の選択（search / getTasks） | 解消（[判断 15-A](06_decisions.md)、getTasks 採用） |
| subtask の扱い | 解消（[判断 16-A](06_decisions.md)、含める） |
| `getTasks` が Free プランで動くか | 未解消（[H-API5](02_hypotheses.md)） |
| 429 Retry-After を SDK で読めるか | 未解消（[H-DENO2](02_hypotheses.md)） |
| `getUserForWorkspace` が非メンバーで 404 を返すか | 未解消（[H-API6](02_hypotheses.md)） |

## 複数ありうる解釈（明示的に却下した解釈）

- 「すべての未完了タスク」を **複数 workspace 横断** と解釈する → 却下（判断 1-A）
- 「担当者の移行」を **follower / collaborator も含む** と解釈する → 却下（判断 3-B/C）
- ツールが **新アカウントの招待まで自動で実施する** → 却下（判断 4-B）
- 「アカウント移行」を **既存ユーザーへの統合** と解釈する → 却下（判断 4-C で除外）
- 失敗時の **ロールバック** を実装する → 却下（判断 5-C）
- **複数ペア一括 CSV 投入** で運用効率化する → 却下（判断 2-B）
- **Free プラン対応の project 走査フォールバック** → 却下（判断 8-A、後に getTasks 採用で論点ごと消滅）

## このまま進めるリスク

- **H-API5 が偽の場合**（getTasks が Free プランで動かない、または assignee+workspace+completed_since の組み合わせが期待通り動かない）→ 検索戦略の見直しが必要。判断 15 / 判断 8 へ戻る。
- **H-DENO2 が偽の場合**（SDK が 429 Retry-After を吸収してしまう）→ 自前 fetch クライアントへの切り替えを検討。判断 7 へ戻る。
- **新アカウントが未招待の workspace** で実行された場合 → [R4](01_requirements.md) で fail-fast するため安全側だが、ユーザー側の人手作業（招待）が必要になる。

## 追加スコープ — survey サブコマンド（2026-05-29）

- 移行ツールに、**移行残量を把握する読み取り専用の `survey` サブコマンド**を追加する。
- 指定ドメイン（例 `example.com`）の email を持つアカウントが assignee の未完了タスク件数を、workspace 全体で集計する（"未移行" = まだ当該ドメインが assignee のままの未完了タスク）。
- 既存の単一ペア移行（`migrate`）とは独立した機能で、`updateTask` は呼ばない。
- CLI はサブコマンド制に再構成し、`migrate` / `survey` を明示必須とする（bare 呼び出しは廃止 = breaking、VERSION 0.2.0）。
- 詳細: [判断 25〜28](06_decisions.md) / [設計選択 10, 11](04_design_options.md) / 要件 [R16〜R23](01_requirements.md)。

## 人間に最終確認した事項

要件分析 [判断 1〜22](06_decisions.md) で確認済み。
