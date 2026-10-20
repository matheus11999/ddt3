"""Recorta a folha de ícones de gênero (dois medalhões sobre magenta, do Codex)
para public/assets/ui/gender-icons.webp (2×1: masculino, feminino).
Uso: python3 scripts/cut-gender-icons.py <folha.png>"""
import sys
import numpy as np
from PIL import Image

SIZE=96
src=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32)
r,g,b=src[...,0],src[...,1],src[...,2]
# Distância ao magenta: 0 no fundo, sobe na pintura. Borda suave de alguns tons.
key=np.minimum(r,b)-g
alpha=np.clip((200-key)/80,0,1)
# Tira o reflexo magenta da borda semitransparente.
spill=np.clip(np.minimum(r,b)-g*1.05,0,None)*(1-alpha)
rgb=src.copy();rgb[...,0]-=spill;rgb[...,2]-=spill
rgba=np.dstack([np.clip(rgb,0,255),alpha*255]).astype(np.uint8)
image=Image.fromarray(rgba,'RGBA')
w,h=image.size
sheet=Image.new('RGBA',(SIZE*2,SIZE))
for i in range(2):
    half=image.crop((i*w//2,0,(i+1)*w//2,h))
    half=half.crop(half.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox())
    side=max(half.size);square=Image.new('RGBA',(side,side));square.paste(half,((side-half.width)//2,(side-half.height)//2))
    sheet.paste(square.resize((SIZE,SIZE),Image.LANCZOS),(i*SIZE,0))
sheet.save('public/assets/ui/gender-icons.webp',lossless=False,quality=92,method=6)
print('ok',sheet.size)
