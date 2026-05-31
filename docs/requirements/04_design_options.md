# 04 — 設計案比較

各設計選択について、検討した候補と採否を記録する。「なぜこの設計なのか」「なぜ他案ではダメだったのか」を後工程が理解できるようにする。

## 設計選択 1: 認証方式

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| **A. PAT (採用)** | Personal Access Token を環境変数で受け取る | R9 | — | PAT の手動発行・revoke | 長期トークンが流出すると危険 → README で「移行後 revoke」を案内 | — |
| B. OAuth 2.0 Authorization Code + PKCE (localhost callback) | ブラウザでサインインして一時トークンを取得 | R9 を更新する場合に成立 | 公式に localhost redirect が許可されていない | アプリ登録 / client_secret 埋め込み | localhost callback が動かないリスク / secret 埋め込みアンチパターン | localhost callback が実機で動くか |
| C. OAuth 2.0 Authorization Code + OOB (手動コピペ) | `urn:ietf:wg:oauth:2.0:oob` を redirect とし、表示されたコードをユーザーが貼り付け | R9 を更新する場合に成立 | アプリ登録 / client_secret 埋め込み 必須 | 配布バイナリへの secret 埋め込み | 短命ツールに対し過剰な運用負荷 / secret 真正性消失 | — |
| D. PAT と OAuth の両対応 | 環境変数があれば PAT、なければ OAuth | R9 拡張版 | 実装量が 2 倍 | 同上 | YAGNI に反する | — |

**採用: A**
**理由**: 短命ツールに対する複雑度コストが OAuth では正当化できない。PAT は発行〜利用〜revoke が一連のユーザー作業として閉じる。Asana 側の `client_secret` 必須仕様（PKCE でも省略不可）と localhost callback の非サポート明示を踏まえ、UX 改善幅も限定的。

参照: [判断 7, 13](06_decisions.md)、[00_overview.md の「目的」「私の解釈」](00_overview.md)

---

## 設計選択 2: 実装ランタイム / SDK

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| **A. Deno 2.x + `npm:asana@3` SDK (採用)** | 公式 SDK を npm 経由で利用、`deno compile` を視野に | R10 | — | [制約 C-010, C-011](05_constraints.md) | superagent の Node 互換層、`@babel/cli` 同梱、429 ヘッダー取得 | H-DENO1（採択済）、H-DENO2、H-DENO3 |
| B. Deno + 独自 fetch クライアント | SDK 不使用、Asana REST を fetch で直接叩く | R10 | — | API スキーマ管理を自前で | API 仕様変更追随コスト / 型補完なし | — |
| C. Node.js + `asana` SDK | 無難な構成 | R10 | — | Node.js 配布形態 | npm 配布が前提化 | — |

**採用: A**
**理由**: Phase 1 スパイクで `npm:asana@3` が Deno で動作することを実測。`deno compile` 視野での単一バイナリ配布の可能性と、SDK 型補完の利益を両取りできる。残存リスク H-DENO2 / H-DENO3 は実装初期に検証し、不可なら B / C にフォールバック。

参照: [判断 6, 7](06_decisions.md)、[Phase 1 spike](../../spike/phase1_load.ts)

---

## 設計選択 3: タスク検索 API の選択

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| A. `searchTasksForWorkspace` | `/workspaces/{ws}/tasks/search?assignee.any=&completed=false` を使う | R1 | R6（冪等性が崩れる） | **Premium 以上必須** / eventual consistency 10-60s / 標準ページネーション不可 | dry-run と本実行の整合性が崩れる / Premium 環境のみで動作 | — |
| **B. `getTasks` (採用)** | `/tasks?workspace=&assignee=&completed_since=now` を使う | R1, R6 | — | 全プラン対応（仮置き H-API5） | Free プランで動かない可能性 | H-API5 |
| C. project ごとに走査 + assignee filter | workspace の全 project を列挙し、各 project の `/tasks` を assignee filter で叩く | R1 | R8（API コール数膨張） | 大規模 workspace で実用性低下 | レート制限超過 | — |

**採用: B**
**理由**: `getTasks` は strongly consistent で標準的なオフセットページネーションを持ち、R6 の冪等性を担保しやすい。SDK の JSDoc が明示する search API の eventual consistency / pagination 制約を回避できる。Premium 要件も外せる可能性が高い。

参照: [判断 8, 15](06_decisions.md)、[制約 C-003, C-004](05_constraints.md)

---

## 設計選択 4: 旧→新ペアの入力形式

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| **A. 単一ペアを CLI 引数 (採用)** | `--from <email> --to <email>` を 1 回実行 = 1 ユーザー分 | R2 | — | 複数ユーザー移行は実行を繰り返す | 大量ユーザー処理のオペレーション負荷 | — |
| B. CSV / JSON で複数ペア一括 | 1 ファイルで N ユーザー処理 | R2 拡張版 | 仕様複雑化 | 誤マッピングのブラスト半径拡大 | 監査ログ粒度設計が必要 | — |
| C. 旧アカウントだけ指定、新アカウントを対話的確認 | UX 補助 | — | 引数不足の補完が複雑 | 自動化困難 | — | — |

**採用: A**
**理由**: ユースケース文 "Asana アカウントの移行が新しく作成されたアカウントに限定される場合" は単一移行を示唆。ブラスト半径と監査の単純さを優先。複数化が必要になったら shell loop で対応可能。

参照: [判断 2](06_decisions.md)

---

## 設計選択 5: 操作対象スコープ

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| **A. assignee のみ (採用)** | `updateTask` で assignee フィールドのみ書き換え | R3 | — | — | — | — |
| B. assignee + follower の置換 | 旧 user を follower から外し、新 user を follower 化 | R3 拡張 | — | API コール数増加 | 失敗時のロールバック複雑化 | — |
| C. コメント・添付の著者情報も Asana 側で自動移行と仮定し、ツールは触らない | A と同じ実体 | — | — | — | — | — |

**採用: A**
**理由**: ユースケース文「タスクの担当者を移行」の最小忠実解釈。副作用範囲を狭く保ち、失敗時の影響と再実行容易性を最大化。

参照: [判断 3](06_decisions.md)

---

## 設計選択 6: workspace スコープ

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| A. 全 workspace 横断 | 旧ユーザーが所属する全 workspace で実行 | R1 拡張 | — | API 呼び出し増、権限境界をまたぐ | 副作用範囲が広い | — |
| **B. 指定 workspace 単位 (採用)** | `--workspace <gid>` で 1 workspace のみ | R1 | — | 複数 workspace なら複数回実行 | — | — |
| C. 指定 project 単位 | `--project <gid>` で 1 project のみ | — | R1（粒度が小さすぎる） | — | 漏れリスク | — |

**採用: B**
**理由**: Asana API の search / list のスコープが workspace 単位で自然。権限境界をまたがない分、副作用が予測しやすい。

参照: [判断 1](06_decisions.md)

---

## 設計選択 7: 新アカウント招待の責任分担

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| **A. 招待は人手、ツールは member 確認のみ (採用)** | 事前条件として member 必須、未参加で fail-fast | R4 | — | ユーザー手順に招待ステップが必要 | — | — |
| B. ツールが招待 API も実行 | 未参加なら自動招待してから assign | R4 拡張 | スコープ拡大 | 管理者権限の PAT 必須 | 失敗ロールバック設計が必要 | — |

**採用: A**
**理由**: ツールスコープを最小化。招待は管理者の責任範囲として明確に分離。

参照: [判断 4](06_decisions.md)

---

## 設計選択 8: エラー時の挙動

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| A. fail-fast | 最初のエラーで全体停止 | — | R7 | リカバリしにくい | 大量失敗時に状況把握困難 | — |
| **B. 継続実行 + 失敗一覧 (採用)** | エラーは記録して続行、最後にレポート | R7 | — | 冪等性 (R6) との組合せで再実行リカバリ | — | — |
| C. トランザクション風ロールバック | 失敗があれば変更を巻き戻す | — | 並行編集と相性悪い | 実装複雑度高 | 想定外の状態に陥る | — |

**採用: B**
**理由**: R6 の冪等性により再実行でリカバリ可能。並行編集時の整合性を考えると C は危険。

参照: [判断 5](06_decisions.md)

---

## 設計選択 9: UX 拡張オプション

| 項目 | 検討した案 | 採否 | 理由 |
|---|---|---|---|
| 並列実行 | worker pool で並列 update | **不採用** | レート制限 150 req/min が律速、並列化の旨味なし |
| 進捗バー | `[████░░░░] 24/47` 形式 | **不採用** | 失敗特定容易性が低下、既存 `[N/M]` プレフィックスで十分 |
| `--quiet` | 進捗行を省略 | **採用** | スクリプト起動時の余計な出力抑制 |
| `--verbose` | API 詳細を stderr に出力 | **採用** | トラブル時の調査用 |
| `--yes` で確認スキップ | 対話的確認の no-op フラグ | **採用** | 慣れたユーザーの効率化 |
| TTY 検出 | 非対話環境を判定 | **不採用** | 非対話環境は想定外（[判断 19](06_decisions.md)） |
| 設定ファイル (`~/.config/...`) | 引数のデフォルト保存 | **不採用** | 単発 CLI に過剰 |
| 監査ログ・ファイル出力 | 結果をファイルに保存 | **不採用** | stdout リダイレクトで十分（[判断 11](06_decisions.md)） |

参照: [判断 10, 11, 19](06_decisions.md)

---

## 設計選択 10: survey 機能の統合形態（2026-05-29）

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| **A. サブコマンド化（採用）** | `migrate` / `survey` の 2 サブコマンドに再構成。`cli.ts` の parseArgs を subcommand dispatch 化 | R16 | — | 旧 bare 呼び出しの廃止（breaking） | 既存テスト/README の改修 | — |
| B. 既存 CLI にフラグ追加 | `--survey-domain` 等で migrate CLI にモード分岐 | R16 | `--from`/`--to` と無意味な共存組合せが生じる | CLI 仕様の複雑化 | フラグ衝突の説明コスト | — |
| C. 独立エントリポイント + task | `src/survey.ts` + `deno task survey` を新設、migrate に一切触れない | R16 | — | エントリ 2 系統 | 共通初期化の二重化 | — |

**採用: A（サブコマンド必須）**
**理由**: migrate と survey は目的が異なる独立機能で、サブコマンドが最も明確な機能境界。bare 呼び出しの後方互換（bare=migrate 維持）も検討したが、v0.1.0 は未公開で破壊コストが低く、対称な設計（両方を明示必須）を優先した。VERSION は 0.2.0 に上げる。

参照: [判断 26](06_decisions.md)、要件 [R16](01_requirements.md)、[S-019](03_specifications.md)

---

## 設計選択 11: email 非可視ユーザーの扱い（2026-05-29）

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| **A. 件数を明示して続行（採用）** | email を返さないユーザー数を結果に注記し、可視アカウントのみ集計 | R20 | 集計が下限値になりうる | — | 利用者が下限性を見落とす（→ 注記で明示） | H-API7 |
| B. 個別に email 再解決 | `getUserForWorkspace` 等で 1 人ずつ email を再取得 | R20 | レート制限・実行時間が膨張（全ユーザー分の追加コール） | C-002 圧迫 | 再解決できる保証なし | — |
| C. 無視 | 非可視ユーザーに触れず可視分のみ集計 | — | R20（信頼性注記が無い） | — | 数値の信頼性が読み手に伝わらない | — |

**採用: A**
**理由**: レート制限（C-002）を圧迫せず、かつ数値が下限になりうる事実を注記で担保できる。実測（H-API7: 714 中 97 が非可視）でも非可視ユーザーはゲスト/制限メンバーが大半とみられ、再解決のコストに見合わない。

参照: [判断 27](06_decisions.md)、[制約 C-017](05_constraints.md)、要件 [R20](01_requirements.md)

---

## 設計選択 12: cross-workflow トリガー方式（C-019 回避、2026-05-31）

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| **A. reusable workflow / 同一 run（採用）** | main-push caller が tag を作り、`workflow_call` で build+publish を同一 run で実行 | R27 | — | reusable に `contents: write` | — | — |
| B. 昇格トークンで tag push | PAT / GitHub App token / deploy key で tag を push し、既存 release.yml(`push:tags`) を起動 | R27 | — | secret 管理（PAT/App/SSH）・寿命・scope | トークン失効でリリースが静かに停止 | — |
| C. workflow_dispatch / repository_dispatch | tag 作成後 dispatch で release を起動（`GITHUB_TOKEN` で可、C-019 の例外） | R27 | — | release 側に dispatch trigger + ref 受け渡し | dispatch と push:tags の二重起動設計が要る | — |

**採用: A**
**理由**: secret 管理ゼロで [C-019](05_constraints.md)（`GITHUB_TOKEN` の tag push が他 workflow を非トリガー）を構造的に回避でき、最小権限の現行 `permissions` 設計と整合する。B は release.yml を無改修で残せる利点があるが、トークンの寿命/scope 管理と「失効でリリースが静かに止まる」運用リスクを負う。C は `GITHUB_TOKEN` で起動できる正当な手段だが、push:tags との二重起動を設計で潰す必要があり複雑。

参照: [判断 32](06_decisions.md)、[制約 C-019](05_constraints.md)、要件 [R27](01_requirements.md)、[S-029](03_specifications.md)

---

## 設計選択 13: リリースのトリガー条件（2026-05-31）

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| **A. version 変化検知（採用）** | deno.json の `.version` が前 commit から変化した push のみリリース | R26, R28 | — | version の single source 化（D-021） | bump 忘れでリリース漏れ（規約で担保、判断 35） | H-DENO4 |
| B. commit 規約 / release-please | Conventional Commits / release-please bot で version 決定とリリース | R26 | — | 新ツール / bot 導入・運用 | 短命ツールに過剰 | — |
| C. 毎 push リリース | main に入るたびに必ずリリース（連番 / prerelease） | — | R28（no-op が無い） | 連番 / prerelease の番号設計 | パッチごとの過剰リリース | — |

**採用: A**
**理由**: 既存の deno.json version フィールドを source にでき、追加概念が最小。tag 名も deno.json から一意に決まる。短命ツール（[C-009](05_constraints.md)）に B の bot 運用は過剰、C は中間 commit ごとに無条件公開となり過剰。bump 忘れの失敗モードは「リリースが出ないだけ」で安全側に倒れる。

参照: [判断 31, 33](06_decisions.md)、要件 [R26, R28](01_requirements.md)、[S-028](03_specifications.md)

---

## 設計選択 14: リリースの品質ゲート（2026-05-31）

| 案 | 概要 | 満たす要件 | 満たせない/危うい要件 | 追加制約 | リスク | 検証すべき実装仮説 |
|---|---|---|---|---|---|---|
| A. ci.yml と並走（依存なし） | version 変化で即リリース | — | R30（未検証バイナリ公開リスク） | — | テスト失敗中でも公開され得る | — |
| **B. release 経路でテスト（採用）** | build 前に fmt/lint/check/test を実行、失敗で中止 | R30 | — | tag は test 通過後に push（dangling 回避） | — | — |
| C. workflow_run で ci 成功後に発火 | ci.yml 完了 → release を起動 | R30 | — | workflow_run の `GITHUB_TOKEN` トリガー条件 | C-019 同様のトリガー仕様の罠で複雑化 | — |

**採用: B**
**理由**: リリースは不可逆な「公開」アクションなので、release 経路を自己完結の品質ゲートにする。release の build はバイナリ生成（compile-smoke 相当）はするがテストスイートは走らせないため、ci.yml と並走（A）させると未検証バイナリを公開し得る。C は workflow_run の `GITHUB_TOKEN` 起因トリガー条件が C-019 と同種の罠を持ち複雑。tag は test 通過後に push し、test 失敗時に dangling tag を残さない。

参照: [判断 34](06_decisions.md)、要件 [R30](01_requirements.md)、[S-030](03_specifications.md)

---

## 関連

- [要件](01_requirements.md)
- [仮説マップ](02_hypotheses.md)
- [仕様候補](03_specifications.md)
- [制約](05_constraints.md)
