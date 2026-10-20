"""Recorta as pranchas da interface da Pescaria (Codex, linha B, vidro azul com ouro) para
public/assets/fishing/ui/: painel do nível, bandeja de vara/isca (sem o botão da chave pintada nela,
que fica coberta pela chave própria), botão redondo de lançar (normal e aceso), as peças do minigame,
os botões Sacola e Trocas e a chave Auto (desligada, ligada e o selo sobre o pescador).
Uso: python3 scripts/build-fishing-ui.py   (o texto e os números são do jogo, nunca da pintura)"""
import json
import numpy as np
from PIL import Image

SRC='public/assets/fishing/source/15-ui-pescador-b.png'
OUT='public/assets/fishing/ui'
src=np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
r,g,b=src[...,0],src[...,1],src[...,2]
key=np.minimum(r,b)-g
alpha=np.clip((200-key)/80,0,1)
spill=np.clip(np.minimum(r,b)-g*1.05,0,None)*(1-alpha)
rgb=src.copy();rgb[...,0]-=spill;rgb[...,2]-=spill

# O botão dourado da chave da bandeja: pinta o trilho por baixo com a coluna do trilho vazio.
KX,KY,KR=918,751,33
yy,xx=np.mgrid[0:src.shape[0],0:src.shape[1]]
d=np.hypot(xx-KX,yy-KY)
column=rgb[:,1000].copy()
inside=d<KR+.5
rgb[inside]=column[yy[inside]]
# Os 2 px da borda do círculo se misturam, para não ficar um anel.
edge=(d>=KR+.5)&(d<KR+2.5)
t=((d-KR-.5)/2)[edge][:,None]
rgb[edge]=rgb[edge]*t+column[yy[edge]]*(1-t)

image=Image.fromarray(np.dstack([np.clip(rgb,0,255),alpha*255]).astype(np.uint8),'RGBA')
PIECES={'fisher-panel':(40,30,1120,460),'gear-tray':(70,480,1120,870),'cast-button':(1140,30,1630,470),'cast-button-lit':(1140,470,1630,930)}
geometry={}
SCALE=.5
for name,box in PIECES.items():
    piece=image.crop(box);bbox=piece.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox()
    piece=piece.crop(bbox);ox,oy=box[0]+bbox[0],box[1]+bbox[1]
    w,h=round(piece.width*SCALE),round(piece.height*SCALE)
    piece.resize((w,h),Image.LANCZOS).save(f'{OUT}/{name}.webp',quality=90,method=6)
    geometry[name]={'x':ox,'y':oy,'w':piece.width,'h':piece.height,'out':[w,h]}
print(json.dumps(geometry))

# ── Minigame (16-minigame-b.png) e botões Sacola/Trocas (17-botoes.png) ──
def keyed(path):
    s=np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r,g,b=s[...,0],s[...,1],s[...,2];k=np.minimum(r,b)-g;a=np.clip((200-k)/80,0,1)
    sp=np.clip(np.minimum(r,b)-g*1.05,0,None)*(1-a);c=s.copy();c[...,0]-=sp;c[...,2]-=sp
    return Image.fromarray(np.dstack([np.clip(c,0,255),a*255]).astype(np.uint8),'RGBA')
def cut(image,box,name,scale):
    piece=image.crop(box);bbox=piece.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox();piece=piece.crop(bbox)
    w,h=max(1,round(piece.width*scale)),max(1,round(piece.height*scale))
    piece.resize((w,h),Image.LANCZOS).save(f'{OUT}/{name}.webp',quality=90,method=6)
    geometry[name]={'x':box[0]+bbox[0],'y':box[1]+bbox[1],'w':piece.width,'h':piece.height,'out':[w,h]}
mini=keyed('public/assets/fishing/source/16-minigame-b.png')
for name,box in {'mini-panel':(70,14,1700,380),'mini-water':(180,384,1592,488),'mini-target':(540,536,1034,644),'mini-float':(1130,488,1262,690),
    'mini-gem':(134,680,300,860),'mini-gem-empty':(374,680,546,860),'mini-miss':(634,680,794,860),'mini-star':(880,660,1090,880),'mini-star-empty':(1142,650,1340,880),'mini-fish':(1400,690,1640,850)}.items():
    cut(mini,box,name,.5)
buttons=keyed('public/assets/fishing/source/17-botoes.png')
for name,box in {'bag-button':(40,40,620,630),'trade-button':(640,40,1230,630),'bag-button-lit':(40,640,620,1230),'trade-button-lit':(640,640,1230,1230)}.items():
    cut(buttons,box,name,.25)
print(json.dumps({k:v for k,v in geometry.items() if k.startswith(('mini','bag','trade'))}))
# Chave Auto pintada (18-toggle-auto.png, linha B): desligada, ligada e o selo que flutua sobre o pescador.
toggle=keyed('public/assets/fishing/source/18-toggle-auto.png')
for name,box in {'auto-off':(5,515,622,845),'auto-on':(625,515,1277,845),'auto-seal':(1280,470,1660,870)}.items():
    cut(toggle,box,name,.25 if name!='auto-seal' else .3)
print(json.dumps({k:v for k,v in geometry.items() if k.startswith('auto')}))
