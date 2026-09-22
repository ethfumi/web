# 全国鉄道路線データ

## 水域データ

`map-water-data.js` は[国土地理院最適化ベクトルタイル](https://github.com/gsi-cyberjapan/optimal_bvmap)（2026年7月1日時点）を加工したもの。
[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)に基づき、出典と加工を明示して使用する。
全国の収録駅・空港・港があるタイルとその周囲をzoom 8/10で収録し、海・湖・主要河川を描く。鉄道のない離島にも水域を補い、北海道から沖縄・小笠原まで同じ基準を使う。
沿線の詳細水域は約200m相当の幾何簡略化を施し、港・空港の周辺500mでは約50m相当の形状を残す。これは元データの測量精度を保証する値ではない。
小さな独立水域（0.1平方km未満）は省略し、海岸・川がタイル境界で切れないよう境界に接する水域は残す。詳細タイルの下に隠れる広域形状は配布データから除く。
データは緯度経度を整数差分で格納し、表示範囲だけをPath2Dへ変換・再利用する。ゲーム中に地図サーバーへ接続しない。

再取得には `pmtiles`、`mapbox-vector-tile`、`shapely` が必要。全体アーカイブをダウンロードせずHTTP Rangeで必要な部分だけ読む。

```sh
python train-go/tools/build-water-map.py --cache <作業用キャッシュディレクトリ>
python train-go/tools/build-runtime.py --optimize
```

## 圧縮配布

`runtime-sources.json` に列挙した読みやすいソースを `tools/build-runtime.py` で `runtime.js.gz` にまとめる。
`loader.js` がブラウザ内で展開して実行するため、GitHub Pages側の圧縮設定に依存しない。
DecompressionStream非対応環境は同梱のfflate 0.8.2（MIT、`vendor/fflate.LICENSE`）を使用する。
共有用のOGP画像はオフライン保存対象に含めない。配布ファイルの更新時は必ず再生成し、`--check` でソースとの一致と起動用ファイル合計2,000,000バイト以下を検査する。

```sh
python train-go/tools/build-runtime.py
python train-go/tools/build-runtime.py --check
node --test train-go/tests/*.test.cjs
```

地図・航路を増やした版は `python train-go/tools/build-runtime.py --optimize` でビルド時だけzopfliを使うと、ブラウザ側のコードやデータ精度を変えずに同じgzip形式を小さくできる。`--check` は実際の配布ファイルの容量と展開内容を検査する。

## 収録範囲

日本全国の旅客鉄道を対象とする。JR・私鉄・地下鉄・路面電車・モノレール・新交通・鋼索鉄道を含む。
季節営業、災害等による運休中の存続路線もゲーム上では走行できる。
貨物専用線、廃止路線、ロープウェイなどの索道、鉄道事業に当たらない園内遊具は対象外。

基準は `station_database` v20260831 の現役扱い602レコード。旧社名の4レコードを現在の運営路線へ対応づけ、598レコードを収録する。
データ元が運転区間・系統単位で分けている路線は、その区分を引き継ぐ。さらに元データ未収録のケーブルカー18路線を補完する。
支線、環状運転、新たな長距離直通9コースを含めたゲーム内の選択肢は鉄道655コース、空路274コース、海路594コース。[空路・航路の出典と範囲](transport-network.md)も参照。
現実の法的な路線数とは数え方が異なる。すべての臨時列車・愛称列車・直通パターンを個別に収録するものではない。

## 出典・権利表示

- [station_database / Seo-4d696b75](https://github.com/Seo-4d696b75/station_database/tree/v20260831): **CC BY 4.0**。
  `out/main/json.zip` の路線一覧・各路線の駅一覧から、名称・読み・位置・都道府県・廃止フラグを抽出。
  ボロノイ図など本アプリで不要な情報は省略した。加工済みスナップショットが `station-database.json`。
  [ライセンス](https://creativecommons.org/licenses/by/4.0/) / [原典のライセンス表示](https://github.com/Seo-4d696b75/station_database/blob/v20260831/LICENSE.md)。
- 補完ケーブルカーの駅座標: **© OpenStreetMap contributors / ODbL 1.0**。
  2026-09-22取得。`rail-route-overrides.json` の各 `osmNodes` が元のノードID。
  `https://www.openstreetmap.org/node/<id>` で参照できる。
  [著作権・ライセンス](https://www.openstreetmap.org/copyright)。この補完座標データはODbL 1.0で提供する。
  駅名・区間は各レコードの `source` に記載した運営者の案内を参照。
- ケーブルカーの補完対象は[国土交通省の鉄軌道事業者一覧（令和7年4月1日）](https://www.mlit.go.jp/statistics/details/content/001884565.pdf)の鋼索鉄道事業者と照合。

旧社名の重複は近鉄内部線→四日市あすなろう鉄道内部線、近鉄八王子線→同八王子線、北近畿タンゴ鉄道宮津線→京都丹後鉄道宮豊線、同宮福線→京都丹後鉄道宮福線。
京都丹後鉄道宮舞線も独立したレコードとして収録する。

## 加工と精度

- 路線キーは既存のスタンプ保存との互換性のため維持する。
- 新規コースと既存の関東自動生成分は駅間の測地距離を累積した**ゲーム内距離の近似値**。
  線路の曲線・標高差を反映した営業キロではない。駅同士を直線で結ぶ地図も簡略表示。
- 手作業で整備した既存コースは、営業キロ・停車種別・特別演出を維持する。
  横須賀線・内房線・副都心線のみ、省略されていた区間・駅を補うため全国データへ置き換える。
- 駅一覧は必ずしも接続順ではない。鶴見線、成田線、函館本線、長崎本線などは
  `paths` に駅コードの経路を明示して本支線を分ける。環状線は一周の終点も持つ。
  路線図の参照先は `topologySources` に記録する。
- 追加車両は路線色と種別に合わせたゲーム用の汎用デザイン。全形式の実車再現ではない。
  自動運転速度・標準両数も追加路線ではゲーム用の目安。
- 元データの花咲線の読みを「はなさきせん」へ補正。十国峠の駅名は運営者の現行表記へ補正。
- 収録基準日の路線網であり、実際の当日運行・臨時ダイヤの案内には使用しない。

## 再生成・点検

リポジトリのルートで実行する。Python標準ライブラリとNode.jsだけを使用し、通信は不要。

```sh
python train-go/tools/build-rail-network.py
python train-go/tools/build-rail-network.py --check
node --test train-go/tests/rail-network.test.cjs
```

`station-database.json` と `rail-route-overrides.json` が入力。
`tools/rail-network-runtime.js` が登録処理の正本。
生成物は `all-rail-route-data.js` と `rail-coverage.json`。
`rail-coverage.json` は元データの全レコードについて、収録コース・重複先・廃止除外を記録する。
生成時に、各現役路線の非廃止駅が経路定義から漏れていないことも検査する。
手作業の既存コースには快速・特急・直通運転などの停車駅省略があり、現役駅全駅への停車保証ではない。

データを更新するときは上流タグを固定してスナップショットを再抽出し、
`paths` の全駅カバレッジと事業者の路線図を確認してから再生成する。
端末で読むのは生成済みJavaScriptのみ。出典スナップショットや生成ツールはPWAキャッシュへ入れない。
