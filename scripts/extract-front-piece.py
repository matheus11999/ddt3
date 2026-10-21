"""Lifts a hair or hat that Codex painted ON the front head (an edit of the head image) off that head, so the piece
fits the head exactly: the piece is every pixel that changed or lies outside the head. Small specks are dropped.
Usage: py scripts/extract-front-piece.py <head.png> <edited.png> <out.png>
"""
import sys

import numpy as np
from PIL import Image, ImageFilter

base = np.asarray(Image.open(sys.argv[1]).convert('RGBA')).astype(int)
edit = np.asarray(Image.open(sys.argv[2]).convert('RGBA').resize((base.shape[1], base.shape[0]), Image.LANCZOS)).astype(int)
diff = np.abs(edit[..., :3] - base[..., :3]).sum(axis=2)
outside = (base[..., 3] < 40) & (edit[..., 3] > 40)
changed = (diff > 70) & (edit[..., 3] > 40)
mask = Image.fromarray(((outside | changed) * 255).astype(np.uint8))
mask = mask.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1))
alpha = np.minimum(np.asarray(mask).astype(int), edit[..., 3])
out = edit.copy()
out[..., 3] = alpha
Image.fromarray(out.astype(np.uint8), 'RGBA').save(sys.argv[3])
print(sys.argv[3], int((alpha > 128).sum()), 'px')
