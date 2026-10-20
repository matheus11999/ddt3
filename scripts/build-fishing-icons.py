"""Recorta os ícones pintados da Pescaria (Codex, 20/10) para public/assets/fishing/icons/<id>.png:
os peixes por raridade (19a comum/normal, 19b raro/épico, 19c lendários), as varas e o Fragmento da
Vara das Marés (20-varas). Cada ícone sai 256 x 256, fundo transparente, objeto centralizado.
Uso: python3 scripts/build-fishing-icons.py"""
import numpy as np
from PIL import Image

SRC='public/assets/fishing/source'
OUT='public/assets/fishing/icons'
SIZE,FILL=256,.9

def keyed(path):
    s=np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r,g,b=s[...,0],s[...,1],s[...,2];k=np.minimum(r,b)-g;a=np.clip((200-k)/80,0,1)
    sp=np.clip(np.minimum(r,b)-g*1.05,0,None)*(1-a);c=s.copy();c[...,0]-=sp;c[...,2]-=sp
    return Image.fromarray(np.dstack([np.clip(c,0,255),a*255]).astype(np.uint8),'RGBA')

def runs(profile,gap):
    """Spans of non-empty positions, merging holes shorter than `gap`."""
    out=[];start=None;last=-gap
    for i,v in enumerate(profile):
        if v:
            if start is None:start=i
            elif i-last>gap:out.append((start,last+1));start=i
            last=i
    if start is not None:out.append((start,last+1))
    return out

def pieces(image,gap=24,min_size=60):
    """Objects in reading order: bands of rows, then columns inside each band."""
    a=np.asarray(image.getchannel('A'))>40
    found=[]
    for y0,y1 in runs(a.any(axis=1),gap):
        for x0,x1 in runs(a[y0:y1].any(axis=0),gap):
            sub=a[y0:y1,x0:x1];ys=np.where(sub.any(axis=1))[0]
            box=(x0,y0+ys[0],x1,y0+ys[-1]+1)
            if box[2]-box[0]>=min_size and box[3]-box[1]>=min_size:found.append(box)
    return found

def grid(image,cols,rows):
    """Objects of a regular sheet: the painted part of each cell (fins may cross into the neighbour's gap)."""
    a=np.asarray(image.getchannel('A'))>40;h,w=a.shape;found=[]
    for r in range(rows):
        for c in range(cols):
            x0,y0,x1,y1=c*w//cols,r*h//rows,(c+1)*w//cols,(r+1)*h//rows;sub=a[y0:y1,x0:x1]
            ys,xs=np.where(sub.any(axis=1))[0],np.where(sub.any(axis=0))[0]
            found.append((x0+xs[0],y0+ys[0],x0+xs[-1]+1,y0+ys[-1]+1))
    return found

def main_body(piece):
    """Keeps only the biggest painted shape (a neighbour's fin tip in the cell is dropped)."""
    a=np.asarray(piece.getchannel('A'));h,w=a.shape;step=4
    small=a[::step,::step]>40;sh,sw=small.shape;label=np.zeros((sh,sw),np.int32);sizes=[0];n=0
    for y in range(sh):
        for x in range(sw):
            if not small[y,x] or label[y,x]:continue
            n+=1;label[y,x]=n;stack=[(y,x)];size=0
            while stack:
                cy,cx=stack.pop();size+=1
                for ny in range(max(0,cy-1),min(sh,cy+2)):
                    for nx in range(max(0,cx-1),min(sw,cx+2)):
                        if small[ny,nx] and not label[ny,nx]:label[ny,nx]=n;stack.append((ny,nx))
            sizes.append(size)
    if n<=1:return piece
    keep=label==int(np.argmax(sizes))
    keep=np.repeat(np.repeat(keep,step,axis=0),step,axis=1)[:h,:w]
    # One cell of slack around the kept shape so its soft edge survives.
    grown=keep.copy()
    for dy in range(-step,step+1,step):
        for dx in range(-step,step+1,step):grown|=np.roll(np.roll(keep,dy,axis=0),dx,axis=1)
    out=np.asarray(piece).copy();out[...,3]=np.where(grown,out[...,3],0)
    cleaned=Image.fromarray(out,'RGBA');return cleaned.crop(cleaned.getchannel('A').point(lambda v:255 if v>24 else 0).getbbox())

def save(image,box,name):
    piece=main_body(image.crop(box));w,h=piece.size;scale=SIZE*FILL/max(w,h)
    piece=piece.resize((max(1,round(w*scale)),max(1,round(h*scale))),Image.LANCZOS)
    canvas=Image.new('RGBA',(SIZE,SIZE));canvas.paste(piece,((SIZE-piece.width)//2,(SIZE-piece.height)//2),piece)
    canvas.save(f'{OUT}/{name}.png',optimize=True)

SHEETS={
    '19a-peixes.png':['bota-velha','lambari-dourado','tilapia-rosada','carpa-lua','bagre-barbudo','peixe-vidro','traira-taboa','carpa-termal',None],
    '19b-peixes.png':['baiacu-bolha','tucunare-brasa','truta-aurora','pacu-esmeralda','salamandra-vapor','koi-celeste','enguia-trovao','dourado-real','dourado-do-junco'],
    '19c-peixes.png':['pirarucu-ancestral','carpa-dragao'],
    '20-varas.png':['rod-bamboo','rod-oak','rod-coral','rod-crystal','rod-aurora','rod-royal','fragment'],
    # Ficha dos Pontos de Pesca (ao lado do ouro e dos cupons) e a pilha para valores grandes.
    '23-moeda-pesca.png':['fishing-points','fishing-points-stack'],
}
if __name__=='__main__':
    import os;os.makedirs(OUT,exist_ok=True)
    for sheet,names in SHEETS.items():
        image=keyed(f'{SRC}/{sheet}');boxes=grid(image,3,3) if len(names)==9 else grid(image,2,1) if len(names)==2 else pieces(image)
        if len(boxes)!=len(names):raise SystemExit(f'{sheet}: {len(boxes)} peças, esperava {len(names)}: {boxes}')
        for box,name in zip(boxes,names):
            if name:save(image,box,name)
        print(sheet,len(boxes),'ok')
