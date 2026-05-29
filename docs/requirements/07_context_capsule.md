# 07 — Context Capsule

実装セッションへの引き継ぎ用要約。全文を読まなくても、ここを見れば判断を誤らない程度の情報密度を目指す。

## 目的

- 旧 Asana アカウントが assignee の未完了タスクを、指定 workspace 内で新アカウントへ一括付け替えする CLI ツールを実装する。

## 対象

- 単一の旧→新ペア（email 指定）/ 単一 workspace / 1 実行 = 1 ユーザー分。
- assignee フィールドのみ更新（subtask 含む）。

## 背景

- Asana の企業ドメイン管理アカウントが、別企業ドメインへ移行・統合できない Asana 側の制約を回避するワークアラウンド。
- 本来は Asana 側で自然に移行されるのが望ましく、ツール寿命は短い前提。
- **最小スコープが価値**：機能拡張提案には慎重に、確実な単機能完遂を優先する。

## 確定事項

### 要件 (R1〜R15)

[`01_requirements.md`](01_requirements.md) を参照。要約：
- 指定 workspace 内、旧→新の email ペアで assignee を付け替え
- dry-run / 冪等 / エラー継続実行 / 失敗一覧レポート
- レート制限 (150 req/min) 内に収める
- PAT を `ASANA_ACCESS_TOKEN` 環境変数で受け取り、未設定時は発行ガイド付きエラー
- `--quiet` / `--verbose` / `--yes` / `--dry-run` / `--json` フラグ
- 本実行前の確認プロンプト
- TypeScript / Deno 2.x / `npm:asana@3` SDK

### 仕様 (S-001〜S-018)

[`03_specifications.md`](03_specifications.md) と [`../../README.md`](../../README.md) を参照。要約：
- CLI シグネチャと環境変数
- 実行フロー: Pre-checks → Task discovery → 冪等性フィルタ → 確認プロンプト → Execution → Reporting
- API シーケンス: `getWorkspace` → `getUser(from)` → `getUser(to)` → `getUserForWorkspace(ws, to)` → `getTasks` (paginated) → `updateTask` × N
- `getTasks` パラメータ: `{workspace, assignee=from_gid, completed_since:"now", opt_fields:"name,gid,assignee.gid", limit:100}`
- `updateTask` 本体: `{ data: { assignee: to_gid } }`
- 終了コード: 0 / 1 / 2

### 技術スタック

- ランタイム: Deno 2.x
- 言語: TypeScript
- 認証: PAT (環境変数 `ASANA_ACCESS_TOKEN`)
- SDK: `npm:asana@3` （Phase 1 スパイクで動作確認済）
- 配布形態想定: `deno compile` での単一バイナリ（要検証 H-DENO3）

## 仮置き事項

- レート制限ハンドリング: 最低 400ms 間隔 + 429 で Retry-After 待機、最大 3 回再試行（実装方式は H-DENO2 次第で自前 fetch にスイッチの可能性）
- バージョン番号体系: 実装時に semver 採用予定

## 要検証事項

2026-05-28 Phase 2 スパイク (`spike/phase2_api.ts`) と `deno compile` の実機検証で、要検証だった仮説は全て採択済み。

| ID | 内容 | 状態 |
|---|---|---|
| H-API4 | `getTasks({workspace, assignee, completed_since:"now"})` が期待通り未完了タスクをフィルタする | ✓ 採択 (2026-05-28) |
| H-API5 | `getTasks` が Free プランでも動く | ✓ 採択 (2026-05-28) |
| H-API6 | `getUserForWorkspace` が非メンバーで 404 を返す | ✓ 採択 (2026-05-28、検証 workspace の非メンバー email で 404 観測) |
| H-DENO2 | superagent 経由で `err.response.headers` が読める (Retry-After 含む) | ✓ 採択 (2026-05-28、404 ケースで header object 観測。429 実観測時に最終確認) |
| H-DOM3 | subtask が `getTasks` のレスポンスに含まれる | ✓ 採択 (2026-05-28、検証用 parent task の subtask 2 件が当該 assignee の `getTasks` 結果に含まれ overlap=2/2)。fallback コード (`SubtaskMode` / `listSubtasks` / `expandSubtasks`) は YAGNI で削除済み (判断 24) |
| H-DENO3 | `deno compile` で `npm:asana` を含む単一バイナリが生成・実行できる | ✓ 採択 (2026-05-28、92 MB バイナリ生成、実 API pre-check まで動作) |

## 強い制約

| ID | 制約 |
|---|---|
| C-002 | レート制限 150 req/min（PAT） |
| C-005 | PAT は 1 度しか表示されない（紛失時は再発行） |
| C-006 | 新アカウントは事前に対象 workspace の member として追加されている必要 |
| C-007 | 非対話環境は想定外（TTY 検出は不要、人間による起動が前提） |
| C-008 | `assignee` は単一ユーザー（複数 assign 不可） |

詳細: [`05_constraints.md`](05_constraints.md)

## 棄却済み案

| 案 | 棄却理由 | 再検討トリガー |
|---|---|---|
| 全 workspace 横断 | 副作用範囲が広い | 全 workspace 横断要望 |
| 複数ペア CSV | 最小スコープ違反 | 数十ユーザー以上の一括移行 |
| follower / collaborator 置換 | スコープ拡大 | follower 引き継ぎ漏れの実害 |
| 自動招待 API | 管理者責任の領域 | 招待運用がボトルネック化 |
| ロールバック | 並行編集時の整合性問題 | 冪等再実行で復帰できないケース頻発 |
| OAuth 認証 | アプリ登録運用 / client_secret 埋め込みアンチパターン / 短命ツールに過剰 | PAT 運用の煩雑さが事故を生む |
| `searchTasksForWorkspace` | eventual consistency / Premium 限定 / 非標準ページネーション | `getTasks` で運用不能と判明 |
| subtask 除外 | 移行漏れになる | 業務上不要と判明 |
| 並列実行 | レート制限が律速 | レート制限緩和 / 遅すぎる FB |
| 進捗バー | 失敗特定容易性低下 | 視覚的進捗が必要との要望 |
| TTY 検出 / 非対話対応 | スコープ外 | CI / cron 運用が顕在化 |

詳細: [`06_decisions.md`](06_decisions.md) 末尾「棄却された案の整理」

## 重要な用語定義

- **PAT**: Personal Access Token。Asana 開発者コンソールで発行する長期トークン。`Authorization: Bearer <token>` で API 認証。
- **workspace GID**: Asana の workspace を一意に識別する数値文字列。URL `/0/<gid>/...` で確認可能。
- **assignee**: Asana のタスクで担当者として登録される単一ユーザー。
- **completed_since=now**: Asana `/tasks` API のイディオム。「現在時点で未完了のタスクのみ」を取得する。
- **subtask**: 親タスクを持つタスク。`assignee` は親と独立。
- **冪等性 (R6)**: 同じ引数で再実行しても、既に新アカウントが assignee のタスクは対象外として扱う。失敗分のリカバリが安全。
  - **主用途は「リトライ時の重複更新防止」**。1 回目の本実行で一部失敗が出たケースで、成功済み task に対する 2 回目以降の `updateTask` 呼び出しを避け、無駄な API consume を抑える狙い。
  - 「from と to に同じユーザーが assign された task の検知」用途ではない（pre-checks で `from != to` を弾くので、両者が同一 user の状況は発生し得ない）。

## 後工程で忘れると危険な文脈

1. **`@babel/cli` がランタイム依存に紛れ込んでいる** — `npm:asana@3` の package.json バグ。バイナリサイズに影響する可能性。`deno compile` で問題化したら、独自 fetch クライアントへの切替を検討。
2. **`searchTasksForWorkspace` を使わない判断** — SDK には存在するが、eventual consistency と非標準ページネーションのため `getTasks` を必ず使う。誤って search を使うと dry-run と本実行の整合性が崩れる。
3. **`assignee` の更新は単一フィールド更新** — `updateTask({data:{assignee:to_gid}}, task_gid)`。`name` や他フィールドを誤って渡さない。`opt_fields` 省略時の挙動 / subtask 更新時の parent 副作用 / `assignee:null` 解除は未検証（[03_specifications.md の「S-012 補足」](03_specifications.md) 参照）。
4. **新アカウントの workspace 招待は人手** — ツールは member 確認のみ。R4 の事前検証で fail-fast。自動招待 API を呼ばない。
5. **PAT は短命運用** — README で「移行後 revoke」を推奨。長期保持はリスク。
6. **2026-05-27 時点で developers.asana.com に 503 障害** — 一次情報の参照が一時不能（2026-05-28 復旧確認）。
7. **非対話環境は想定外** — TTY 検出 / pipe 対応は実装不要。Asana CLI として人間が叩く前提。
8. **`getTasks` の `assignee` パラメータは単一識別子** — comma-separated は非対応（search の `assignee.any` とは異なる）。本ツールは 1 ユーザー対象なので問題なし。
9. **`opt_fields` の指定を忘れると assignee 情報が返らない** — 冪等性フィルタ (S-013) で `assignee.gid` を確認するため、`opt_fields:"name,gid,assignee.gid"` の指定は必須。
10. **subtask は `getTasks` のレスポンスに親と区別なく含まれる** (H-DOM3 確認済) — `/tasks/{gid}/subtasks` の追加走査は不要。`SubtaskMode` / `expandSubtasks` のフォールバックは削除済み (短命ツール・実機検証済みで YAGNI)。「subtask 対応が漏れているのでは?」と疑う必要なし。万一 Asana API の挙動が変わって subtask が getTasks から外れたら、`listSubtasks` ベースの BFS を再実装する。
11. **`npm:asana` の transitive dep `debug` が import 時 `Object.keys(process.env)` を呼ぶ** — `--allow-env=<specific>` の narrow permission では SDK の import が失敗する (`NotCapable: Requires env access`)。`src/main.ts` の lazy import は help/version/引数検証パスが SDK を読まずに済むようにするだけで、migration 本体では `src/asana_client.ts` が SDK を import した時点で同じ列挙が走り落ちる。narrow permission を維持する実 fix は `src/process_env_shim.ts`: SDK import の直前に `process.env` をプレーンオブジェクトへ差し替え、列挙・任意 read を通常の JS 操作にする (`src/asana_client.ts` の先頭で side-effect import)。**permission を緩める (`--allow-env` 全許可) のではなく、この shim と lazy import の分離を維持すること** (R9 / H-DENO1)。回帰固定は `tests/sdk_load.test.ts` (narrow permission の subprocess で SDK ロードを検証)。

## 上位へ戻る条件

要検証だった仮説は全て 2026-05-28 までに採択済み。残りの戻り条件は以下:

| 条件 | 戻る先 |
|---|---|
| 運用時に実 429 を観測し Retry-After が拾えないと判明 | 判断 7 を再開、独自 fetch クライアントへ切替 |
| `npm:asana@3` の挙動が想定と大きく異なる（他 API 呼び出しで判明） | 判断 7 を再開、独自 fetch クライアントへ切替 |
| 想定ユースケースが「複数ユーザー一括」に変わる | R2（判断 2）から見直し |
| Asana 側の制約が解消される | ツール廃止を検討 |

## 次に人間へ確認すべき判断分岐

- 要件分析フェーズは完了。次は **実装フェーズ**（別セッション）。
- 実装フェーズで顕在化する判断（例: バージョン番号体系、ファイル構成、テスト戦略）はそのセッションで扱う。
- 実装中の発見が要求 / 仕様レベルに影響する場合は、本ディレクトリへフィードバックする運用。

## 追加フェーズ: survey サブコマンド（2026-05-29）

移行残量を調べる読み取り専用の `survey` サブコマンドを追加する要求分析を実施。実装は本キャプセル上部の migrate と同じスタック・規約に従う。

### 確定事項（survey）

- `survey` サブコマンド。CLI はサブコマンド制に再構成し `migrate` / `survey` を明示必須（bare 廃止 = breaking、VERSION 0.2.0）。
- 指定 1 ドメインの email を持つアカウントが assignee の未完了タスク件数を集計（移行先マッピング不要）。
- 読み取り専用（`updateTask` 不使用）。アカウント別内訳（件数降順）+ 総計。人間可読 + `--json`、`--verbose`、`--quiet`。
- 集計は migrate と同一の `getTasks(completed_since=now)`（subtask 込み、H-DOM3 採択）。
- email 非可視ユーザーは件数を明示して続行（下限値の可能性を注記）。
- 組織固有値（ドメイン名・workspace GID）はコードにハードコードしない（C-016、`--domain` / `--workspace` 必須）。
- facade に `listWorkspaceUsers(ws): Promise<User[]>` を追加（`getUsers` + ページネーション、email 非可視は `email:""` センチネル）。

### 後工程で忘れると危険な文脈（survey）

1. `migrate` / `survey` タスクは broad `--allow-env` を使う。narrow `--allow-env=ASANA_ACCESS_TOKEN` だと transitive dep `debug` が import 時に `Object.keys(process.env)` で全 env を列挙して `NotCapable` で失敗するため（[H-DENO1](02_hypotheses.md) 参照）。narrow permission を復活させる（`debug` の shim 等）のは将来課題。
2. 要求分析時のアドホック調査 spike（移行残量調査）は本機能で supersede → 着地後に削除。
3. `CliArgs` 型は migrate 用。survey 用に `SurveyArgs` を新設（`migrator.ts` は `CliArgs` 依存のまま）。
4. 集計値は email 可視アカウントに対する下限になりうる（C-017）。実測の非可視数はコードに焼き込まない。

### survey の参照

- 要件 [R16〜R23](01_requirements.md) / 仕様 [S-019〜S-026](03_specifications.md) / 判断 [25〜28](06_decisions.md) / 設計選択 [10, 11](04_design_options.md) / 制約 [C-016, C-017](05_constraints.md) / 仮説 [H-VAL2, H-API7](02_hypotheses.md)

## 参照リンク

### このディレクトリ内
- [Overview](00_overview.md)
- [Requirements](01_requirements.md)
- [Hypotheses](02_hypotheses.md)
- [Specifications](03_specifications.md)
- [Design Options](04_design_options.md)
- [Constraints](05_constraints.md)
- [Decisions](06_decisions.md)

### プロジェクト内
- [README](../../README.md) — 仕様の宣言文書
- [spike/phase1_load.ts](../../spike/phase1_load.ts) — SDK 互換性スパイク

### 外部リソース
- [Asana Personal Access Token ガイド](https://developers.asana.com/docs/personal-access-token)
- [Asana 開発者コンソール](https://app.asana.com/0/my-apps)
- [Asana API リファレンス](https://developers.asana.com/reference)
- [Asana レート制限](https://developers.asana.com/docs/rate-limits)
- [`asana` npm パッケージ](https://www.npmjs.com/package/asana)
- [`Asana/node-asana` リポジトリ](https://github.com/Asana/node-asana)
