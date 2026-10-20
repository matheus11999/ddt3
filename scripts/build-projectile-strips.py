# Animated projectile strips for one weapon, from a frame package (manifest.json with `sequences`, each with
# `phase`, `mode` normal|pow, `frameFiles`, `frameRate` and `originPixels`, the bright core the projectile flies on).
# Crops every sequence to the union of its frames, scales it down and writes a horizontal strip per phase and mode
# to public/assets/weapons/<id>/projectile/<mode>-<stage>.png, plus src/game/projectileStrips.json (frame count,
# fps and where the core sits in the frame), which src/game/weaponEffects.ts reads.
# Usage: python3 scripts/build-projectile-strips.py --weapon=thunder-coil --src=output/thunder-projectiles-original-v1
# --spin is for a package whose frames only rotate one painting rigidly (rotation.bakedSpin, the wind shuriken):
# it keeps the first frame and records rotation.degreesPerSecond, and the game turns that frame in code.
import argparse, json, os
from PIL import Image

MAX_SIDE = 192

parser = argparse.ArgumentParser()
parser.add_argument('--weapon', required=True)
parser.add_argument('--src', required=True)
parser.add_argument('--spin', action='store_true')
args = parser.parse_args()
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
manifest = json.load(open(os.path.join(args.src, 'manifest.json'), encoding='utf-8'))
out_dir = os.path.join(root, 'public', 'assets', 'weapons', args.weapon, 'projectile')
os.makedirs(out_dir, exist_ok=True)
index_path = os.path.join(root, 'src', 'game', 'projectileStrips.json')
index = json.load(open(index_path, encoding='utf-8')) if os.path.exists(index_path) else {}
entry = {}
for sequence in manifest['sequences']:
    frames = [Image.open(os.path.join(args.src, item['file'])).convert('RGBA') for item in sequence['frameFiles'][:1 if args.spin else None]]
    box = None
    for frame in frames:
        b = frame.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    x0, y0, x1, y1 = max(0, box[0] - 2), max(0, box[1] - 2), min(frames[0].width, box[2] + 2), min(frames[0].height, box[3] + 2)
    w, h = x1 - x0, y1 - y0
    scale = min(1, MAX_SIDE / max(w, h))
    fw, fh = max(1, round(w * scale)), max(1, round(h * scale))
    strip = Image.new('RGBA', (fw * len(frames), fh))
    for n, frame in enumerate(frames):
        strip.paste(frame.crop((x0, y0, x1, y1)).resize((fw, fh), Image.LANCZOS), (n * fw, 0))
    stage = sequence['stage']
    strip.save(os.path.join(out_dir, f"{sequence['mode']}-{stage}.png"), optimize=True)
    ox, oy = sequence['originPixels']
    entry.setdefault(sequence['mode'], {})[str(stage)] = {
        'frames': len(frames), 'width': fw, 'height': fh,
        # The core as a share of the frame: the game puts it on the projectile's position.
        'pivot': [round((ox - x0) / w, 4), round((oy - y0) / h, 4)],
        # The painting's width as a share of its 512 px source frame, so every phase keeps its painted scale.
        'span': round(w / frames[0].width, 4)
    }
    entry['fps'] = sequence['frameRate']
    if args.spin: entry['spin'] = sequence['rotation']['degreesPerSecond'] * (1 if sequence['rotation']['direction'] == 'clockwise' else -1)
index[args.weapon] = entry
with open(index_path, 'w', encoding='utf-8') as f:
    json.dump(index, f, indent=1)
    f.write('\n')
print(json.dumps(entry))
