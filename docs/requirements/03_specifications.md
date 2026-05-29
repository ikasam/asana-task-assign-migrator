# 03 — 仕様候補

要件 R1-R15 を満たすために、外部から観測可能な振る舞い・契約・状態・インターフェースを記述する。

## 仕様候補

| ID | 仕様 | 状態 | 関連要件 | 依存する仮説 | 採択基準 | 下位への制約 | 未決事項 |
|---|---|---|---|---|---|---|---|
| S-001 | CLI シグネチャ（必須 `--workspace`/`--from`/`--to`、オプション `--dry-run`/`--json`/`--quiet`/`--verbose`/`--yes`/`-h`/`-V`）。`--workspace` は GID（数値）またはドメイン名を受け付ける（解決は [S-027](#workspace-指定のドメイン解決2026-05-30-追加s-027)） | 確定 | R2, R5, R13, R14, R15, R24 | H-API8 | 実装が同じシグネチャで動く | 全フラグの命名と短縮形を守る | — |
| S-002 | 環境変数 `ASANA_ACCESS_TOKEN` は必須。未設定時は exit 2 + ガイドリンク付きエラー | 確定 | R9, R12 | — | 未設定起動で exit 2 を観測 | — | — |
| S-003 | 実行フロー: Pre-checks → Task discovery → 冪等性フィルタ → 確認プロンプト → Execution → Reporting | 確定 | R1, R4, R5, R6, R7, R15 | H-API4, H-API6 | 各ステップが順序通り実行される | — | — |
| S-004 | dry-run 出力: 人間可読では workspace/from/to/件数/タスク一覧、`--json` では構造化 JSON | 確定 | R5 | — | サンプル出力と一致 | — | JSON スキーマの厳密化は実装時 |
| S-005 | 実行レポート: per-task `[N/M] gid name ✓/✗` + 末尾の Total/Success/Failed/Failures 一覧 | 確定 | R7 | — | サンプル出力と一致 | `--quiet` で per-task 行を省略 | — |
| S-006 | 終了コード: 0=全件成功 or 確認で N or dry-run / 1=一部失敗 / 2=実行前エラー | 確定 | R4, R7, R12, R15 | — | 各ケースで規定の exit code | — | — |
| S-007 | レート制限: 最低 400ms 間隔 + 429 で Retry-After 待機、最大 3 回再試行 | 仮置き | R8 | H-DENO2 | 150 req/min を超えない & 再試行で復帰 | — | superagent 経由で Retry-After が取れない場合は自前 fetch |
| S-008 | エラーストリーム規約: 進捗は stdout / エラーは stderr / `--json` は全 stdout で内部に errors キー | 確定 | R7, R13, R14 | — | リダイレクトで分離可能 | — | — |
| S-009 | 確認プロンプト: 本実行時のみ表示、Y/y または yes 入力で続行、他は中断 (exit 0)。`--yes` でスキップ | 確定 | R15 | — | プロンプトに従って分岐 | TTY 判定は実装しない（非対話環境は想定外） | — |
| S-010 | API シーケンス: `getWorkspace` → `getUser(from)` → `getUser(to)` → `getUserForWorkspace(ws, to)` → `getTasks` (paginated) → `updateTask` × N | 確定 | R1, R4, R6 | H-API3, H-API4, H-API6 | 各 API 呼び出しが規定順序で発生 | — | — |
| S-011 | `getTasks` 呼び出しパラメータ: `{workspace, assignee=from_user_gid, completed_since:"now", opt_fields:"name,gid,assignee.gid", limit:100}` + offset でページネーション。**subtask も親 task と区別なく同じレスポンスに含まれるため、`/tasks/{gid}/subtasks` の追加走査は不要** (H-DOM3 確認済) | 確定 | R1, R6 | H-API4, H-DOM3 | 全未完了タスクを取得 (subtask 含む) | — | — |
| S-012 | `updateTask` 呼び出し本体: `{ data: { assignee: to_user_gid } }` | 確定 | R1, R3 | — | assignee のみが書き換わる | follower / collaborator など他フィールドへの代入は禁止 | — (補足は本ファイル下部の「S-012 補足」参照) |
| S-013 | 冪等性フィルタ: `getTasks` の戻り値で `assignee.gid === to_user_gid` のタスクは update 対象から除外 | 確定 | R6 | H-API4 | 2 回目実行で対象が 0 件 | — | — |
| S-014 | 確認プロンプトでの中断時挙動: exit 0、レポート出力なし | 確定 | R15 | — | プロンプトで `N` 入力時に exit 0 | — | — |
| S-015 | `--verbose` 出力先: stderr に `> METHOD URL` / `< STATUS` 形式の 1 リクエスト 2 行ダンプ。本体出力（stdout）は変えない | 確定 | R14 | — | デバッグ可能なログ詳細度 | — | — |
| S-016 | `--quiet` 出力: per-task 行と確認プロンプト前後の進捗装飾を抑制。最終 summary と失敗一覧は出す | 確定 | R13 | — | quiet 時の出力サンプルと一致 | — | — |
| S-017 | help / version: `-h`/`--help` で usage、`-V`/`--version` でセマンティックバージョン | 確定 | R2 | — | 標準フォーマット | — | バージョン番号体系は実装時 |
| S-018 | エラーメッセージ仕様: `Error: <reason>` + 解決ガイド（PAT 未設定なら R12 ドラフト文言） | 確定 | R12 | — | サンプル文言と一致 | — | — |

## CLI シグネチャ詳細（S-001）

```
asana-task-assign-migrator [OPTIONS]

REQUIRED:
  --workspace <gid|domain>  対象 workspace の GID、またはドメイン名（例 example.com）。
                            ドメインのときは email_domains 照合で GID に解決（S-027）
  --from <email>          旧アカウントの email
  --to <email>            新アカウントの email

OPTIONS:
  --dry-run               実 API 更新を行わず、対象タスク一覧を出力
  --json                  出力を JSON 形式に切替
  --quiet                 進捗行を省略し、最終 summary のみ出力
  --verbose               API リクエスト/レスポンス詳細を stderr に出力
  --yes                   実行前の確認プロンプトをスキップ
  -h, --help              ヘルプを表示
  -V, --version           バージョン表示

ENV:
  ASANA_ACCESS_TOKEN      Required. Personal Access Token
```

### フラグ間の優先順位 / 共存ルール

- `--dry-run` + `--yes`: `--yes` は本実行の確認プロンプトに対するもの。dry-run 時は何もしない（無害）
- `--quiet` + `--json`: `--json` は出力フォーマット、`--quiet` は per-task 行抑制。`--json` 時は per-task 配列が出るが、その粒度の verbose/quiet 切替は将来課題（実装簡素化のため `--quiet` は人間可読モードでのみ意味を持つ）
- `--quiet` + `--verbose`: 直交。stdout は quiet、stderr は verbose
- 不正な組み合わせ（例: `--dry-run --yes` で `--yes` が無意味）はエラーにせず黙って受理（OS の CLI 慣行）

## 実行フロー詳細（S-003）

```
[Pre-checks]
  1. CLI 引数の必須項目 / フォーマット検証
  2. ASANA_ACCESS_TOKEN の存在確認 → 未設定なら exit 2
  3. from != to の検証（同一 email なら exit 2）
  4. workspacesApi.getWorkspace(workspace_gid)
     → 失敗なら exit 2「workspace not found or no access」
  5. usersApi.getUser(from_email)
     → 失敗なら exit 2「from user not found」
  6. usersApi.getUser(to_email)
     → 失敗なら exit 2「to user not found」
  7. usersApi.getUserForWorkspace(workspace_gid, to_email)
     → 404 等で失敗なら exit 2「to user is not a member of the workspace」

[Task discovery]
  8. tasksApi.getTasks({workspace, assignee=from_gid, completed_since:"now",
                       opt_fields:"name,gid,assignee.gid", limit:100})
  9. offset で次ページを取得、すべてのタスクを集約

[冪等性フィルタ]
 10. assignee.gid === to_gid のタスクを除外

[Dry-run 分岐]
 11. --dry-run なら結果を出力して exit 0

[確認プロンプト]
 12. --yes 未指定なら確認プロンプト表示
     - y / Y / yes で続行
     - その他で exit 0（中断、レポート出力なし）

[Execution]
 13. 各タスクを直列で updateTask({data:{assignee:to_gid}})
     - 成功は success リストに追加
     - エラー（4xx 等）は failures リストに記録して継続
     - 429 Too Many Requests:
         * Retry-After ヘッダーがあれば +1 秒待機
         * なければ exponential backoff (2/4/8s)
         * 最大 3 回試行
 14. 各リクエスト後に最低 400ms のインターバル

[Reporting]
 15. Total/Success/Failed の summary を出力
 16. failed があれば失敗一覧を出力
 17. exit code: failures.length > 0 ? 1 : 0
```

## dry-run 出力サンプル（S-004）

### 人間可読

```
=== Asana Task Assignee Migration (DRY RUN) ===

Workspace : My Company (gid: 1234567890)
From      : old.user@example.com (Old User, gid: 111)
To        : new.user@example.com (New User, gid: 222)  ✓ member of workspace

Discovering incomplete tasks assigned to old.user@example.com...
Found 47 tasks.

  [ 1] 9876543210  Q2 planning document
  [ 2] 9876543211  Review onboarding flow
  ...
  [47] 9876543299  Update docs

DRY RUN: no changes were made.
Re-run without --dry-run to execute migration.
```

### JSON

```json
{
  "mode": "dry-run",
  "workspace": { "gid": "1234567890", "name": "My Company" },
  "from":      { "email": "old.user@example.com", "gid": "111", "name": "Old User" },
  "to":        { "email": "new.user@example.com", "gid": "222", "name": "New User", "isMember": true },
  "tasks":     [
    { "gid": "9876543210", "name": "Q2 planning document" },
    { "gid": "9876543211", "name": "Review onboarding flow" }
  ],
  "count": 47
}
```

## 実行レポート出力サンプル（S-005）

### 人間可読

```
=== Asana Task Assignee Migration ===

Workspace : My Company (gid: 1234567890)
From      : old.user@example.com → To: new.user@example.com

Discovering tasks... 47 found.
Migrating 47 tasks...

  [ 1/47] 9876543210  Q2 planning document             ✓
  [ 2/47] 9876543211  Review onboarding flow           ✓
  [ 3/47] 9876543212  Bug: search returns 500          ✗ HTTP 403 not_authorized
  ...
  [47/47] 9876543299  Update docs                      ✓

Done.
  Total    : 47
  Success  : 45
  Failed   : 2

Failures:
  9876543212  Bug: search returns 500     HTTP 403 not_authorized
  9876543220  Production hotfix           HTTP 500 server_error

Re-run the same command to retry failed tasks (idempotent).
```

### JSON

```json
{
  "mode": "execute",
  "workspace": { "gid": "1234567890", "name": "My Company" },
  "from": { "email": "old.user@example.com", "gid": "111" },
  "to":   { "email": "new.user@example.com", "gid": "222" },
  "summary": { "total": 47, "success": 45, "failed": 2 },
  "results": [
    { "gid": "9876543210", "name": "Q2 planning document", "status": "success" },
    {
      "gid": "9876543212",
      "name": "Bug: search returns 500",
      "status": "failed",
      "error": { "httpStatus": 403, "code": "not_authorized", "message": "..." }
    }
  ]
}
```

## S-012 補足: live 検証結果と未検証論点

2026-05-28 のライブ本実行で 37 件 100% 成功を観測し、`updateTask` の挙動について確定した部分と未検証の部分を分けて記録する。

### 確定済み（live で観測）

- 呼び出し: `tasksApi.updateTask({ data: { assignee: to_user_gid } }, task_gid, { opt_fields: "gid,assignee.gid" })` が 37 回 2xx を返した（[src/asana_client.ts](../../src/asana_client.ts) の `updateTaskAssignee` 関数）。
- 戻り値の `assignee.gid` が `to_user_gid` と一致するため、後続の冪等性フィルタ（S-013）が機能する。
- subtask に対しても同じ body 形状で更新できる（subtask は `getTasks` のレスポンスに親 task と区別なく含まれるため、subtask 専用の更新パスは不要 — H-DOM3 採択）。

### 未検証（運用上は不要だが、将来の知見として）

| 論点 | 現状 | 検証する場合の方針 |
|---|---|---|
| `opt_fields` を省略した場合の挙動 | live では常に `opt_fields:"gid,assignee.gid"` を付与しており未検証。SDK の OpenAPI 自動生成型は `opt_fields` を optional にしているが、省略時に何が返るかは未確認 | spike スクリプトで `tasksApi.updateTask({data:{assignee:to_gid}}, gid)` を 1 回叩いて response body を確認 |
| subtask 更新が parent.updated_at に影響するか | 本ツールでは subtask も普通に `updateTask` するが、parent への副作用（`updated_at` の伝播、通知の発火）は未観測 | parent と subtask の `updated_at` を更新前後で比較 |
| `assignee: null` で解除できるか | 本ツールでは常に `to_user_gid` を渡すため不要。Asana API リファレンスでは `assignee` を `null` にできる旨が記載されているが、SDK 経由での挙動は未確認 | 検証用 task で `tasksApi.updateTask({data:{assignee:null}}, gid)` を叩いて response の `assignee` を確認 |

これらは現状の運用要件（指定 from → to の付け替え）には不要で、検証コストを払う必要はない。Asana API の挙動が想定と異なる兆候（例えば subtask 更新で parent に望ましくない通知が飛ぶ等）が顕在化したら、上記のいずれかを spike で確認する。

## 終了コード（S-006）

| Code | 条件 |
|---|---|
| 0 | 全件成功 / dry-run 完了 / 確認プロンプトで N を選択 |
| 1 | 一部または全件のタスク更新に失敗（実行は試みた） |
| 2 | 実行前エラー（引数不正、ASANA_ACCESS_TOKEN 未設定、workspace / user not found、新アカウントが workspace の member でない、from == to） |

## survey サブコマンド仕様（2026-05-29 追加）

移行残量を調べる読み取り専用サブコマンド。要件 [R16〜R23](01_requirements.md) を満たす。

| ID | 仕様 | 状態 | 関連要件 | 依存する仮説 | 採択基準 | 下位への制約 | 未決事項 |
|---|---|---|---|---|---|---|---|
| S-019 | CLI はサブコマンド制（`migrate` / `survey`）。サブコマンドは明示必須で、無指定/未知サブコマンドは exit 2。`-h`/`--help`・`-V`/`--version` は top-level。破壊的変更のため VERSION を 0.2.0 に上げる | 確定 | R16 | — | サブコマンド分岐が動く | bare 呼び出し（旧 migrate）は廃止 | per-subcommand help の粒度 |
| S-020 | `survey` 引数: `--workspace <gid\|domain>`（必須。数値=GID、非数値=ドメインとして解決 [S-027]）/ `--domain <domain>`（必須。集計対象の **assignee** ドメイン。`--workspace` のドメインとは役割が異なる）/ `--json` / `--verbose` / `--quiet`。domain 妥当性は「`@`・空白を含まず、少なくとも 1 つのドット区切りラベルを持つ」こと、lowercase 正規化、先頭 `@` は許容して除去（`--workspace` のドメイン値にも同じ正規化を適用） | 確定 | R16, R24 | H-API8 | 不正値で exit 2 | migrate 専用フラグ（`--from`/`--to`/`--dry-run`/`--yes`）は survey では Unknown option | — |
| S-021 | survey 実行フロー: pre-check（`getWorkspace`）→ 全ユーザー列挙 → domain フィルタ → 対象ごとに未完了タスク件数集計（per-account エラーは記録して継続）→ 件数降順でレンダリング | 確定 | R17, R18, R19, R23 | H-API7, H-API4 | 各ステップが順序通り実行 | — | — |
| S-022 | survey API シーケンス: `getWorkspace` → `getUsers`（paginated）→ `getTasks({assignee, completed_since:"now"})` × 対象数。`updateTask` は呼ばない | 確定 | R18, R21 | H-API4, H-API7, H-DOM3 | 規定順序で API 発生、更新系を呼ばない | — | — |
| S-023 | survey 出力: 人間可読では workspace / domain / 総ユーザー数 / 対象数 / email 非可視数の注記 / アカウント別（件数降順）/ サマリ。`--json` では構造化 JSON | 確定 | R19, R20, R22 | — | サンプル出力と一致 | `--quiet` は内訳を省きサマリのみ | — |
| S-024 | survey 終了コード: 2=使用法/pre-check 失敗 / 1=完了したが per-account エラーあり / 0=正常完了 | 確定 | R23 | — | 各ケースで規定の exit code | — | — |
| S-025 | facade 拡張: `listWorkspaceUsers(workspaceGid): Promise<User[]>`（`getUsers` + ページネーション）。email 非可視ユーザーは `email:""` をセンチネルにし、survey 側で非可視と判定 | 確定 | R17, R20 | H-API7 | 全ユーザーを flat array で返す | — | — |
| S-026 | survey は読み取り専用契約: `updateTaskAssignee` を含む更新系を一切呼ばない | 確定 | R21 | — | コード上 update 呼び出しが無い | — | — |

### survey CLI シグネチャ（S-019 / S-020）

```
asana-task-assign-migrator <subcommand> [OPTIONS]

SUBCOMMANDS:
  migrate    旧→新アカウントの assignee 付け替え（既存）
  survey     指定ドメインの未移行（未完了かつ当該ドメインが assignee）タスク件数を集計（読み取り専用）

survey OPTIONS:
  --workspace <gid|domain>  対象 workspace の GID またはドメイン名（必須）。
                            ドメインは email_domains 照合で GID 解決（S-027）
  --domain <domain>   集計対象の assignee ドメイン（必須、例 example.com）。
                      ↑ --workspace のドメイン（= org の特定）とは役割が別
  --json              出力を JSON 形式に切替
  --verbose           API リクエスト/レスポンス詳細を stderr に出力
  --quiet             アカウント別内訳を省略しサマリのみ
```

### survey 出力サンプル（S-023）

#### 人間可読

```
=== Unmigrated-task survey ===
workspace : My Company (1234567890)
domain    : @example.com

workspace has 714 user(s); 43 match @example.com.
  note: 97 user(s) returned no email (PAT lacks visibility) — they cannot be domain-classified.

Incomplete tasks still assigned to @example.com accounts:

     62  Alice Example <alice@example.com>
     30  Bob Example <bob@example.com>
     ...
      0  Carol Example <carol@example.com>

=== Summary ===
domain accounts            : 43
  of which with tasks      : 27
unmigrated incomplete tasks : 301
```

#### JSON

```json
{
  "mode": "survey",
  "workspace": { "gid": "1234567890", "name": "My Company" },
  "domain": "example.com",
  "totalUsers": 714,
  "emailInvisibleUsers": 97,
  "matchedAccounts": 43,
  "accountsWithTasks": 27,
  "totalIncompleteTasks": 301,
  "accounts": [
    {
      "gid": "111", "name": "Alice Example", "email": "alice@example.com", "count": 62,
      "tasks": [ { "gid": "9876543210", "name": "Q2 planning document", "assigneeGid": "111" } ]
    }
  ],
  "erroredAccounts": 0
}
```

## workspace 指定のドメイン解決（2026-05-30 追加、S-027）

migrate / survey 共通の `--workspace` 値解決ロジック。要件 [R24, R25](01_requirements.md)、判断 [29, 30](06_decisions.md)、制約 [C-014（緩和）, C-018](05_constraints.md)、仮説 [H-API8](02_hypotheses.md) を満たす。

| ID | 仕様 | 状態 | 関連要件 | 依存する仮説 | 採択基準 | 下位への制約 | 未決事項 |
|---|---|---|---|---|---|---|---|
| S-027 | `--workspace` 値の解決: (1) `/^[0-9]+$/` に一致すれば GID 直指定として従来どおり扱う。(2) 一致しなければドメイン名とみなし、lowercase 正規化・先頭 `@` 除去（S-020 と同じ正規化）。(3) `workspacesApi.getWorkspaces({opt_fields:"gid,name,is_organization,email_domains"})` を取得し、`email_domains` に当該ドメインを含む workspace を選択。(4) 一意に解決できたらその GID で既存の `getWorkspace` pre-check に合流。0 件 / 複数件は exit 2 で、可視 workspace（GID・name・email_domains）を列挙して案内（R25）。解決は PAT 認証下で行う（追加トークン不要） | 確定 | R24, R25 | H-API8 | 数値=GID 直通 / ドメイン=一意解決 / 0・複数件で exit 2 + 列挙 | facade に `resolveWorkspace(input): Promise<{gid, name}>`（または `listWorkspaces()`）を追加。組織固有値はハードコードしない（C-016） | `email_domains` 非返却時の挙動（H-API8 棄却条件 → GID 必須へ戻す） |

### 解決フロー（S-027）

```
--workspace の値 input
  ├─ /^[0-9]+$/ に一致 → GID として getWorkspace(input) へ（従来パス、API 1 回節約）
  └─ 非数値 → normalizeDomain(input)
        → getWorkspaces(opt_fields=gid,name,is_organization,email_domains)
        → email_domains.includes(domain) で絞り込み
            ├─ 1 件 → その gid で getWorkspace 合流
            ├─ 0 件 → exit 2「ドメイン <d> に一致する workspace が見つかりません」+ 可視 workspace 列挙
            └─ 2 件以上 → exit 2「ドメイン <d> が複数 workspace に一致」+ 該当 workspace 列挙（GID 直指定を案内）
```

### エラーメッセージ例（R25 / S-027）

```
error: no workspace found for domain "example.com".
  Visible workspaces (use --workspace <gid> directly):
    1234567890  My Company        [example.com]
    9876543210  Personal          (not an organization, no domain)
```

## 関連

- [要件](01_requirements.md)
- [仮説マップ](02_hypotheses.md)
- [README（仕様の宣言文書）](../../README.md)
