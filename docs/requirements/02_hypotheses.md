# 02 — 仮説マップと検証計画

## 仮説マップ

| ID | 層 | 仮説 | 根拠 | 状態 | 観測方法/エビデンス | 採択基準 | 棄却/見直し条件 | 判断者/確認先 |
|---|---|---|---|---|---|---|---|---|
| H-VAL1 | 価値 | 手動で 1 件ずつ assignee を変えるのは非現実的で、ツール化により所要時間が大幅短縮 | 移行対象が数十〜数百件あると人手では数時間〜数日 | 仮置き | 移行実施後のフィードバック | 1 ユーザー分の移行が分単位で完了 | 対象タスク数が常に数件以下と判明 | ikasam |
| H-BEH1 | 行動 | 実行者は IT 管理者または当該ユーザー本人で、PAT を発行できる権限を持つ | Asana の PAT は本人 / 管理者が発行可 | 採択 | 判断 13 で PAT を採用 | — | 利用組織で PAT 発行権限が無いと判明 | ikasam |
| H-DOM1 | ドメイン | Asana の `assignee` フィールドは単一ユーザー（複数 assign なし） | Asana 公式 API 仕様 | 確定 | API 型定義 / 公式 doc | — | — | Asana 公式 |
| H-DOM2 | ドメイン | 「新規作成アカウント」は対象 workspace の member になっているが、まだほぼ何も assign されていない状態 | 判断 4 の補足説明 | 採択 | 利用者からのヒアリング | — | 新アカウントが既に member 未登録のまま実行される | ikasam |
| H-DOM3 | ドメイン | Asana の subtask も `assignee` フィールドを持ち、`getTasks({workspace, assignee})` で親タスクと区別なく返る | Asana 公式 API 仕様 + 実機検証 | 採択 | 2026-05-28 Phase 2 スパイクで実機検証済: 別ユーザーに assign された未完了 subtask 2 件が、当該 assignee の `getTasks` 結果に両方含まれた (overlap=2/2) | — | — | — |
| H-INT1 | 相互作用 | dry-run → 確認 → 本実行 のフローが利用者にとって自然 | 破壊的操作の標準 UX | 仮置き | 実利用フィードバック | プロンプト承認率が高い | 利用者が常に `--yes` を使う / dry-run をスキップする | ikasam |
| H-API1 | 実装 | `/workspaces/{ws}/tasks/search` で assignee + completed フィルタが使える | Asana 公式 doc | 採択（ただし不採用に切替） | 型定義確認 | フィルタ可能 | — | — |
| H-API2 | 実装 | 上記 search API は Premium 以上のプラン限定 | Asana 公式 doc | 採択 | SDK 内 JSDoc + 公式 doc | プラン制限あり | — | Asana 公式 |
| H-API3 | 実装 | `usersApi.getUser(email)` で email を直接識別子として渡せる | SDK 型定義 | 採択 | UsersApi.d.ts 確認 | "me" / email / gid のいずれも受付 | — | — |
| H-API4 | 実装 | `tasksApi.getTasks({workspace, assignee, completed_since:"now"})` で strongly consistent に未完了タスクを取得できる | SDK 型定義 + Asana JSDoc 注記 + 実機検証 | 採択 | 2026-05-28 Phase 2 スパイクで確認: 全 sample item で `completed=false` かつ `assignee.gid` が populated | パラメータの組み合わせが API シグネチャに存在 | — | — |
| H-API5 | 実装 | `getTasks` は Free プランでも動く（Premium 限定ではない） | 一般的な Asana API の慣行（search は明示的に Premium 限定とドキュメント化されている一方、getTasks は無記載） + 実機検証 | 採択 | 2026-05-28 Phase 2 スパイクで実機検証済: 検証 workspace で 402 を返さず、結果が正常返却 | Free プランで実行成功 | — | — |
| H-API6 | 実装 | `usersApi.getUserForWorkspace(workspace, user)` が非メンバーで 404 を返す | 一般的な Asana API の慣行 + 実機検証 | 採択 | 2026-05-28 Phase 2 スパイクで実機検証済: 検証 workspace の非メンバー email に対し HTTP 404 を観測 | 非メンバーで明確なエラー | — | — |
| H-DENO1 | 実装 | `npm:asana@3` が Deno 2.x でロード可能で、ApiClient / 各種 Api クラスが構築できる | Phase 1 スパイクで実測 + 実装フェーズ検証 | 採択（補足あり） | spike/phase1_load.ts の出力 + 実装中に判明: transitive dep `debug@4.4.3` が import 時に `Object.keys(process.env)` を呼ぶため、`--allow-env=<specific>` の narrow permission では SDK の import 自体が失敗する。回避策として SDK 系を `await import()` で lazy 化し、CLI 引数検証 / help / version path を SDK ロード前に短絡する設計を採用 (`src/main.ts`)。**2026-05-29 追記**: lazy import は help/version path のコストを省くだけで、migration path では `src/asana_client.ts` が `import Asana from "asana"` を実行した時点で同じ `Object.keys(process.env)` が走り narrow permission 下で `NotCapable` になることが判明。narrow permission を維持する実 fix は SDK import 直前に `process.env` をプレーンオブジェクトへ差し替える shim (`src/process_env_shim.ts`) で、`src/asana_client.ts` の先頭で import する。`migrate` task の narrow permission で再現コマンドが NotCapable を出さず pre-check まで到達することを実機確認済み (`tests/sdk_load.test.ts` で回帰固定) | import / constructor が成功 + narrow env permission が維持可能 | — | — |
| H-DENO2 | 実装 | superagent ベースのエラーオブジェクトから 429 / Retry-After ヘッダーを取得できる | 一般的な superagent の挙動 + 実機検証 | 採択（補強） | 2026-05-28 Phase 2 スパイクで確認: 404 エラー発生時に `err.response.headers` が object として読み取れ、`content-type`, `content-length`, `connection`, `date`, `x-frame-options` 等のキーが含まれる (429 ケースでも同じ shape である見込み)。**2026-05-30 補強 (PR #3)**: 判断 23 の facade 正規化 (`AsanaApiErrorImpl`) が runner より手前で `response.headers` を破棄するため、生エラーから読めても runner には届かない。`normalizeError` が `retryAfterSec` を保持し `defaultRetryAfterExtractor` が優先読みする実装で解消 (未保持だと 429 が無言で指数バックオフに劣化。survey / migrate 両方に効いていた潜在不具合だった) | err.response.headers['retry-after'] が取れる + 正規化後も `retryAfterSec` で値が保持される | 実 429 を観測してから最終確認 (運用時) | — |
| H-DENO3 | 実装 | `deno compile` で npm:asana を含む単一バイナリを生成できる | Deno 2.x の npm 互換 + 実機検証 | 採択 | 2026-05-28 実機検証: `deno compile --allow-net=app.asana.com --allow-env --allow-read --output dist/asana-task-assign-migrator src/main.ts` で 92 MB の単一バイナリを生成。--help / --version / 引数バリデーション / PAT 未設定 / 実 API pre-check (workspace + getUser) まで全て動作 | バイナリが生成・実行可能 | — | — |
| H-VAL2 | 価値 | 移行残量をドメイン単位で可視化できると、移行の進捗把握・完了判断・優先順位付けに役立つ | survey 機能の動機（W-008） | 仮置き | 実利用フィードバック | 移行運用で「残りどれだけか」を即答できる | 残量把握が一度きりで継続価値が無いと判明 | ikasam |
| H-API7 | 実装 | `usersApi.getUsers({workspace, opt_fields})` で workspace 全ユーザーを email 付きで列挙できる（標準ページネーション） | SDK 型定義 + 実機検証 | 採択（補強） | 2026-05-29 実機検証: 714 ユーザーを列挙。ただし 97 ユーザーは email を返さず（PAT 可視性制約 → C-017） | 全ユーザーを列挙でき、大半で email 取得可 | email が全く取れない / ページネーションが破綻 | — |
| H-API8 | 実装 | `workspacesApi.getWorkspaces({opt_fields:"gid,name,is_organization,email_domains"})` が当該 PAT に対し organization の `email_domains` を返し、ドメイン照合で workspace を一意特定できる | Asana 公式 doc（`is_organization` は確認済、organization は会社を表す特別な workspace）+ 実機検証 | 採択 | 2026-05-30 実機検証: `listWorkspaces` が複数の organization を返し**いずれも `email_domains` 非空**、指定ドメインが正しい単一 gid に解決（`resolveWorkspace` で PASS）。別ドメインの兄弟 org とも誤マッチせず一意。本検証 PAT では C-018 の email_domains 非返却は発生せず | 指定ドメインで workspace を一意特定できる | `email_domains` が返らない（C-017 同様の可視性欠落）/ 同一ドメインが複数 workspace に跨る（**後者は実機未到達**: 検証環境では org ごとに domain が distinct で、兄弟 org が接頭辞付きの別ドメインを持っていても別 domain として衝突せず一意解決。Asana が PAT 可視範囲で domain 一意を保つなら R25 の multi-match 分岐は dead path の可能性 — 防御的に維持） | 実機 |
| H-DENO4 | 実装 | `import cfg from "../deno.json" with { type: "json" }` で得た version が `deno compile` の単一バイナリに同梱され、ランタイムの `--version` に反映される | Deno の static import は compile 対象に含まれる（JSON import 含む） | 要検証 | リリース自動化の実装時に 1 回 compile して `./dist/asana-task-assign-migrator --version` が deno.json の version と一致するか観測 | バイナリの `--version` 出力が deno.json の version と一致 | 同梱されない / 実行時に解決エラー → build 時に version 定数を生成する codegen にフォールバック（single source = deno.json は維持） | 実機 |

## 仮説検証計画

| 仮説ID | 検証タイミング | 観測対象 | 収集するエビデンス | 採択時の更新 | 棄却/保留時の更新 | 上位へ戻る条件 |
|---|---|---|---|---|---|---|
| H-API4 | 実装フェーズ初期 | 実 PAT で `getTasks` を叩いた結果 | レスポンス JSON / フィルタ結果の正確性 | 仕様 S-003 確定 | 検索戦略を再設計（[判断 15](06_decisions.md) を再開） | 判断 15 へ |
| H-API5 | 実装フェーズ初期 | Free プラン環境での `getTasks` 動作 | HTTP ステータス / レスポンス | プラン制約を撤廃 | プラン要件を Premium に戻し、README で明示 | 判断 8 を見直し |
| H-API6 | 実装フェーズ初期 | 非メンバー user に対する `getUserForWorkspace` の挙動 | HTTP ステータス / エラーボディ | R4 の事前検証ロジック確定 | 代替検証手段（`getUsersForWorkspace` で list して membership 判定など）を設計 | R4 の実装方式変更 |
| H-DENO2 | 実装フェーズ後半 | 429 受信時の SDK エラー構造 | エラーオブジェクトの shape | R8 のレート制限ハンドリング確定 | 自前 fetch クライアントへ切替 | 判断 7 を再開 |
| H-DENO3 | 配布形態決定時 | `deno compile` の出力と動作 | バイナリサイズ / 実行結果 | 配布形態を単一バイナリで確定 | `deno install` または `deno task` 経由の配布へ | 判断 7 周辺 |
| H-DOM3 | 実装フェーズ初期 | subtask に対する `getTasks` ヒット有無、`updateTask` の挙動 | レスポンス内容 | subtask 含むことが確認できれば [R1](01_requirements.md) と整合 | subtask が getTasks に出てこない場合は `/tasks/{gid}/subtasks` を別途走査 | R1 の実装方式変更 |
| H-INT1 | 利用フェーズ | プロンプト承認率 / `--yes` 使用率 | 利用者ヒアリング | UX 維持 | プロンプト省略やデフォルト動作を見直し | 判断 19e 再検討 |
| H-API7 | survey 実装時 | `getUsers` の email 返却率 | 列挙ユーザー数 / email 欠落数 | R20 の注記文言を確定 | email 欠落が多すぎる場合は別手段（`getUserForWorkspace` 個別）を検討 | 判断 27 を再開 |
| H-API8 | ドメイン解決の実装フェーズ初期（2026-05-30 採択済） | `GET /workspaces?opt_fields=gid,name,is_organization,email_domains` の返却内容 | 各 workspace の `is_organization` / `email_domains` | R24 のドメイン解決ロジックを確定（実機 PASS で確定済） | `email_domains` が返らなければドメイン解決を断念し GID 必須へ戻す（C-014 を維持）。複数一致なら R25 の列挙で人手に委ねる | 判断 29 を再開 |
| H-DENO4 | リリース自動化の実装フェーズ初期 | `deno compile` 後のバイナリの `--version` 出力 | バイナリ出力 vs deno.json の version | S-031 を確定（cli.ts の JSON import 採用） | build 時に version 定数を生成する codegen へ切替 | 判断 33 の「version の導出方法」を再検討（single source = deno.json は維持） |

## 仮説層と検証エビデンスの対応

- **価値**: リリース後の所要時間計測 / 利用者の自己評価
- **行動**: ヒアリング / 利用ログ
- **ドメイン**: Asana 公式 API 仕様 / 実機 API 応答
- **相互作用**: 利用者フィードバック / UX レビュー
- **実装**: 型定義 / 実機呼び出し / ベンチマーク

## 関連

- [要件](01_requirements.md)
- [制約](05_constraints.md)
- [判断履歴](06_decisions.md)
