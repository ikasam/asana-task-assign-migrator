# 03 — 仕様候補

要件 R1-R15 を満たすために、外部から観測可能な振る舞い・契約・状態・インターフェースを記述する。

## 仕様候補

| ID | 仕様 | 状態 | 関連要件 | 依存する仮説 | 採択基準 | 下位への制約 | 未決事項 |
|---|---|---|---|---|---|---|---|
| S-001 | CLI シグネチャ（必須 `--workspace`/`--from`/`--to`、オプション `--dry-run`/`--json`/`--quiet`/`--verbose`/`--yes`/`-h`/`-V`） | 確定 | R2, R5, R13, R14, R15 | — | 実装が同じシグネチャで動く | 全フラグの命名と短縮形を守る | — |
| S-002 | 環境変数 `ASANA_ACCESS_TOKEN` は必須。未設定時は exit 2 + ガイドリンク付きエラー | 確定 | R9, R12 | — | 未設定起動で exit 2 を観測 | — | — |
| S-003 | 実行フロー: Pre-checks → Task discovery → 冪等性フィルタ → 確認プロンプト → Execution → Reporting | 確定 | R1, R4, R5, R6, R7, R15 | H-API4, H-API6 | 各ステップが順序通り実行される | — | — |
| S-004 | dry-run 出力: 人間可読では workspace/from/to/件数/タスク一覧、`--json` では構造化 JSON | 確定 | R5 | — | サンプル出力と一致 | — | JSON スキーマの厳密化は実装時 |
| S-005 | 実行レポート: per-task `[N/M] gid name ✓/✗` + 末尾の Total/Success/Failed/Failures 一覧 | 確定 | R7 | — | サンプル出力と一致 | `--quiet` で per-task 行を省略 | — |
| S-006 | 終了コード: 0=全件成功 or 確認で N or dry-run / 1=一部失敗 / 2=実行前エラー | 確定 | R4, R7, R12, R15 | — | 各ケースで規定の exit code | — | — |
| S-007 | レート制限: 最低 400ms 間隔 + 429 で Retry-After 待機、最大 3 回再試行 | 仮置き | R8 | H-DENO2 | 150 req/min を超えない & 再試行で復帰 | — | superagent 経由で Retry-After が取れない場合は自前 fetch |
| S-008 | エラーストリーム規約: 進捗は stdout / エラーは stderr / `--json` は全 stdout で内部に errors キー | 確定 | R7, R13, R14 | — | リダイレクトで分離可能 | — | — |
| S-009 | 確認プロンプト: 本実行時のみ表示、Y/y または yes 入力で続行、他は中断 (exit 0)。`--yes` でスキップ | 確定 | R15 | — | プロンプトに従って分岐 | TTY 判定は実装しない（非対話環境は想定外） | — |
| S-010 | API シーケンス: `getWorkspace` → `getUser(from)` → `getUser(to)` → `getUserForWorkspace(ws, to)` → `getTasks` (paginated) → `updateTask` × N | 確定 | R1, R4, R6 | H-API3, H-API4, H-API6 | 各 API 呼び出しが規定順序で発生 | — | — |
| S-011 | `getTasks` 呼び出しパラメータ: `{workspace, assignee=from_user_gid, completed_since:"now", opt_fields:"name,gid,assignee.gid", limit:100}` + offset でページネーション | 確定 | R1, R6 | H-API4 | 全未完了タスクを取得 | — | — |
| S-012 | `updateTask` 呼び出し本体: `{ data: { assignee: to_user_gid } }` | 確定 | R1, R3 | — | assignee のみが書き換わる | follower / collaborator など他フィールドへの代入は禁止 | — |
| S-013 | 冪等性フィルタ: `getTasks` の戻り値で `assignee.gid === to_user_gid` のタスクは update 対象から除外 | 確定 | R6 | H-API4 | 2 回目実行で対象が 0 件 | — | — |
| S-014 | 確認プロンプトでの中断時挙動: exit 0、レポート出力なし | 確定 | R15 | — | プロンプトで `N` 入力時に exit 0 | — | — |
| S-015 | `--verbose` 出力先: stderr に curl-likeなリクエスト/レスポンスダンプ。本体出力（stdout）は変えない | 仮置き | R14 | H-DENO2 | デバッグ可能なログ詳細度 | — | フォーマット詳細は実装時 |
| S-016 | `--quiet` 出力: per-task 行と確認プロンプト前後の進捗装飾を抑制。最終 summary と失敗一覧は出す | 確定 | R13 | — | quiet 時の出力サンプルと一致 | — | — |
| S-017 | help / version: `-h`/`--help` で usage、`-V`/`--version` でセマンティックバージョン | 確定 | R2 | — | 標準フォーマット | — | バージョン番号体系は実装時 |
| S-018 | エラーメッセージ仕様: `Error: <reason>` + 解決ガイド（PAT 未設定なら R12 ドラフト文言） | 確定 | R12 | — | サンプル文言と一致 | — | — |

## CLI シグネチャ詳細（S-001）

```
asana-task-assign-migrator [OPTIONS]

REQUIRED:
  --workspace <gid>       対象 workspace の GID
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

## 終了コード（S-006）

| Code | 条件 |
|---|---|
| 0 | 全件成功 / dry-run 完了 / 確認プロンプトで N を選択 |
| 1 | 一部または全件のタスク更新に失敗（実行は試みた） |
| 2 | 実行前エラー（引数不正、ASANA_ACCESS_TOKEN 未設定、workspace / user not found、新アカウントが workspace の member でない、from == to） |

## 関連

- [要件](01_requirements.md)
- [仮説マップ](02_hypotheses.md)
- [README（仕様の宣言文書）](../../README.md)
