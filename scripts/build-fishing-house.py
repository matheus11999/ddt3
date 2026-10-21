"""Recorta a prancha da Casa de Pesca (Codex, 20/10, vidro azul com ouro da Pescaria) para
public/assets/fishing/house/: aba normal e ativa, card de item e o botão Resgatar.
Uso: py scripts/build-fishing-house.py   (texto e números são do jogo, nunca da pintura)"""
import numpy as np
from PIL import Image

SRC='public/assets/fishing/source/27-casa-de-pesca.png'
OUT='public/assets/fishing/house'
src=np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
r,g,b=src[...,0],src[...,1],src[...,2]
key=np.minimum(r,b)-g
alpha=np.clip((200-key)/80,0,1)
spill=np.clip(np.minimum(r,b)-g*1.05,0,None)*(1-alpha)
rgb=src.copy();rgb[...,0]-=spill;rgb[...,2]-=spill
image=Image.fromarray(np.dstack([np.clip(rgb,0,255),alpha*255]).astype(np.uint8),'RGBA')
PIECES={'tab':((600,255,1035,400),.5),'tab-active':((1035,220,1510,400),.5),'card':((630,430,930,715),.5),'button':((930,555,1510,740),.5)}
for name,(box,scale) in PIECES.items():
    piece=image.crop(box);bbox=piece.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox()
    piece=piece.crop(bbox);w,h=round(piece.width*scale),round(piece.height*scale)
    piece.resize((w,h),Image.LANCZOS).save(f'{OUT}/{name}.webp',quality=90,method=6)
    print(name,(w,h))
