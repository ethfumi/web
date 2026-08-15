# FRACTAL FIELD

WebGL2 の fragment shader でリアルタイム描画する、スマホ優先のフラクタル／生成数学ビューアー。

## 収録モード

- 3D: Mandelbulb / Mandelbox / Menger Sponge
- 2D: Mandelbrot / Julia / Burning Ship / Burning Julia / Newton / Sierpinski Carpet / Kaleidoscope
- Generative: Phyllotaxis / Truchet Tiles / Harmonic Field / Apollonian Gasket

各モードには、形状や構造を実際に変える専用パラメータを表示する。式と上部の値表示も操作に追従する。

- ドラッグ: 3D 回転 / 2D 平行移動
- ピンチ / マウスホイール: 制限なしの指数ズーム
- DETAIL: 反復回数
- EXPOSURE / SPECTRUM: 表示調整
- RENDER SCALE: 描画解像度
- GPU / HEADROOM: GPU 描画時間とフレーム予算の余力
- 再生ボタン / SPEED: 3D 自動回転
- RESET: 現在のモードの初期視点

```powershell
python -m http.server 8643 --directory mandelbulb
```

外部ライブラリなし。WebGL2 + GLSL ES 3.00 で、3D は ray marching、2D は escape-time 法や反復写像を使って描画する。
