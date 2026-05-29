# 05 — 制約整理

業務・技術・運用・セキュリティ・契約上の制約を C-* で識別。下位レイヤーへの影響と交渉可能性を明示する。

## 制約一覧

| ID | 制約 | 種類 | 発生源 | 影響先 | 強さ | 交渉可能性 | 上位へ戻る条件 |
|---|---|---|---|---|---|---|---|
| C-001 | Asana の企業ドメイン管理アカウントは、別企業ドメインのアカウントへ移行・統合できない | 業務 | Asana 製品仕様 | このツール自体の存在理由（R1, [00_overview.md](00_overview.md)） | 強 | 不可（Asana 側仕様） | Asana 側で当該制約が解消されたらツール不要に |
| C-002 | Asana API のレート制限: PAT 認証で 150 req/min | 技術 | Asana 公式 ([rate-limits](https://developers.asana.com/docs/rate-limits)) | R8, S-007 | 強 | 不可（実装側で対処） | 制限緩和されたら throttle 緩和 |
| C-003 | `/workspaces/{ws}/tasks/search` は Premium プラン以上限定（Free で 402 Payment Required） | 技術 | Asana 公式 + SDK JSDoc | 検索 API 選択 ([設計選択 3](04_design_options.md)) | 強 | 不可 | プラン制限緩和（観測不要、search を採用しないため影響軽微） |
| C-004 | `tasks/search` API は eventual consistency（10〜60 秒の indexing 遅延）と非標準ページネーション | 技術 | Asana 公式 + SDK JSDoc | search 採用時の R6 整合性 | 強 | 不可 | 同上（getTasks を採用したため影響なし） |
| C-005 | PAT は生成画面で 1 度しか表示されず、再表示不可。紛失時は再発行 | セキュリティ | Asana 仕様 | R11, R12 | 強 | 不可 | — |
| C-006 | 新アカウントは事前に対象 workspace の member として追加されている必要がある（招待は人手） | 業務 / 運用 | 判断 4-A | R4 | 強 | 可（判断 4-B / C を再選択すれば自動招待などへ） | 招待運用が現実的でなくなったら判断 4 を再開 |
| C-007 | 本ツールは対話環境で人間による起動のみを想定。非対話環境（CI / pipe）は対象外 | 運用 | 判断 19 補足 | R15, S-009 | 中 | 可 | バッチ運用ニーズが顕在化したら R15 / S-009 を見直し |
| C-008 | `assignee` は単一ユーザーのみ受け付ける（Asana ドメイン仕様、複数 assign 不可） | 業務 | Asana 製品仕様 | R1, S-012 | 強 | 不可 | — |
| C-009 | このツールは短命前提（Asana 側改善で不要になる想定） | 業務 | 判断 4 補足 | 設計姿勢全体 | 中 | 可（ツール寿命を伸ばすなら見直し） | 機能拡張ニーズが顕在化、または Asana 側改善が長期未達のとき |
| C-010 | `npm:asana@3` SDK は `superagent ^6.1.0` に依存し、Node.js builtins (`http`/`https`/`url`) を内部で使う | 技術 | SDK package.json | Deno 互換性検証（H-DENO1〜3） | 中 | 可（独自 fetch クライアントへ切替） | H-DENO2 が偽になった場合 |
| C-011 | `npm:asana@3` の package.json では `@babel/cli` がランタイム依存に入っている（パッケージング不備） | 技術 | SDK package.json | バイナリサイズ、`deno compile` 影響 | 弱 | 不可（上流修正待ち） | サイズが許容できない規模になったら独自 fetch へ切替 |
| C-012 | 配布バイナリにアプリ secret を埋め込むのはアンチパターン | セキュリティ | OAuth 2.0 / RFC 8252 一般則 | 認証方式選択 ([設計選択 1](04_design_options.md)) | 中 | 不可（OAuth 採用すると埋め込み避けられない） | OAuth 採用の判断が再浮上した場合に評価 |
| C-013 | 2026-05-27 時点で developers.asana.com に 503 障害発生中（一次情報の参照が一時不可） | 運用 | 外部サービス | ドキュメント検証の精度 | 弱 | 不可（待つ） | 障害復旧後に R11 ドラフト文言と H-API5 などを一次情報で再確認 |
| C-014 | ~~`--workspace` は GID 必須~~ → **2026-05-30 緩和（判断 29）**: `--workspace` は GID（数値）またはドメイン名を受け付ける（ドメインは `email_domains` 照合で GID 解決）。`--from`/`--to` は引き続き email 必須（互換受付なし） | 仕様 | 判断 15 → 判断 29 / S-001, S-027 | CLI シグネチャ | 中 | 可 | （表示名指定の追加ニーズなど）さらなる UX 改善ニーズが具体化した場合 |
| C-015 | 旧アカウントの PAT が必要（または旧アカウントの assignee 変更権限を持つ管理者の PAT） | 運用 / セキュリティ | Asana 権限モデル | 実行者要件 | 中 | 可 | 移行作業の運用フローが管理者のみで完結する場合 |
| C-016 | リポジトリにコミットするコードに組織固有値（ドメイン名・workspace GID 等）をハードコードしない。`--domain` / `--workspace` は必須引数とし、会社固有のデフォルトを置かない | セキュリティ / 運用 | プロジェクト共通の開発ポリシー（ローカルパス・組織 identity の非混入） | R16, S-020 | 強 | 不可 | — |
| C-017 | workspace ユーザー一覧 API（`getUsers`）は一部ユーザーの email を返さない（PAT 可視性制約） | 技術 | Asana API + 2026-05-29 実機検証（714 中 97 が非返却） | R20, H-API7, survey 集計の網羅性 | 中 | 不可（API 仕様） | email 欠落が多すぎて集計が無意味になる場合は判断 27 を再開 |
| C-018 | ドメイン→GID 解決は organization の `email_domains`（workspace オブジェクトのフィールド）に依存する。素の workspace（`is_organization=false`、ドメイン無し）や、PAT が `email_domains` を返さないケースでは成立しない | 技術 | Asana API（organization のみ email ドメインを持つ）+ C-017 と同種の PAT 可視性リスク | R24, R25, H-API8 | 中 | 不可（API 仕様） | `email_domains` が返らないと判明したら判断 29 を再開し GID 必須へ戻す（C-014 を維持） |

## 種類の凡例

- **業務** — Asana 製品仕様や利用組織のルールに起因
- **技術** — API / SDK / ランタイム由来
- **運用** — 利用者の操作手順や前提条件
- **セキュリティ** — 認証・認可・トークン管理
- **契約** — 法務・利用規約・SLA（本ツールでは該当なし）

## 強さの凡例

- **強** — 違反すると機能が成立しない / 重大な事故
- **中** — 違反すると UX や保守性が大きく劣化
- **弱** — 改善余地はあるが当面は許容可能

## 関連

- [00_overview.md](00_overview.md) — 背景
- [02_hypotheses.md](02_hypotheses.md) — 仮説マップ
- [04_design_options.md](04_design_options.md) — 設計案比較
