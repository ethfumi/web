# 線路の表示形状

駅を直線で結ぶ表示を、実際の線路に沿う簡略形状へ置き換える。対象は鉄道681コース、11,587駅間。形状の更新では停車駅名・順序・ゲーム内の距離・折り返し設定を変更しない。

## 出典

- [国土交通省「国土数値情報 鉄道データ」N02-25](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html)：2025年12月31日時点、2026年4月公開。2026年9月23日取得。CC BY 4.0。原データの鉄道区間・駅形状を照合、経路化、簡略化して使用。
- [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)：仙石東北ラインの塩釜～高城町を補完。2026年9月23日取得、ODbL 1.0。元way IDと座標は `rail-shape-supplements.json` に保存。

## 加工

事業者・路線ごとの駅名と位置を照合し、元データで端点を共有する線路をたどる。別区間の端点が線の途中の既存頂点に接続する場合はそこで分割する。単に線同士が交差する場所を接続点にはしない。

表記差を正規化し、山形・秋田新幹線など在来線を走るコースは対応する在来線形状を使う。新設駅など駅形状の時点差がある場合は、既存の駅座標から同一路線の400m以内へ投影する。別ホームの候補がある大駅では前後の経路も照合し、区間の継ぎ目が大きく飛ばないようにする。

同名駅の地上・地下ホームで経路が異なる場合は `rail-shape-station-overrides.json` の照合位置と根拠資料を使う。おおさか東線の大阪駅は、[JR西日本の案内](https://www.westjr.co.jp/press/article/items/230309_00_press_umekita%20.pdf)に合わせてうめきた地下ホーム側を選び、新大阪手前で別線へ折り返す誤経路を防ぐ。

同一路線の孤立した端点間に15m以下の誤差がある場合のみ接続を補修し、位置と距離を `rail-shape-coverage.json` に記録する。元データの大きな空白を直線でつないで補完する処理ではない。

描画形状は投影上30mの許容値で簡略化し、座標を小数4桁へ丸める。道路と同程度の描画密度を目安にしたもので、測量上の35m精度を保証するものではない。線路敷内の全車線・分岐器・高さ・トンネル深度は再現しない。

重複する駅間形状は共有し、逆向きは同じ形状を反転して使う。列車位置は駅間の形状に沿って補間する。形状用の中間点には駅名を付けず、駅の丸や建物を増やす用途に使わない。

## 再生成と検証

登録処理の正本は `tools/rail-shape-runtime.js`、加工済み形状は `rail-shapes.json`、照合記録は `rail-shape-coverage.json`。

```sh
python train-go/tools/build-rail-shapes.py
python train-go/tools/build-runtime.py --optimize
python train-go/tools/build-runtime.py --check
node --test train-go/tests/*.test.cjs
```

元データから作り直す場合は公式ZIP内の `N02-25_RailroadSection.geojson` と `N02-25_Station.geojson` を同じディレクトリへ展開し、`build-rail-shapes.py --source <そのディレクトリ>` を使う。PythonのShapely・pykakasiが必要。`rail-shape-input.cjs` が既存コースの入力を抽出する。

検証では全コースの駅名・km保存、座標と距離の単調性、環状線の閉合、区間の継ぎ目、中央線の代々木・信濃町付近の曲線、瀬戸大橋の通過位置を確認する。形状用中間点は駅の表示対象から除外し、列車位置の二分探索と描画キャッシュを継続利用する。
