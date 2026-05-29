# 06 — 判断履歴

対話中に明示的に分岐させた判断（判断 1 〜 28）の記録。各判断について「選択肢 / 採択 / 理由」を残す。判断 25 以降は 2026-05-29 の survey サブコマンド追加フェーズ。

## 判断 1: 「すべての未完了タスク」の境界

- **選択肢**: A 全 workspace 横断 / B 指定 workspace 内 / C 指定 project 内
- **採択**: **B**
- **理由**: Asana API のスコープが workspace 単位で自然。権限境界をまたがず副作用が予測しやすい。
- **関連**: R1, [設計選択 6](04_design_options.md)

## 判断 2: 旧→新の対応関係の入力形式

- **選択肢**: A 単一ペア (CLI 引数) / B 複数ペア CSV 一括 / C 旧のみ指定+対話確認
- **採択**: **A**
- **理由**: ユースケース文が単数を示唆。誤マッピングのブラスト半径を抑える。
- **関連**: R2, [設計選択 4](04_design_options.md)

## 判断 3: 「担当者」の範囲と関連属性

- **選択肢**: A assignee のみ / B assignee+follower / C assignee+著者・添付など
- **採択**: **A**
- **理由**: ユースケース文に忠実。副作用範囲を狭く保ち、失敗時の影響と再実行容易性を最大化。
- **関連**: R3, [設計選択 5](04_design_options.md)

## 判断 4: 「新規作成アカウント限定」制約の意味

- **選択肢**: A ツール前提条件として扱う / B 自動招待 / C 単なる宣言（動作影響なし）
- **採択**: **A**
- **理由**: ツールスコープを最小化、招待は管理者責任に分離。
- **補足**: ユーザーから「Asana の企業ドメイン管理アカウントが、別企業ドメインへ移行・統合できない Asana の制約による」との補足あり。本ツール自体が短命のワークアラウンドという位置付け。
- **関連**: R4, [設計選択 7](04_design_options.md), [00_overview.md](00_overview.md)

## 判断 5: 一部タスクの更新に失敗したときの挙動

- **選択肢**: A fail-fast / B 継続実行+失敗一覧 / C ロールバック
- **採択**: **B**
- **理由**: 冪等性（R6）と組み合わせ、再実行でリカバリ可能。
- **関連**: R7, [設計選択 8](04_design_options.md)

## 判断 6: 実装言語 / ランタイム

- **選択肢**: A Go / B TypeScript (Deno or Node.js) / C Python / D 任意
- **採択**: **B**（ランタイムは Deno 第一候補、課題があれば Node.js）
- **理由**: Asana 公式 SDK あり、エコシステム成熟。利用者の好み。
- **関連**: R10, [設計選択 2](04_design_options.md)

## 判断 7: Deno 採用可否（独自クライアント vs SDK）

- **選択肢**: A Deno+独自 fetch / B Deno+`npm:asana` SDK / C Node.js+SDK
- **採択**: **B**（仮置き、その後 Phase 1 スパイクで採択）
- **懸念点**: superagent の Node 互換層、`@babel/cli` 同梱、CommonJS、429 ヘッダー取得
- **理由**: 型補完と Deno の単一バイナリ配布の両取り。Phase 1 で動作確認済み。
- **関連**: R10, [設計選択 2](04_design_options.md)

## 判断 8: Task Search API が使えない場合のフォールバック

- **選択肢**: A Premium 前提 / B Free フォールバック（project 走査）/ C 自動フォールバック
- **採択**: **A**（その後、判断 15 で `getTasks` に切り替えたため Premium 要件は撤回見込み）
- **理由**: ツール最小スコープ。
- **関連**: 判断 15, [設計選択 3](04_design_options.md)

## 判断 9: 最小疎通スパイクの実施タイミング

- **選択肢**: A 仕様策定前にすぐ / B 並行 / C 実装着手後
- **採択**: **A**
- **理由**: H-DENO1 が偽だった場合の手戻りを早期に潰す。
- **成果**: Phase 1 スパイク（[spike/phase1_load.ts](../../spike/phase1_load.ts)）で `npm:asana@3` の Deno ロード成功を確認。

## 判断 10: dry-run の出力フォーマット

- **選択肢**: A 人間可読のみ / B JSON のみ / C 両対応
- **採択**: **C**
- **理由**: 手動利用と CI/script 利用の両対応。
- **関連**: R5, S-004

## 判断 11: ログ・レポート出力先

- **選択肢**: A stdout/stderr のみ / B `--report <path>` でファイル出力 / C 常時ファイル
- **採択**: **A**
- **理由**: Unix 流。リダイレクトで対応可能。R6 で再実行容易性も担保。

## 判断 12: Phase 2 スパイクの進め方

- **選択肢**: A PAT 共有して実 HTTP / B PAT なしで先に進む / C 型定義の確認のみ
- **採択**: **C**（PAT 共有なし、SDK 型定義の確認で仕様精度を上げる）
- **理由**: PAT 共有を不必要に求めない。型定義で仕様候補の精度は十分。
- **成果**: SDK 型定義から `getUser` が email 直接受け付け（H-API3 採択）、`getTasks` の存在と引数構造（H-API4 採択）、`searchTasksForWorkspace` の eventual consistency 制約（採用不可と判断）を確認。

## 判断 13: 認証方式

- **選択肢**: A PAT / B OAuth OOB / C OAuth localhost / D PAT+OAuth 両対応
- **採択**: **A**
- **理由**: Asana の OAuth は PKCE でも client_secret 必須、localhost 公式サポートなし、アプリ登録運用が短命ツールに過剰。
- **関連**: R9, [設計選択 1](04_design_options.md)

## 判断 14: R11 / R12 ドラフトの確定

- **選択肢**: A そのまま確定 / B 文言調整 / C 後でまとめて確認
- **採択**: **C**
- **理由**: 仕様策定フェーズで全体一貫性を見てレビューする方が効率的。
- **関連**: R11, R12（README で具体化済み）

## 判断 15: 検索 API の選択

- **選択肢**: A `getTasks` (strongly consistent) / B `searchTasksForWorkspace` / C `getTasks` を本流に search を将来オプション
- **採択**: **A**
- **理由**: 冪等性（R6）の前提を強く保てる。dry-run と本実行の整合性に eventual consistency 起因の不整合が起きない。Premium プラン要件を外せる可能性。
- **関連**: R1, R6, S-010, S-011, [設計選択 3](04_design_options.md), 判断 8 を撤回

## 判断 16: subtask の扱い

- **選択肢**: A 含める / B 除外
- **採択**: **A**
- **理由**: 「旧アカウントが assignee の未完了タスクすべて」というユースケース文に忠実。subtask は親と独立した assignee を持つため、放置すると移行漏れ。
- **実装方針の変遷**: 当初は H-DOM3 が偽だった場合の fallback として `SubtaskMode = "auto" | "expand"` 型と `expandSubtasks` / `listSubtasks` の BFS 実装をコードに残していたが、2026-05-28 のライブ本実行で H-DOM3 が採択され（subtask 2 件が `getTasks` のレスポンスに含まれることを overlap=2/2 で確認）、判断 24 のテスト戦略（短命ツール・YAGNI）に従って fallback コードは削除した。万一 Asana API の挙動が変わり subtask が `getTasks` から外れたら再実装する。
- **関連**: R1, H-DOM3, 判断 24

## 判断 17: 仕様候補ドラフト v1 の確定

- **選択肢**: A 確定 / B 修正 / C 追加検討
- **採択**: **C**（並列実行・進捗バー・ログレベル切替の検討要請）
- **関連**: 判断 19

## 判断 18: 次のステップ

- **選択肢**: A README ドラフト / B 実装着手 / C 両方並行
- **採択**: **A**
- **理由**: 仕様確定の宣言文書として README を先に整える。

## 判断 19: 追加要素の採否

- **19a 並列実行**: **不採用**（レート制限が律速）
- **19b 進捗バー**: **不採用**（既存 `[N/M]` プレフィックスで十分）
- **19c `--quiet`**: **採用** → R13
- **19d `--verbose`**: **採用** → R14
- **19e 確認プロンプト + `--yes`**: **採用** → R15
- **補足**: 非対話環境は想定外（TTY 検出は不要）
- **関連**: R13, R14, R15, C-007

## 判断 20: README ドラフトの粒度

- **選択肢**: A 完全版 / B MVP / C 段階的
- **採択**: **B**
- **理由**: インストール手順・トラブルシュートは実装後に正確な情報で書く方が良い。

## 判断 21: README ドラフト v1 の確定

- **選択肢**: A 確定 / B 修正 / C 追加項目
- **採択**: **A**
- **成果**: [README.md](../../README.md) を確定。

## 判断 22: 要件分析の終結 / 次フェーズ

- **選択肢**: A 終結+実装着手 / B 終結+実装は別セッション / C 要件追加議論
- **採択**: **B**
- **理由**: 別セッションでクリーンに実装フェーズへ移行する。
- **付帯指示**: requirements-hypothesis-dialogue の各種アウトプットを成果として作成する（このディレクトリ）。

## 判断 23: SDK 型補完を諦め、ファサード層でアプリ側型を再定義する

- **選択肢**: A SDK の型をそのまま app に流す / B ファサード層で `Workspace` / `User` / `AsanaTask` 等の app 側型を再定義 / C TypeScript 型を諦め JSDoc + runtime 検証のみ
- **採択**: **B**
- **理由**: `asana@3.1.11` の型定義は OpenAPI 自動生成で、戻り値は `Promise<any>` や `Promise<Collection | any>` 程度しか提供されない（`data: any[]` 経由で実データに辿り着く）。当初 `project_tech_stack.md` で期待していた「SDK で型補完を得つつ」という動機は SDK 側だけでは達成不能。`asana_client.ts` のファサードで app 側型を `types.ts` に正規化することで、migrator / output / tests は SDK の `any` を一切触らずに済むよう設計した。
- **副作用**: ファサード層自体は `any` を内包する。`// deno-lint-ignore no-explicit-any` を局所的に許可している。
- **関連**: H-DENO1, `src/asana_client.ts`, `src/types.ts`, [project_tech_stack の懸念点 C4「OpenAPI 自動生成の冗長 API — 内部にファサードを置けば呼び出し側は綺麗」]

## 判断 24: テスト戦略 — モック非導入、live spike で検証

- **選択肢**: A 全層を mock で unit テスト / B 外部 API 非依存の層のみ unit テスト + `asana_client.ts` と `migrator.ts` は live spike で検証 / C 全層を live integration テスト
- **採択**: **B**
- **理由**:
  - 本ツールは Asana 企業ドメイン制約の回避策で、Asana 側の修正で不要になる短命前提（[00_overview.md](00_overview.md)）。長期メンテを支える testing harness 投資は過剰。
  - mock/prod 乖離はユーザの強い回避対象（プロジェクト共通ポリシー）。`updateTask` の body 形状や `getTasks` のページネーション等、SDK 側の挙動を mock で写すと整合性が崩れた瞬間に prod で初めて気付く事故になる。
  - Phase 2 spike（`spike/phase2_api.ts`）+ ライブ本実行（37/37 success）+ 冪等再実行（`Found 0 tasks`）で `asana_client.ts` / `migrator.ts` の主要パスはカバー済み。
- **何をテストし、何をテストしないか**:
  - **unit テスト対象**: `output.ts`（フォーマッタ）、`rate_limiter.ts`（タイマー・再試行ロジック）、`cli.ts`（引数パーサ）など外部 I/O を持たない pure ロジック。
  - **テスト対象外**: `asana_client.ts`（SDK ファサード）、`migrator.ts`（pipeline）、`main.ts`（lazy import 経路）。SDK 挙動依存の層は live spike で代替。
  - **survey 追加分（2026-05-29）**: `cli.ts` の `parseSurvey`（引数検証・ドメイン正規化）と `output.ts` の `renderSurvey`（整形）は pure ロジックとして unit テスト対象。`survey.ts`（orchestration）と `asana_client.ts` の `listWorkspaceUsers` は `migrator.ts` と同じ理由でテスト対象外とし、指定 workspace × ドメインに対する live 実行で検証する（2026-05-29: 既存のアドホック調査と件数一致を確認）。
  - **2026-05-30 補足（PR #3 フィードバック / FB-1）**: live spike も live 本実行も 429 を一度も exercise していなかったため、facade 正規化エラー (`AsanaApiErrorImpl`) shape での 429 検知・Retry-After 抽出の不具合（[H-DENO2](02_hypotheses.md) 補強 / [S-007](03_specifications.md)）を検出できなかった。`rate_limiter.ts` の `defaultRateLimitDetector` / `defaultRetryAfterExtractor` を、正規化エラー shape（`{httpStatus:429}` / `{retryAfterSec}`）に対する unit テストで回帰固定した（pure ロジックなので本テスト戦略のテスト対象内）。教訓: 「全パスで X が成立」型の受入基準は、live が踏まないパス（ここでは 429）を **単体テストで補完**しないと潜在不具合が残る。
- **回帰検出の範囲と限界**:
  - `deno check` + `deno lint` + `deno fmt` を必須ゲートとする。
  - **検出できる**: `AsanaClient` interface とその実装、ファサード境界の app 側型 (`Workspace` / `User` / `AsanaTask`)、`migrator.ts` / `output.ts` 側のシグネチャ不整合。
  - **検出できない**: SDK の API オブジェクト (`workspacesApi.getWorkspace` / `tasksApi.updateTask` 等) のメソッド名や引数構造の変更。判断 23 で SDK 型補完を諦め、`asana_client.ts` 内部で `AnyApi = any` キャストを許可しているため、SDK 側の breaking change は型エラーとして表面化しない。
  - **代替の検出手段**: `deno.json` の `imports` で SDK の exact バージョンをピン留め (現在 `npm:asana@3.1.11`、`deno.lock` で transitive 依存も固定)、SDK 更新時は明示的に同 import を bump したうえで spike (`spike/phase1_load.ts`, `phase2_api.ts`) を手動再実行する運用とする。
- **関連**: [02_hypotheses.md](02_hypotheses.md)（live で採択した H-API4/5/6, H-DOM3, H-DENO2/3）、判断 7（SDK 採用）、判断 9（スパイク優先）

## 判断 25: 移行残量の調査機能を正式実装するか（2026-05-29）

- **選択肢**: A 正式機能として実装 / B アドホック spike（移行残量調査）のまま運用 / C 実装しない
- **採択**: **A**
- **理由**: 移行の進捗・残量把握は移行ツールの自然な補助。読み取り専用で破壊リスクが無く、最小スコープ姿勢とも「読み取り専用・単一ドメイン」で整合する。アドホック spike の恒久化で再現性と保守性を得る。
- **"未移行" の定義**: 「指定ドメインの email を持つアカウントが assignee の未完了タスク」をもって未移行と数える。移行先（新アカウント）のマッピングは不要（ドメイン単位の enumeration で十分）。
- **関連**: W-008, D-013, R16〜R23, [設計選択 10](04_design_options.md)

## 判断 26: survey の統合形態

- **選択肢**: A サブコマンド化 / B 既存 CLI にフラグ追加 / C 独立エントリポイント
- **採択**: **A**（さらに bare 呼び出しは廃止し、`migrate` / `survey` を明示必須）
- **理由**: 独立機能の明確な境界。v0.1.0 未公開のため破壊コストが低く、対称な設計を優先。VERSION 0.2.0。
- **関連**: R16, [設計選択 10](04_design_options.md), [S-019](03_specifications.md)

## 判断 27: email 非可視ユーザーの扱い

- **選択肢**: A 件数を明示して続行 / B 個別に email 再解決 / C 無視
- **採択**: **A**
- **理由**: レート制限を圧迫せず、数値が下限になりうる事実を注記で担保。実測で非可視はゲスト/制限メンバーが大半とみられ再解決コストに見合わない。
- **関連**: R20, C-017, H-API7, [設計選択 11](04_design_options.md)

## 判断 28: survey の出力形式

- **選択肢**: A 人間可読 + `--json` / B 人間可読のみ / C JSON のみ
- **採択**: **A**
- **理由**: 既存 migrate（`--json` 対応）と一貫。手動確認と機械処理の両対応。`--quiet` で内訳省略、`--verbose` で API debug。
- **関連**: R22, [S-023](03_specifications.md)

## 判断 29: workspace をドメイン名で指定する入口（2026-05-30）

- **背景**: GID を手で調べて入力する UX が悪い（W-009）。これは [C-014「`--workspace` は GID 必須」](05_constraints.md) の再検討トリガー「UX 改善ニーズが具体化した場合」に該当する正当な再オープン。なお既存 `--domain` は survey で「assignee の email ドメイン」を意味する別フラグで、命名衝突の解消が論点。
- **選択肢**: A `--workspace` を拡張（数値=GID / 非数値=ドメインの auto-detect、新フラグ無し） / B 新フラグ `--workspace-domain <domain>`（`--workspace <gid>` と排他） / C 値プレフィックス（`gid:` / `domain:`）方式
- **採択**: **A**
- **理由**: 新フラグを増やさず、既存の GID 指定と完全後方互換。要望（GID を調べさせない）を最小コストで満たす。GID は `/^[0-9]+$/`、ドメインは少なくとも 1 つのドット区切りラベルを持つ形なので auto-detect の曖昧性は無い。survey でも `--workspace`（解決対象）と assignee 用 `--domain` は別フラグなので役割は分離できる（help 文で明記）。
- **「ドメイン名」の意味**: workspace の**表示名**ではなく、organization の登録 email ドメイン（workspace オブジェクトの `email_domains`）。表示名での指定は**同名 workspace の曖昧性**のため引き続き非対応（README 制限事項を踏襲）。素の workspace（`is_organization=false`、ドメイン無し）には適用できず GID 指定が必要 → [C-018](05_constraints.md)。
- **関連**: W-009, D-018, R24, R25, [C-014（緩和）, C-018](05_constraints.md), [H-API8](02_hypotheses.md), [S-027](03_specifications.md)

## 判断 30: ドメイン解決の適用範囲（2026-05-30）

- **選択肢**: A migrate と survey の両方 / B migrate のみ（survey は GID 維持）
- **採択**: **A**
- **理由**: 解決ロジック（`GET /workspaces` + `email_domains` 照合）を facade に一本化し、両サブコマンドで挙動を一貫させる。survey は `--workspace`（org をドメインで特定）と `--domain`（集計対象の assignee ドメイン）が併存するため、help 文で役割の違いを明記する。
- **後方互換**: 既存の GID 指定（migrate / survey とも）はそのまま通る。破壊的変更なし。
- **関連**: R24, [S-020, S-027](03_specifications.md)

---

## 棄却された案の整理（再検討トリガー付き）

| 案 | 棄却した判断 | 再検討トリガー |
|---|---|---|
| 全 workspace 横断 | 判断 1 | 「全 workspace まとめて移行したい」要望が顕在化 |
| 複数ペア CSV | 判断 2 | 数十ユーザー以上の一括移行運用が必要に |
| follower / collaborator 置換 | 判断 3 | follower 引き継ぎ漏れの実害が表面化 |
| 自動招待 | 判断 4 | 管理者運用の招待ステップがボトルネック化 |
| ロールバック | 判断 5 | 冪等再実行が機能しないケースが頻発 |
| OAuth 認証 | 判断 13 | PAT 運用の煩雑さが事故を生む / OAuth UX 改善余地が大きい |
| `searchTasksForWorkspace` | 判断 15 | `getTasks` で取得できない / フィルタが効かないと判明 |
| subtask 除外 | 判断 16 | subtask 移行が業務上不要と判明 |
| 並列実行 | 判断 19a | レート制限緩和、または「遅すぎる」フィードバック |
| 進捗バー | 判断 19b | 失敗特定容易性を犠牲にしてでも視覚的進捗が必要との要望 |
| TTY 検出 / 非対話対応 | 判断 19 補足 | CI / cron での自動実行ニーズが具体化 |
| `--verbose` 非採用 | 判断 19d | （当初推奨は非採用だが、判断 19d で採用に上振れ） |
| survey: 複数ドメイン同時集計 | 判断 25 | 複数ドメイン横断の移行残量把握ニーズが実証されたら |
| survey: CSV / ファイル出力 | 判断 28 | stdout / `--json` リダイレクトでは不足との運用要望 |
| survey: email 個別再解決 | 判断 27 | email 欠落が集計を無意味にするほど多いと判明 |
| bare 呼び出し（サブコマンド省略）の維持 | 判断 26 | 既存利用者の移行コストが破壊コストを上回ると判明 |
| workspace 表示名での指定 | 判断 29（ドメイン指定は採択、表示名は非対応のまま） | 同名 workspace を曖昧性なく区別する手段が確立したら |

## 関連

- [Overview](00_overview.md)
- [Requirements](01_requirements.md)
- [Specifications](03_specifications.md)
- [Design Options](04_design_options.md)
- [Constraints](05_constraints.md)
