"""Builds the aim art of docs/hitbox-aim.md from the raw Codex paintings.

  py -3 scripts/build-aim-art.py <aim-red-arc-raw.png> <aim-yellow-dot-raw.png>

The arc's centre of curvature is fitted on its outer rim, the images are trimmed and scaled down, and the
texture sizes and pivots are written into src/game/aimArt.json (its `draw` section, the TakeAimAsset
geometry in world units, is kept as it is)."""
import json,math,os,sys
from PIL import Image
OUT='public/assets/ui/aim/'
# Outer rim radius of the arc in texture pixels: drawn at ~100 world px, sharp up to 2x screens.
ARC_RIM=200
DOT_SIZE=32

def fit_circle(points):
    # Kasa least squares: x^2+y^2+Dx+Ey+F=0
    sxx=sxy=syy=sx=sy=sxz=syz=sz=0.0;n=len(points)
    for x,y in points:
        z=x*x+y*y;sxx+=x*x;sxy+=x*y;syy+=y*y;sx+=x;sy+=y;sxz+=x*z;syz+=y*z;sz+=z
    # normal equations for D,E,F
    A=[[sxx,sxy,sx],[sxy,syy,sy],[sx,sy,n]];b=[-sxz,-syz,-sz]
    for i in range(3):
        p=max(range(i,3),key=lambda r:abs(A[r][i]));A[i],A[p]=A[p],A[i];b[i],b[p]=b[p],b[i]
        for r in range(3):
            if r!=i:
                f=A[r][i]/A[i][i];A[r]=[a-f*c for a,c in zip(A[r],A[i])];b[r]-=f*b[i]
    D,E,F=(b[i]/A[i][i] for i in range(3))
    cx,cy=-D/2,-E/2;return cx,cy,math.sqrt(cx*cx+cy*cy-F)

arc=Image.open(sys.argv[1]).convert('RGBA');alpha=arc.getchannel('A');w,h=arc.size;px=alpha.load()
# Outer rim: on each row through the band, the first strongly opaque pixel from the left.
rim=[]
for y in range(h):
    for x in range(w//2):
        if px[x,y]>=160:rim.append((x+.5,y+.5));break
cx,cy,r=fit_circle(rim)
residual=max(abs(math.hypot(x-cx,y-cy)-r) for x,y in rim)
box=alpha.getbbox();arc=arc.crop(box);cx-=box[0];cy-=box[1]
scale=ARC_RIM/r;arc=arc.resize((round(arc.width*scale),round(arc.height*scale)),Image.LANCZOS)
arc.save(OUT+'aim-red-arc.png',optimize=True)
dot=Image.open(sys.argv[2]).convert('RGBA');dbox=dot.getchannel('A').point(lambda v:255 if v>8 else 0).getbbox()
side=max(dbox[2]-dbox[0],dbox[3]-dbox[1]);mx,my=(dbox[0]+dbox[2])/2,(dbox[1]+dbox[3])/2
dot=dot.crop((round(mx-side/2),round(my-side/2),round(mx+side/2),round(my+side/2))).resize((DOT_SIZE,DOT_SIZE),Image.LANCZOS)
dot.save(OUT+'aim-yellow-dot.png',optimize=True)
# The solid square inside its glow: what the original 3x3 dot measures.
body=dot.getchannel('A').point(lambda v:255 if v>=200 else 0).getbbox();body_size=max(body[2]-body[0],body[3]-body[1])
MANIFEST='src/game/aimArt.json'
manifest=json.load(open(MANIFEST,encoding='utf8')) if os.path.exists(MANIFEST) else {}
manifest.update({
 'source':'Original paintings made with Codex image generation from the TakeAimAsset study (output/player-hitbox-aim-reference), 19/10/2026; built by scripts/build-aim-art.py.',
 'units':'arc/dot: texture pixels. draw: DDTank TakeAimAsset units, multiplied by draw.scale into Brasa world pixels.',
 'arc':{'file':'/assets/ui/aim/aim-red-arc.png','size':[arc.width,arc.height],'pivot':[round(cx*scale,2),round(cy*scale,2)],'rimRadius':ARC_RIM,'rimFitResidual':round(residual*scale,2),
        'note':'Painted facing LEFT (forward = 9 o\'clock), sweeping from 12 to about 7 o\'clock; mirrored for facing right and turned with the body tilt.'},
 'dot':{'file':'/assets/ui/aim/aim-yellow-dot.png','size':[DOT_SIZE,DOT_SIZE],'pivot':[DOT_SIZE/2,DOT_SIZE/2],'bodySize':body_size},
})
json.dump(manifest,open(MANIFEST,'w',encoding='utf8'),indent=1,ensure_ascii=False)
print(json.dumps(manifest,indent=1))
