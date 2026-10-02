# PARTICLE MORPH

十数万個の光の粒が、形から形へ移り変わる WebGL アニメーション。依存なしの 1 ファイル（`index.html`）。

## 形

Galaxy / Sphere / Torus Knot / Ripple / Lattice / Saturn / Black Hole / DNA / Möbius / Shell / Orrery / Lorenz

## 操作

- 形のボタン: その形へ切り替える。切り替え途中に押した形は、終わってから続けて切り替える
- AUTO CYCLE / SHUFFLE: 時間が来たら次の形へ（SHUFFLE でランダム）
- SPEED / HOLD / TURBULENCE: 動きの速さ、形を保つ時間、切り替え途中の乱れ
- SIZE / GLOW / HUE: 粒の大きさ、明るさ、色相
- SPIN: 自動回転の速さ（負で逆回り）
- AFTERGLOW: 残像。前のフレームを薄めて残す
- TOUCH: ポインタの近くの粒が逃げる強さ（負で集まる）
- PARTICLES: 4 万〜32 万
- ドラッグで回転、ホイール・ピンチでズーム、SPACE で再生・停止、1–0 と ← → で形の選択

## 仕組み

- 粒は位置を持たない。頂点属性は乱数 8 個で、位置は頂点シェーダーが「乱数 → 位置」の数式で毎フレーム計算する。
  CPU が毎フレーム送るのは、時刻・今の形と次の形の番号・切り替えの進み・カメラだけ。
- 切り替えは 2 つの形の位置の補間。立ち上がりを粒ごとにずらし、途中だけねじりと散らばりを足す。
- ローレンツアトラクタだけは数式 1 本で書けないので、CPU で軌道を積分した点を属性として渡している。
- 加算合成で描く。残像は描画バッファを保持し、前のフレームを掛け算で薄めてから 1/255 だけ引く
  （掛け算だけだと 8bit の端数が残って消えきらない）。

作り方の詳しい解説は dev-env の `docs/webgl-particle-morph.md`。

```powershell
python -m http.server 8646 --directory particle-morph
```
