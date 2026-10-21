"""Rig v2 (docs/rig-v2.md): copies the assembled sheets of a kit into public/assets/rig/<sex>/<context>/<item>.png and
rebuilds src/game/character/rigIndex.json (which items have art in which context).

  py scripts/rig/publish.py <sex> <context> <item-id> <sheet.png>    one sheet (hair: <item-id>-A / -B)
  py scripts/rig/publish.py --index                                  only rebuild the index
Contexts: game (13x3), show (one cell; a face sheet has the 4 blink cells), virtual (body 7x2), virtualhead (3 cells).
"""
import json
import os
import shutil
import sys

ROOT = 'public/assets/rig'


def index():
    data = {}
    for sex in ('m', 'f'):
        for context in ('game', 'show', 'virtual', 'virtualhead'):
            folder = f'{ROOT}/{sex}/{context}'
            if os.path.isdir(folder):
                data.setdefault(sex, {})[context] = sorted(name[:-4] for name in os.listdir(folder) if name.endswith('.png'))
    with open('src/game/character/rigIndex.json', 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, indent=1)
        f.write('\n')
    print('src/game/character/rigIndex.json', {s: {c: len(v) for c, v in d.items()} for s, d in data.items()})


if __name__ == '__main__':
    if sys.argv[1] != '--index':
        sex, context, item, path = sys.argv[1:5]
        os.makedirs(f'{ROOT}/{sex}/{context}', exist_ok=True)
        shutil.copyfile(path, f'{ROOT}/{sex}/{context}/{item}.png')
    index()
