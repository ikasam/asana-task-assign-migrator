# 02 — 仮説マップと検証計画

## 仮説マップ

| ID | 層 | 仮説 | 根拠 | 状態 | 観測方法/エビデンス | 採択基準 | 棄却/見直し条件 | 判断者/確認先 |
|---|---|---|---|---|---|---|---|---|
| H-VAL1 | 価値 | 手動で 1 件ずつ assignee を変えるのは非現実的で、ツール化により所要時間が大幅短縮 | 移行対象が数十〜数百件あると人手では数時間〜数日 | 仮置き | 移行実施後のフィードバック | 1 ユーザー分の移行が分単位で完了 | 対象タスク数が常に数件以下と判明 | ikasam |
| H-BEH1 | 行動 | 実行者は IT 管理者または当該ユーザー本人で、PAT を発行できる権限を持つ | Asana の PAT は本人 / 管理者が発行可 | 採択 | 判断 13 で PAT を採用 | — | 利用組織で PAT 発行権限が無いと判明 | ikasam |
| H-DOM1 | ドメイン | Asana の `assignee` フィールドは単一ユーザー（複数 assign なし） | Asana 公式 API 仕様 | 確定 | API 型定義 / 公式 doc | — | — | Asana 公式 |
| H-DOM2 | ドメイン | 「新規作成アカウント」は対象 workspace の member になっているが、まだほぼ何も assign されていない状態 | 判断 4 の補足説明 | 採択 | 利用者からのヒアリング | — | 新アカウントが既に member 未登録のまま実行される | ikasam |
| H-DOM3 | ドメイン | Asana の subtask も `assignee` フィールドを持ち、親タスクとは独立して扱われる | Asana 公式 API 仕様 | 仮置き | 実機検証 | — | subtask に対する `updateTask` が想定外の挙動 | 実装フェーズで確認 |
| H-INT1 | 相互作用 | dry-run → 確認 → 本実行 のフローが利用者にとって自然 | 破壊的操作の標準 UX | 仮置き | 実利用フィードバック | プロンプト承認率が高い | 利用者が常に `--yes` を使う / dry-run をスキップする | ikasam |
| H-API1 | 実装 | `/workspaces/{ws}/tasks/search` で assignee + completed フィルタが使える | Asana 公式 doc | 採択（ただし不採用に切替） | 型定義確認 | フィルタ可能 | — | — |
| H-API2 | 実装 | 上記 search API は Premium 以上のプラン限定 | Asana 公式 doc | 採択 | SDK 内 JSDoc + 公式 doc | プラン制限あり | — | Asana 公式 |
| H-API3 | 実装 | `usersApi.getUser(email)` で email を直接識別子として渡せる | SDK 型定義 | 採択 | UsersApi.d.ts 確認 | "me" / email / gid のいずれも受付 | — | — |
| H-API4 | 実装 | `tasksApi.getTasks({workspace, assignee, completed_since:"now"})` で strongly consistent に未完了タスクを取得できる | SDK 型定義 + Asana JSDoc 注記 | 採択 | TasksApi.d.ts 確認 | パラメータの組み合わせが API シグネチャに存在 | 実機で空配列しか返らない、または filter 効かない | 実装フェーズで確認 |
| H-API5 | 実装 | `getTasks` は Free プランでも動く（Premium 限定ではない） | 一般的な Asana API の慣行（search は明示的に Premium 限定とドキュメント化されている一方、getTasks は無記載） | 要検証 | 実機テストで 402 が返らないこと | Free プランで実行成功 | 402 / 権限エラーが返る | 実装フェーズで確認 |
| H-API6 | 実装 | `usersApi.getUserForWorkspace(workspace, user)` が非メンバーで 404 を返す | 一般的な Asana API の慣行 | 要検証 | 実機テストで 404 を確認 | 非メンバーで明確なエラー | 200 が返って member 判定できない | 実装フェーズで確認 |
| H-DENO1 | 実装 | `npm:asana@3` が Deno 2.x でロード可能で、ApiClient / 各種 Api クラスが構築できる | Phase 1 スパイクで実測 | 採択 | spike/phase1_load.ts の出力 | import / constructor が成功 | — | — |
| H-DENO2 | 実装 | superagent ベースのエラーオブジェクトから 429 / Retry-After ヘッダーを取得できる | 一般的な superagent の挙動 | 要検証 | 実機で 429 を観測したときに ResponseError から header が読めるか | err.response.headers['retry-after'] が取れる | SDK 内で 429 が完全に吸収されて見えない | 実装フェーズで確認 |
| H-DENO3 | 実装 | `deno compile` で npm:asana を含む単一バイナリを生成できる | Deno 2.x の npm 互換 | 要検証 | 試行 | バイナリが生成・実行可能 | 生成失敗 / 実行時エラー | 配布形態決定時 |

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
