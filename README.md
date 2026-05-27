# asana-task-assign-migrator

Asana で旧アカウントが担当者になっている未完了タスクの担当者を、新アカウントに一括で付け替える CLI ツール。

> [!NOTE]
> このツールは Asana の企業ドメイン管理アカウントが、別企業ドメインのアカウントへ移行・統合できないという Asana 側の制約を回避するためのものです。本来は Asana 側で自然に移行されるのが望ましく、当ツールは Asana の改善により不要になることが望ましい短命ツールです。

## 想定ユースケース

- Asana アカウントの移行先が **新規作成された別アカウント** に限定される場合
- 旧アカウントが assignee の未完了タスクを、新アカウントに付け替えたい
- 1 ユーザーの移行 = 1 回の実行（複数ペアの一括処理は非対応）

## 前提

- [Deno](https://deno.com/) 2.x がインストール済み
- 対象 workspace の Asana Personal Access Token (PAT) が発行可能
- 新アカウントが対象 workspace の member として **事前に追加済み**（招待は人手）
- 旧アカウントが assignee の未完了タスクのみ移行対象（subtask 含む）
- assignee 以外（follower, collaborator, コメント著者など）は変更しない

## Personal Access Token (PAT) の準備

このツールは Asana の Personal Access Token を用いて API にアクセスします。実行前に PAT を発行してください。

### 発行手順

1. [Asana 開発者コンソール](https://app.asana.com/0/my-apps) を開く
   （または Asana にログイン → プロフィール写真 → **My Settings** → **Apps** → **Manage Developer Apps**）
2. **Personal access tokens** セクションで **+ Create new token** をクリック
3. トークンに識別しやすい名前を付ける（例: `asana-task-assign-migrator`）
4. **トークンは生成画面で 1 度しか表示されません**。即座にコピーしてください
5. コピーしたトークンを環境変数 `ASANA_ACCESS_TOKEN` に設定

```sh
export ASANA_ACCESS_TOKEN="<paste-your-token-here>"
```

### 失効

同じ開発者コンソールから revoke 可能です。**移行作業完了後は revoke することを推奨します。**

詳細は Asana 公式ドキュメント: <https://developers.asana.com/docs/personal-access-token>

## Usage

```
asana-task-assign-migrator [OPTIONS]

REQUIRED:
  --workspace <gid>          対象 workspace の GID
  --from <email>             旧アカウントの email
  --to <email>               新アカウントの email

OPTIONS:
  --dry-run                  実 API 更新を行わず、対象タスク一覧を出力
  --json                     出力を JSON 形式に切替
  --quiet                    進捗行を省略し、最終 summary のみ出力
  --verbose                  API リクエスト/レスポンス詳細を stderr に出力
  --yes                      実行前の確認プロンプトをスキップ
  -h, --help                 ヘルプを表示
  -V, --version              バージョン表示

ENVIRONMENT VARIABLES:
  ASANA_ACCESS_TOKEN         Required. Personal Access Token
                             発行: https://app.asana.com/0/my-apps
```

### workspace GID の取得方法

Asana にブラウザでログインし、対象 workspace のタスク一覧を開きます。URL の `/0/<gid>/...` の部分にある数値が workspace GID です。

## 実行例

### 1. dry-run で対象タスクを確認

```sh
asana-task-assign-migrator \
  --workspace 1234567890 \
  --from old.user@example.com \
  --to   new.user@example.com \
  --dry-run
```

出力例:

```
=== Asana Task Assignee Migration (DRY RUN) ===

Workspace : My Company (gid: 1234567890)
From      : old.user@example.com (Old User, gid: 111)
To        : new.user@example.com (New User, gid: 222)  ✓ member of workspace

Discovering incomplete tasks assigned to old.user@example.com...
Found 47 tasks.

  [ 1] 9876543210  Q2 planning document
  [ 2] 9876543211  Review onboarding flow
  [ 3] 9876543212  Bug: search returns 500
  ...
  [47] 9876543299  Update docs

DRY RUN: no changes were made.
Re-run without --dry-run to execute migration.
```

### 2. 本実行

```sh
asana-task-assign-migrator \
  --workspace 1234567890 \
  --from old.user@example.com \
  --to   new.user@example.com
```

確認プロンプトが表示されます:

```
About to update assignee for 47 tasks in workspace "My Company".
  From: old.user@example.com (Old User)
  To:   new.user@example.com (New User)

Continue? [y/N]:
```

`y` を入力すると実行が始まります。`--yes` フラグを付与すると確認をスキップできます。

出力例:

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

### 3. JSON 形式での実行

```sh
asana-task-assign-migrator \
  --workspace 1234567890 \
  --from old.user@example.com \
  --to   new.user@example.com \
  --dry-run --json
```

```json
{
  "mode": "dry-run",
  "workspace": { "gid": "1234567890", "name": "My Company" },
  "from": { "email": "old.user@example.com", "gid": "111", "name": "Old User" },
  "to":   { "email": "new.user@example.com", "gid": "222", "name": "New User", "isMember": true },
  "tasks": [
    { "gid": "9876543210", "name": "Q2 planning document" },
    { "gid": "9876543211", "name": "Review onboarding flow" }
  ],
  "count": 47
}
```

## 動作仕様

### 実行フロー

1. **Pre-checks**: 引数 / 環境変数 / `from != to` / workspace 実在 / 旧ユーザー取得 / 新ユーザー取得 / 新ユーザーの workspace member 確認
2. **Task discovery**: `getTasks({workspace, assignee, completed_since:"now"})` でページネーション走査 (strongly consistent)
3. **冪等性確認**: 既に新アカウントが assignee のタスクは除外
4. **確認プロンプト**: 本実行の場合のみ
5. **Execution**: 各タスクに `updateTask({data:{assignee:to_gid}})` を直列実行
6. **Reporting**: 成功・失敗の summary を出力

### 冪等性

同じ引数で複数回実行しても安全です。2 回目の実行では既に新アカウントが assignee のタスクは対象外になります。失敗したタスクのみ再試行する目的でも再実行できます。

### レート制限

Asana の Personal Access Token は **150 requests/minute** のレート制限があります。本ツールは制限を超えないようリクエスト間隔を制御します。`429 Too Many Requests` を受信した場合は `Retry-After` ヘッダーに従って待機し、最大 3 回再試行します。

### エラーハンドリング

個別タスクの更新エラーは記録のうえ実行を継続し、最後にまとめてレポートします。`--quiet` モードでも失敗一覧は表示されます。

## 終了コード

| Code | 条件 |
|---|---|
| 0 | 全件成功 / dry-run 完了 / 確認プロンプトで `N` を選択 |
| 1 | 一部または全件のタスク更新に失敗（実行は試みた） |
| 2 | 実行前エラー（引数不正、`ASANA_ACCESS_TOKEN` 未設定、workspace / user not found、新アカウントが workspace の member でない、`from == to`） |

## 制限事項

- **`--workspace` は GID 必須**: workspace 名による指定は同名 workspace の曖昧性を避けるため非対応
- **`--from`/`--to` は email 必須**: GID 指定は不可
- **1 実行 = 1 ユーザー**: 複数ペアの一括処理は非対応
- **対話環境必須**: パイプや CI など非対話環境での実行は想定外
- **assignee のみ変更**: follower / collaborator / コメント著者・添付ファイルなどは変更しない
- **新アカウントの workspace 招待は手作業**: 招待 API は本ツールでは実行しない

## ライセンス

未定。

---

このツールは [@ikasam](https://github.com/ikasam) によるものです。
