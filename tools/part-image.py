#!/usr/bin/env python3
"""Prepare a part photograph for the Parts Library on products.html.

Give it a cut-out with a transparent background (from any background remover)
and it writes the two files the page uses:

    assets/img/parts/<name>.webp        the part, trimmed, at most 720px
    assets/img/parts/<name>-edges.webp  its edges, used for the green wireframe

    python3 tools/part-image.py cutout.png og-drill-01
    python3 tools/part-image.py cutout.png og-drill-01 --fade

--fade softens any side where the photograph cuts the part off, instead of
leaving a hard edge. Needs Pillow, NumPy and OpenCV:

    pip install pillow numpy opencv-python-headless
"""
import argparse
import os

import cv2
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img', 'parts')
MAX = 720


def clean_alpha(a):
    """Firm up a soft matte and drop specks well away from the part."""
    a = np.clip((a - 0.12) / 0.76, 0, 1)
    solid = (a > 0.5).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    if n > 2:
        big = stats[1:, cv2.CC_STAT_AREA].max()
        keep = np.zeros(n, bool)
        keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= big * 0.02
        a = a * cv2.dilate(keep[lab].astype(np.uint8), np.ones((5, 5), np.uint8))
    return a


def fade_cut_sides(a):
    h, w = a.shape
    out = a.copy()
    for side, line in (('l', a[:, :2].max(1)), ('r', a[:, -2:].max(1)), ('t', a[:2].max(0)), ('b', a[-2:].max(0))):
        if (line > 0.5).mean() < 0.04:
            continue
        d = max(4, int((w if side in 'lr' else h) * 0.12))
        ramp = np.linspace(0, 1, d)
        if side == 'l':
            out[:, :d] *= ramp[None, :]
        elif side == 'r':
            out[:, -d:] *= ramp[None, ::-1]
        elif side == 't':
            out[:d] *= ramp[:, None]
        else:
            out[-d:] *= ramp[::-1, None]
    return out


def edge_map(rgb, a):
    """The silhouette and the strong edges inside it, at about 300px."""
    k = min(1.0, 300 / max(a.shape))
    size = (max(8, int(a.shape[1] * k)), max(8, int(a.shape[0] * k)))
    g = cv2.resize(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), size, interpolation=cv2.INTER_AREA)
    al = cv2.resize(a, size, interpolation=cv2.INTER_AREA)
    g = cv2.bilateralFilter(g, 7, 40, 7)
    med = float(np.median(g[al > 0.5])) if (al > 0.5).any() else 128.0
    e = cv2.Canny(g, int(max(10, 0.5 * med)), int(min(255, 1.1 * med + 30)), L2gradient=True)
    e[al < 0.6] = 0
    sil = cv2.morphologyEx((al > 0.5).astype(np.uint8) * 255, cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    e = cv2.GaussianBlur(cv2.dilate(cv2.max(e, sil), np.ones((2, 2), np.uint8)), (3, 3), 0)
    out = np.zeros((*e.shape, 4), np.uint8)
    out[..., 3] = e
    return Image.fromarray(out, 'RGBA')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cutout', help='PNG or WebP with a transparent background')
    ap.add_argument('name', help='file name for the part, without extension, e.g. og-drill-01')
    ap.add_argument('--fade', action='store_true', help='soften sides where the photograph cuts the part off')
    args = ap.parse_args()

    im = np.asarray(Image.open(args.cutout).convert('RGBA')).astype(np.float64) / 255
    rgb, a = im[..., :3], clean_alpha(im[..., 3])
    if args.fade:
        a = fade_cut_sides(a)
    ys, xs = np.where(a > 0.03)
    if not len(xs):
        raise SystemExit('The cut-out is empty: it needs a transparent background around the part.')
    rgb, a = rgb[ys.min():ys.max() + 1, xs.min():xs.max() + 1], a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    try:
        from pymatting import estimate_foreground_ml  # optional: removes the old background's colour fringe

        rgb = estimate_foreground_ml(rgb, a)
    except ImportError:
        pass
    h, w = a.shape
    pad = int(max(h, w) * 0.03)
    canvas = np.zeros((h + 2 * pad, w + 2 * pad, 4))
    canvas[pad:pad + h, pad:pad + w, :3] = rgb
    canvas[pad:pad + h, pad:pad + w, 3] = a
    img = Image.fromarray((np.clip(canvas, 0, 1) * 255).astype(np.uint8), 'RGBA')
    if max(img.size) > MAX:
        k = MAX / max(img.size)
        img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)

    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, f'{args.name}.webp'), quality=84, alpha_quality=90, method=6)
    arr = np.asarray(img)
    edge_map(arr[..., :3].copy(), arr[..., 3].astype(np.float64) / 255).save(os.path.join(OUT, f'{args.name}-edges.webp'), lossless=True, method=6)
    print(f'assets/img/parts/{args.name}.webp  {img.width} x {img.height}  (set these as the img width and height)')


if __name__ == '__main__':
    main()
