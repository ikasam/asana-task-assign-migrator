# 01 — 要望・要求・要件

要望（あいまいな「したい」）から要件（検証可能な記述）まで 3 層で整理。

> **2026-05-29 追加フェーズ**: 移行残量を調べる読み取り専用の `survey` サブコマンドの要求を追記（W-008 / D-013〜D-017 / R16〜R23）。背景は[判断 25〜28](06_decisions.md)・[設計選択 10〜11](04_design_options.md)・[制約 C-016, C-017](05_constraints.md)を参照。
>
> **2026-05-30 追加フェーズ**: `--workspace` をドメイン名でも指定できるようにする UX 改善要求を追記（W-009 / D-018 / R24〜R25）。GID を手で調べる手間を省くため、ドメインを `GET /workspaces` の `email_domains` 照合で GID に解決する。背景は[判断 29〜30](06_decisions.md)・[制約 C-014（緩和）, C-018](05_constraints.md)・[仮説 H-API8](02_hypotheses.md)を参照。
>
> **2026-05-31 追加フェーズ**: main への push を起点にリリースを自動化する要求を追記（W-010 / D-019〜D-022 / R26〜R31）。deno.json の version 変化を検知して `vX.Y.Z` tag を作り、同一 workflow run で build+publish する（GITHUB_TOKEN の tag push が他 workflow を非トリガーにする制約 C-019 を reusable workflow 構成で回避）。背景は[判断 31〜35](06_decisions.md)・[設計選択 12〜14](04_design_options.md)・[制約 C-019, C-020](05_constraints.md)・[仮説 H-DENO4](02_hypotheses.md)を参照。

## 要望候補

| ID | 元の発言/材料 | 抽出した要望 | 発言者/関係者 | 補足 |
|---|---|---|---|---|
| W-001 | 「Asana タスクの担当者を一括で移行するツールを開発します」 | 担当者の付け替えを一括で実行したい | ikasam | 1 件ずつの手作業を避けたい |
| W-002 | 「想定ユースケースは、Asana アカウントの移行が新しく作成されたアカウントに限定される場合」 | 移行先は新規作成アカウントに限定する | ikasam | 既存アカウント統合は対象外 |
| W-003 | 「旧アカウントが担当者になっているすべての未完了タスクの担当者を、新アカウントにする」 | 旧アカウントが assignee の未完了タスクを新アカウントに置き換える | ikasam | 完了タスクは対象外 |
| W-004 | 「Asana アカウントが企業ドメイン管理の場合に、他企業ドメインのアカウントへの移行・統合がサポートされていない Asana の制約による」 | Asana 側の制約を回避する手段が必要 | ikasam | 短命ツール前提、Asana 改善で不要になる想定 |
| W-005 | 「PAT 発行手順をドキュメントで明示したい」 | PAT 発行手順を明文化し、利用者がボトルネックなく進められるようにしたい | ikasam | 公式ドキュメントへのリンクで可 |
| W-006 | 「ブラウザを経由するアカウントの認証フローを通して一時トークンを取得する仕様は実現可能？」 | 認証 UX の改善案として OAuth を検討したい | ikasam | 制約確認の結果、現状は PAT 採用 |
| W-007 | 「非対話環境は想定外でよい」 | ツールは人間による起動・実行のみを想定する | ikasam | CI 利用は対象外 |
| W-008 | 「特定ドメインのアカウントが担当している未完了タスクがどれだけ移行できていないか調べたい」 | 移行作業の残量をドメイン単位で可視化したい | ikasam | 2026-05-29 追加。単一ペア移行とは別の読み取り専用調査 |
| W-009 | 「workspace 指定のために ID を調べて入力するのはユーザーからすると不便。CLI option では workspace のドメイン名を渡し、API で ID を解決したい」 | workspace を GID ではなく覚えやすいドメイン名で指定したい | ikasam | 2026-05-30 追加。UX 改善（GID 調査の手間を解消） |
| W-010 | 「明示的な tag の push は手間なので、自動化されたワークフローでリリースをしたい。main branch への push をトリガーとして tag を push → 既存の Release workflow をトリガー」 | main への push を起点にリリース（tag 付与含む）を自動化したい | ikasam | 2026-05-31 追加。GitHub Release のための手動 tag push をなくす |

## 要求候補

要望を整理・抽象化したもの。要件のレイヤーへ落とし込む前段。

| ID | 要求 | 元になった要望 | 設計手段を含む懸念 | 状態 | 未確認事項 |
|---|---|---|---|---|---|
| D-001 | 指定 workspace 内の未完了タスクで、旧アカウントが assignee のものを新アカウントに付け替える | W-001, W-003 | "すべて"の境界（workspace / project 単位）が曖昧 → 判断 1-B で解消 | 確定 | なし |
| D-002 | 旧→新の対応関係は単一ペアを CLI 引数で受け取る | W-001 | 複数ペア CSV を将来要求するか → YAGNI で却下（判断 2-B） | 確定 | なし |
| D-003 | assignee のみ操作対象とし、follower / collaborator / コメント / 添付などには触れない | W-003 | 担当者の定義の広狭 → 判断 3-A | 確定 | なし |
| D-004 | 新アカウントは事前に workspace member として追加済みであることを前提とし、未参加なら fail-fast | W-002 | 自動招待 API を実装するか → スコープ拡大、却下（判断 4-A） | 確定 | なし |
| D-005 | エラー継続実行 + 失敗一覧レポート | (対話で導出) | ロールバックの代替 → 判断 5-B | 確定 | なし |
| D-006 | dry-run モードで実行内容を確認できる | (対話で導出) | 破壊的操作の安全網 | 確定 | なし |
| D-007 | 冪等性: 既に新アカウントが assignee のタスクは対象外。再実行で失敗分のリカバリが可能 | (対話で導出) | search API の eventual consistency と非整合 → judgment 15-A で getTasks に切替 | 確定 | なし |
| D-008 | Asana API のレート制限 (150 req/min) を超えない動作 | (技術制約由来) | throttle と 429 ハンドリングの実装方式 | 確定 | H-DENO2 |
| D-009 | PAT を環境変数経由で安全に受け取る | (セキュリティ由来) | OAuth との比較 → 判断 13-A で PAT 採用 | 確定 | なし |
| D-010 | TypeScript で実装。ランタイムは Deno 第一候補 | W-001 | npm:asana@3 の Deno 互換 → H-DENO1 で確認 | 確定 | H-DENO2 残存 |
| D-011 | PAT 発行手順を README で明示し、CLI のエラーメッセージにもリンクを表示する | W-005 | ドキュメント整備の責任範囲 | 確定 | なし |
| D-012 | 出力モード切替（標準 / JSON / quiet / verbose）と実行確認プロンプト（`--yes` でスキップ）を提供 | (対話で導出) | UX オプションの取捨選択 → 判断 19 | 確定 | なし |
| D-013 | 指定した 1 ドメインについて、そのドメインの email を持つアカウントが assignee の未完了タスク件数を集計する | W-008 | "未移行" の定義（ドメイン単位の enumeration で十分か、移行先マッピングが要るか）→ ドメイン単位で確定（判断 25） | 確定 | なし |
| D-014 | アカウント単位の内訳（誰が何件）と総計を出力する | W-008 | — | 確定 | なし |
| D-015 | 読み取り専用。`updateTask` を一切呼ばない | W-008 | migrate と異なり破壊操作なし | 確定 | なし |
| D-016 | email 非可視ユーザーの存在を結果に明示する（集計の信頼性注記） | W-008 | 一部ユーザーが email を返さない（C-017）→ 件数明示して続行（判断 27） | 確定 | なし |
| D-017 | 既存の workspace 指定 / PAT / レート制限 / 出力モード枠組みを再利用する | W-008 | コード重複回避とふるまい一貫性 | 確定 | なし |
| D-018 | CLI は workspace を人間可読なドメイン名で受け取り、API で GID に解決できるようにする（GID 直指定も従来どおり受ける） | W-009 | 「ドメイン名」は workspace 表示名ではなく organization の登録 email ドメイン。素の workspace（非 organization）には適用不可 → C-018。既存 `--domain`（survey の assignee 用）との命名衝突 → 判断 29 で解消 | 確定 | email_domains が PAT に返るか（H-API8 要検証） |
| D-019 | main への push のうち deno.json の version が直前から変化した push でのみ、tag 作成と GitHub Release を自動実行し、手動 tag push を不要にする | W-010 | 「毎 push リリース」は過剰 → version 変化条件で限定（判断 31） | 確定 | なし |
| D-020 | tag 作成と build+publish を同一 workflow run 内で完結させ、cross-workflow トリガーに依存しない（workflow_call の reusable 構成） | W-010 | GITHUB_TOKEN の tag push は他 workflow を非トリガー（C-019）→ 同一 run 化で回避（判断 32）。既存 release.yml ロジックの再利用は任意（必須要件にしない） | 確定 | なし |
| D-021 | version の single source を deno.json とし、src/cli.ts はそこから導出する。bump は機能追加/バグ修正時の運用規約とする | W-010 | version が 2 箇所に重複（C-020）→ 単一化（判断 33）。bump 忘れの CI 強制は見送り規約に留める（判断 35） | 確定 | compile 同梱は H-DENO4 で採択済（2026-05-31） |
| D-022 | リリース公開前に CI 相当のテストを通し、テスト失敗時はリリースを中止する | W-010 | release が ci.yml と並走し未検証バイナリを公開し得る → release 経路でテスト（判断 34） | 確定 | なし |

## 要件候補

検証可能 / レビュー可能な記述に落としたもの。実装はこれを満たすことを目指す。

| ID | 要件 | 種別 | 状態 | 根拠 | 依存する仮説 | 未確認事項 |
|---|---|---|---|---|---|---|
| R1 | 指定 workspace 内で、旧アカウント (email) が assignee の未完了タスクの assignee を新アカウント (email) に付け替える | システム x 機能 | 確定 | D-001 / 判断 1, 3 | H-API4 | — |
| R2 | 単一ペアを CLI 引数 `--from <email> --to <email>` で受け取る（1 実行 = 1 ユーザー分） | システム x 機能 | 確定 | D-002 / 判断 2 | — | — |
| R3 | assignee のみ変更（follower / collaborator は触らない） | システム x 機能 | 確定 | D-003 / 判断 3 | — | — |
| R4 | 新アカウントが対象 workspace の member であることを事前検証し、未参加ならエラー終了（招待は人手） | システム x 機能 | 確定 | D-004 / 判断 4 | H-API6 | `getUserForWorkspace` の 404 返却挙動 |
| R5 | dry-run モードを提供 | システム x 機能 | 確定 | D-006 / 判断 11 | — | — |
| R6 | 冪等: 既に新アカウントが assignee のタスクは対象外。主用途はリトライ時の重複更新防止（1 回目失敗分のリカバリ実行時に成功済 task を再 update しない） | システム x 非機能 | 確定 | D-007 / 判断 15 | H-API4 | — |
| R7 | エラー継続実行 + 最後に失敗一覧をレポート | システム x 機能 | 確定 | D-005 / 判断 5 | — | — |
| R8 | レート制限 (150 req/min) 内に収める throttle | システム x 非機能 | 確定 | D-008 | H-DENO2 | 429 Retry-After ヘッダー取得可否 |
| R9 | PAT を環境変数 `ASANA_ACCESS_TOKEN` 経由で受け取る | システム x 機能 | 確定 | D-009 / 判断 13 | — | — |
| R10 | TypeScript で実装（ランタイム第一候補 Deno、課題が多ければ Node.js） | システム x 非機能 | 確定 | D-010 / 判断 6, 7 | H-DENO1 採択済 / H-DENO2 残 | `deno compile` でのバイナリ化検証 |
| R11 | PAT 発行手順を README に記載（公式ガイドリンク、開発者コンソール直リンク、1 度しか表示されない注意点） | 運用 x 非機能 | 確定 | D-011 / 判断 14 | — | — |
| R12 | CLI が PAT 環境変数未設定で起動された場合、エラーメッセージに PAT 発行ガイドへのリンクと環境変数名を含めて表示する | システム x 機能 | 確定 | D-011 / 判断 14 | — | — |
| R13 | `--quiet` フラグで進捗行を省略し、最終 summary と失敗一覧のみ出力する | システム x 機能 | 確定 | D-012 / 判断 19c | — | — |
| R14 | `--verbose` フラグで API リクエスト/レスポンス詳細を stderr に出力する debug モード | システム x 機能 | 確定 | D-012 / 判断 19d | — | — |
| R15 | 本実行前（dry-run 以外）に確認プロンプトを表示し、`--yes` でスキップ可能。非対話環境は想定外（TTY 検出は不要） | システム x 機能 | 確定 | D-012 / 判断 19e | — | — |
| R16 | `survey` サブコマンドを追加し、`--workspace <gid>`（必須）と `--domain <domain>`（必須）を取る | システム x 機能 | 確定 | D-013 / 判断 26 | H-API7 | — |
| R17 | workspace 内の全ユーザーを列挙し、email が `@<domain>` で終わるアカウントを対象とする | システム x 機能 | 確定 | D-013 / 判断 25 | H-API7 | — |
| R18 | 対象アカウントごとに assignee かつ未完了のタスク件数を集計する（migrate と同一の `getTasks(completed_since=now)`、subtask 含む） | システム x 機能 | 確定 | D-013 | H-API4, H-DOM3 | — |
| R19 | アカウント単位の内訳（件数降順）と総計を出力する | システム x 機能 | 確定 | D-014 | — | — |
| R20 | email 非可視ユーザー数を結果に明示する | システム x 機能 | 確定 | D-016 / 判断 27 | H-API7 | — |
| R21 | survey は読み取り専用とし、`updateTask` を呼ばない | システム x 非機能 | 確定 | D-015 | — | — |
| R22 | survey 出力は人間可読（既定）+ `--json`、`--verbose` で API debug を stderr、`--quiet` で内訳を省略しサマリのみ | システム x 機能 | 確定 | D-014, D-017 / 判断 28 | — | — |
| R23 | per-account のタスク取得エラーは記録して継続し、末尾に列挙する（migrate の R7 を踏襲） | システム x 機能 | 確定 | D-017 | — | — |
| R24 | `--workspace` の値が GID（数値）でないときはドメイン名とみなし、`GET /workspaces`（`opt_fields=gid,name,is_organization,email_domains`）の `email_domains` 照合で GID に解決する。数値なら従来どおり GID 直指定。migrate / survey の両方に適用 | システム x 機能 | 確定 | D-018 / 判断 29, 30 | H-API8 | email_domains の PAT 可視性（H-API8） |
| R25 | ドメイン解決が 0 件 / 複数件のときは fail-fast（exit 2）し、PAT に可視な workspace（GID・name・email_domains）を列挙して案内する | システム x 機能 | 確定 | D-018 / 判断 30 | H-API8 | 0 件 / 複数件のエラーパスは live 未実行（happy path のみ実機検証。`resolveWorkspace` に unit test 無し＝判断 24）。複数件は実環境で未到達（H-API8 見直し条件参照） |
| R26 | deno.json の `.version` が `github.event.before..after` で変化し、かつ同名 `vX.Y.Z` tag が未存在の main push のとき、`vX.Y.Z` tag を作成して push する | システム x 機能 | 確定 | D-019 / 判断 31 | — | force-push / `before` 欠落時は安全側 no-op（S-028） |
| R27 | tag 作成後、同一 workflow run 内で build + GitHub Release publish を実行する（cross-trigger に依存しない） | システム x 機能 | 確定 | D-020 / 判断 32 | — | — |
| R28 | deno.json version が不変の main push では tag も release も作らず成功終了する（no-op） | システム x 機能 | 確定 | D-019 / 判断 31 | — | — |
| R29 | src/cli.ts の `--version` 出力と生成される tag 名が deno.json の version と一致する（single source） | システム x 非機能 | 確定 | D-021 / 判断 33 | H-DENO4 | deno compile での version 同梱は H-DENO4 で採択済（2026-05-31） |
| R30 | リリースの build に進む前に CI 相当のチェック（fmt/lint/check/test）を通し、失敗時はリリースを中止する。tag は test 通過後に作成・push し、test 失敗時に dangling tag を残さない | システム x 非機能 | 確定 | D-022 / 判断 34 | — | — |
| R31 | 同名 tag/release が既に存在する場合は fail（loud）し、既存リリースを上書きしない（再リリースは version bump を要する） | システム x 機能 | 確定 | D-019 / 判断 31 | — | — |

## 種別の凡例

- **業務 / システム / 運用** — どの領域で発生する要件か
- **機能 / 非機能** — 何が動くか（機能）か、どう動くか（非機能）か

## 関連

- [判断履歴](06_decisions.md)
- [仮説マップ](02_hypotheses.md)
- [仕様候補](03_specifications.md)
