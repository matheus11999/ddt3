"""Expedition picker art for the Formigueiro, composed only from the game's own painted assets:
the two anthill stages (built by `npm run build:map`) fade into each other left to right, the three ants
walk on the fallen log and the queen waits on her throne. No text: the game writes the title.
Also one portrait card per stage for the room's board once a stage is chosen (stage-1.webp, stage-2.webp).
Usage: python3 scripts/compose-expedition-cover.py  (after building both maps)"""
from PIL import Image, ImageDraw, ImageFilter

TOP, H, W = 90, 774, 1768            # crop of the 3072x864 maps, before the final resize
LEFT_X, RIGHT_X = 160, 1150           # where each stage's crop starts
OUT = 'public/assets/expeditions/anthill/picker-art.webp'

def stage(name, x0, top=None, w=None, h=None):
    top, w, h = top if top is not None else TOP, w or W, h or H
    art = Image.open(f'test-results/maps-kit/{name}/montage.png').convert('RGBA').crop((x0, top, x0 + w, top + h))
    terrain = Image.open(f'public/assets/maps/{name}/terrain-world.png').split()[-1]
    return art, terrain

def ground(terrain, x):
    for y in range(terrain.height):
        if terrain.getpixel((x, y)) > 128:
            return y
    return terrain.height

def frame(kind, index=0):
    strip = Image.open(f'public/assets/expeditions/anthill/{kind}.png').convert('RGBA')
    w = strip.width // 4
    return strip.crop((index * w, 0, (index + 1) * w, strip.height))

def place(canvas, kind, x, feet_y, height, flip=False, index=0):
    f = frame(kind, index)
    f = f.resize((round(f.width * height / f.height), height), Image.LANCZOS)
    if flip:
        f = f.transpose(Image.FLIP_LEFT_RIGHT)
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((x - f.width * .3, feet_y - 9, x + f.width * .3, feet_y + 7), fill=(30, 12, 4, 120))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(6)))
    canvas.alpha_composite(f, (round(x - f.width / 2), round(feet_y - f.height * .99)))

log, log_ground = stage('anthill-1', LEFT_X)
chamber, chamber_ground = stage('anthill-2', RIGHT_X)
# Soft left-to-right fade from the log into the queen's chamber.
FADE_FROM, FADE_TO = 960, 1300
fade = Image.new('L', (W, H), 0)
draw = ImageDraw.Draw(fade)
for x in range(FADE_FROM, W):
    k = min(1, (x - FADE_FROM) / (FADE_TO - FADE_FROM))
    draw.line((x, 0, x, H), fill=round(255 * k * k * (3 - 2 * k)))
canvas = Image.composite(chamber, log, fade)
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((950, 160, 1350, 760), fill=(255, 196, 110, 70))
canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(60)))

for kind, x, height in (('ant-brute', 360, 200), ('ant-soldier', 620, 168), ('ant-worker', 840, 142)):
    place(canvas, kind, x, ground(log_ground, LEFT_X + x) - TOP + 4, height)
queen_x = 2600 - RIGHT_X
place(canvas, 'ant-queen', queen_x, ground(chamber_ground, 2600) - TOP + 6, 300)

# Gentle vignette and a darker foot so the title the game draws stays readable.
shade = Image.new('L', (W, H), 0)
draw = ImageDraw.Draw(shade)
for i in range(160):
    draw.line((0, H - i, W, H - i), fill=round(150 * (1 - i / 160) ** 1.6))
vignette = Image.new('L', (W, H), 0)
ImageDraw.Draw(vignette).rectangle((0, 0, W, H), outline=255, width=40)
shade = Image.eval(Image.merge('L', [shade]), lambda v: v)
dark = Image.new('RGBA', (W, H), (34, 12, 2, 0))
dark.putalpha(Image.composite(Image.new('L', (W, H), 255), shade, vignette.filter(ImageFilter.GaussianBlur(50))).point(lambda v: min(v, 150)))
canvas.alpha_composite(dark)
canvas.convert('RGB').resize((1280, round(1280 * H / W)), Image.LANCZOS).save(OUT, quality=88)
print('gravado', OUT)


def darken_foot(canvas, rows=220, strength=170):
    w, h = canvas.size
    foot = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(foot)
    for i in range(rows):
        draw.line((0, h - i, w, h - i), fill=(30, 10, 2, round(strength * (1 - i / rows) ** 1.5)))
    canvas.alpha_composite(foot)

# Stage cards: 714x800 crops of each map (y 64..864) with its creatures, resized to 768x860.
CARD_TOP, CARD_W, CARD_H = 64, 714, 800
card, card_ground = stage('anthill-1', 640, CARD_TOP, CARD_W, CARD_H)
for kind, x, height in (('ant-brute', 765, 214), ('ant-soldier', 1035, 180), ('ant-worker', 1250, 150)):
    place(card, kind, x - 640, ground(card_ground, x) - CARD_TOP + 4, height)
darken_foot(card)
card.convert('RGB').resize((768, 860), Image.LANCZOS).save('public/assets/expeditions/anthill/stage-1.webp', quality=88)
card, card_ground = stage('anthill-2', 2190, CARD_TOP, CARD_W, CARD_H)
place(card, 'ant-worker', 2300 - 2190, ground(card_ground, 2300) - CARD_TOP + 4, 140)
place(card, 'ant-queen', 2600 - 2190, ground(card_ground, 2600) - CARD_TOP + 6, 330)
darken_foot(card)
card.convert('RGB').resize((768, 860), Image.LANCZOS).save('public/assets/expeditions/anthill/stage-2.webp', quality=88)
print('gravado public/assets/expeditions/anthill/stage-1.webp e stage-2.webp')
