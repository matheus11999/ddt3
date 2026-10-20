"""Recorta a prancha do painel do pescador (Codex, opção B, vidro azul com ouro) para
public/assets/fishing/ui/: painel do nível, bandeja de vara/isca com a chave Auto sem o botão
(o botão vira peça própria, para o jogo mover), e o botão redondo de lançar (normal e aceso).
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

# A chave Auto: o botão dourado cobre a ponta esquerda do trilho. Guarda o botão e pinta o trilho
# por baixo com a mesma coluna do trilho vazio (o degradê do trilho é só vertical).
KX,KY,KR=918,751,33
yy,xx=np.mgrid[0:src.shape[0],0:src.shape[1]]
d=np.hypot(xx-KX,yy-KY)
knob=np.dstack([np.clip(rgb,0,255),np.clip((KR+1.5-d)/2,0,1)*alpha*255]).astype(np.uint8)
knob=Image.fromarray(knob,'RGBA').crop((KX-KR-2,KY-KR-2,KX+KR+3,KY+KR+3))
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
kw=round(knob.width*SCALE);knob.resize((kw,kw),Image.LANCZOS).save(f'{OUT}/switch-knob.webp',quality=90,method=6)
geometry['knob']={'x':KX-KR-2,'y':KY-KR-2,'w':knob.width,'out':[kw,kw]}
print(json.dumps(geometry))
