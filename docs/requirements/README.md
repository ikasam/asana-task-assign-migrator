# Requirements Documents

requirements-hypothesis-dialogue による要件分析のアウトプットを格納するディレクトリ。

実装の宣言文書である [`../../README.md`](../../README.md) は、ここに整理した要件・仕様・設計判断の最終結論を要約したものです。詳細な経緯や棄却案の根拠は本ディレクトリの各文書を参照してください。

> **2026-05-29 追加フェーズ**: 移行残量を調べる読み取り専用の `survey` サブコマンドの要求分析を追記しました（要望 W-008 / 要求 D-013〜D-017 / 要件 R16〜R23 / 仕様 S-019〜S-026 / 判断 25〜28 / 設計選択 10〜11 / 制約 C-016, C-017 / 仮説 H-VAL2, H-API7）。

## ファイル構成

| ファイル | 内容 |
|---|---|
| [00_overview.md](00_overview.md) | 現時点の理解（目的、対象、前提、曖昧さ） |
| [01_requirements.md](01_requirements.md) | 要望候補 W-*、要求候補 D-*、要件候補 R-* |
| [02_hypotheses.md](02_hypotheses.md) | 仮説マップ H-* と検証計画 |
| [03_specifications.md](03_specifications.md) | 仕様候補 S-* |
| [04_design_options.md](04_design_options.md) | 設計案比較（採用 / 棄却） |
| [05_constraints.md](05_constraints.md) | 業務・技術・運用・セキュリティ制約 C-* |
| [06_decisions.md](06_decisions.md) | 対話中の判断 1〜28 の履歴 |
| [07_context_capsule.md](07_context_capsule.md) | 実装セッションへの引き継ぎ要約 |

## 状態ラベルの読み方

| ラベル | 意味 |
|---|---|
| 確定 | 人間に確認済みで採用 |
| 仮置き | 暫定で前提として進めるが、変更余地あり |
| 要検証 | 観測やエビデンスで判断する必要がある |
| 保留 | 判断を先送り |
| 棄却 | 検討の結果、採用しないと判断 |

