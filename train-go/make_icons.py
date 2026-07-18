"""PWA 用アイコンを生成する。実行: python make_icons.py"""
from PIL import Image, ImageDraw


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), "#8fd4ff")
    d = ImageDraw.Draw(img)
    s = size / 512  # 512 基準でスケール

    # 地面
    d.rectangle([0, 400 * s, size, size], fill="#c2ecb0")
    d.rectangle([0, 400 * s, size, 416 * s], fill="#8a7a5c")

    # 車体(白いのぞみ風・ロングノーズ)。本体とノーズをひとつの多角形で描く
    nose = [
        (70 * s, 240 * s), (360 * s, 240 * s), (420 * s, 255 * s),
        (470 * s, 300 * s), (490 * s, 360 * s), (490 * s, 390 * s),
        (40 * s, 390 * s), (40 * s, 270 * s),
    ]
    d.polygon(nose, fill="#f8f8f8", outline="#c8c8c8", width=int(6 * s) or 1)
    # 青い帯
    d.polygon([(40 * s, 300 * s), (420 * s, 300 * s), (478 * s, 340 * s),
               (478 * s, 368 * s), (40 * s, 336 * s)], fill="#1c48a6")
    # 窓
    for x in (90, 170, 250, 330):
        d.rounded_rectangle([x * s, 258 * s, (x + 50) * s, 292 * s],
                            radius=8 * s, fill="#333333")
    # 車輪
    for x in (110, 330):
        d.ellipse([(x - 22) * s, 368 * s, (x + 22) * s, 412 * s], fill="#3a3a3a")

    return img


for size in (180, 512):
    make_icon(size).save(f"icons/icon-{size}.png")
    print(f"icons/icon-{size}.png ok")
