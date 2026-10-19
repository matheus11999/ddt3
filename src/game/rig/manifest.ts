import {HEAD_ANCHORS,RIG_VERSION} from './anchors';
import type {FitClass,HeadProfile,Point} from './anchors';

export type Rect=readonly [number,number,number,number];
/** Two points in the art (atlas px) and the two head-template points they land on.
 * Placement is a similarity transform (move, rotate, uniform scale): art is never stretched. */
export interface Pin {from:readonly [Point,Point];to:readonly [Point,Point];}
/** A painted piece inside an atlas. `clip` uses atlas coordinates and excludes neighbouring pieces. */
export interface ArtRegion {atlas:string;source:Rect;clip?:readonly Point[];pin:Pin;}
export interface CosmeticManifest {
 /** Rig the art was authored for; a different generation is measured against its own contract. */
 rig:number;
 slot:'hair'|'hat'|'glasses';
 fit:FitClass;
 /** Hats: which hair variant they ask for. */
 profile?:HeadProfile;
 /** Art worn without a covering hat (hair) or the piece itself (hat, glasses). */
 worn?:ArtRegion;
 /** Hair: variant painted for tight, wide and helmet profiles. */
 covered?:ArtRegion;
 /** Still drawn in code; replaced by painted art in phase 3. */
 procedural?:true;
}

/** Pin for art authored as an axis-aligned rectangle on the head template. */
export const pinFromRect=([sx,sy,sw]:Rect,[dx,dy,dw]:Rect):Pin=>({from:[[sx,sy],[sx+sw,sy]],to:[[dx,dy],[dx+dw,dy]]});
const SIZE=HEAD_ANCHORS.atlasSize;
/** Art painted directly on the full 1254px head template. */
export const onTemplate=(atlas:string):ArtRegion=>({atlas,source:[0,0,SIZE,SIZE],pin:pinFromRect([0,0,SIZE,SIZE],[0,0,SIZE,SIZE])});
const region=(atlas:string,source:Rect,destination:Rect,clip?:readonly Point[]):ArtRegion=>({atlas,source,clip,pin:pinFromRect(source,destination)});
/** Uniformly shrinks an oversized painted piece around the skull centre until it fits its zone.
 * Stopgap for art painted too large; repainted art at the right size drops it.
 * A pivot near the far eye keeps a fringe from sliding over the eyes as the piece narrows. */
const skullCentre:Point=[(HEAD_ANCHORS.templeNear[0]+HEAD_ANCHORS.templeFar[0])/2,HEAD_ANCHORS.templeNear[1]];
const shrink=([x,y,w,h]:Rect,k:number,[cx,cy]:Point=skullCentre):Rect=>[cx+(x-cx)*k,cy+(y-cy)*k,w*k,h*k];
const ACCESSORIES='/assets/shop-accessories.png',COVERED='/assets/hair-covered-atlas.png',HEADWEAR='/assets/headwear-worn-atlas.png';
/** Hat contacts: the inner band's front and back edge in the atlas. Every hat sits on the same seat. */
const hat=(source:Rect,from:readonly [Point,Point],clip?:readonly Point[]):ArtRegion=>({atlas:HEADWEAR,source,clip,pin:{from,to:HEAD_ANCHORS.hatSeat}});

/** Every visible hair, hat and glasses item. New items are added here, never as ad-hoc numbers in the renderer. */
export const COSMETIC_MANIFEST:Readonly<Record<string,CosmeticManifest>>={
 'hair-wavy':{rig:RIG_VERSION,slot:'hair',fit:'hair-long',worn:region('/assets/hair-wavy.png',[280,65,820,760],[349.9,100,600,556]),covered:region(COVERED,[850,48,585,470],[330,160,526.5,423])},
 'hair-undercut':{rig:RIG_VERSION,slot:'hair',fit:'hair-short',
  worn:region(ACCESSORIES,[25,85,610,500],shrink([288,2.3,666.2,548.6],.9),[[25,85],[635,85],[635,375],[600,450],[600,585],[25,585]]),
  covered:region(COVERED,[190,535,520,410],[365,185,468,369])},
 'hair-ponytail':{rig:RIG_VERSION,slot:'hair',fit:'hair-long',
  worn:region(ACCESSORIES,[600,85,650,660],shrink([217.4,2.3,728.9,736.7],.9),[[640,85],[1250,85],[1250,745],[600,745],[600,450],[640,375]]),
  covered:region(COVERED,[835,535,620,475],[295,175,558,427.5])},
 'hair-captain':{rig:RIG_VERSION,slot:'hair',fit:'hair-short',worn:region('/assets/hair-captain.png',[214,58,956,677],[334,57,602,426])},
 'hair-hiphop':{rig:RIG_VERSION,slot:'hair',fit:'hair-short',worn:region('/assets/hair-hiphop.png',[179,190,1064,858],[339,60,532,429])},
 'hair-swordsman':{rig:RIG_VERSION,slot:'hair',fit:'hair-short',worn:region('/assets/hair-swordsman.png',[266,146,894,661],[338,62,584,432])},
 'hair-horizon':{rig:RIG_VERSION,slot:'hair',fit:'hair-short',worn:region('/assets/hair-horizon.png',[270,49,753,593],shrink([288,25.8,674,533],.9,[760,250])),covered:region('/assets/hair-horizon.png',[312,739,698,472],[345,195,500,338])},
 'hat-cap':{rig:RIG_VERSION,slot:'hat',fit:'hat-tight',profile:'tight',worn:hat([35,130,522,332],[[126,442],[485,330]])},
 'hat-thunder':{rig:RIG_VERSION,slot:'hat',fit:'hat-tight',profile:'tight',worn:hat([560,130,490,320],[[600,423],[960,333]],[[560,130],[1050,130],[1050,398],[1020,430],[1020,450],[560,450]])},
 'hat-tide':{rig:RIG_VERSION,slot:'hat',fit:'hat-tight',profile:'tight',worn:hat([1030,130,500,330],[[1065,440],[1410,358]],[[1070,130],[1530,130],[1530,460],[1030,460],[1030,430],[1065,390],[1070,350]])},
 'hat-ruby':{rig:RIG_VERSION,slot:'hat',fit:'hat-tight',profile:'tight',worn:hat([45,560,485,330],[[150,830],[465,760]])},
 'hat-tropical':{rig:RIG_VERSION,slot:'hat',fit:'hat-wide',profile:'wide',worn:hat([540,560,510,335],[[650,817],[925,742]],[[540,560],[1030,560],[1030,690],[1050,695],[1050,775],[1020,790],[1020,895],[540,895]])},
 'hat-mage':{rig:RIG_VERSION,slot:'hat',fit:'hat-wide',profile:'wide',worn:hat([1035,480,495,410],[[1140,822],[1420,803]],[[1035,480],[1530,480],[1530,890],[1035,890],[1035,810],[1090,790],[1090,680],[1035,680]])},
 'hat-captain':{rig:RIG_VERSION,slot:'hat',fit:'hat-tight',profile:'tight',worn:{atlas:'/assets/hat-captain.png',source:[140,300,995,605],pin:{from:[[310,852],[1030,774]],to:HEAD_ANCHORS.hatSeat}}},
 'hat-hiphop':{rig:RIG_VERSION,slot:'hat',fit:'hat-tight',profile:'tight',worn:{atlas:'/assets/hat-hiphop.png',source:[126,296,1073,623],pin:{from:[[250,872],[960,756]],to:HEAD_ANCHORS.hatSeat}}},
 'hat-swordsman':{rig:RIG_VERSION,slot:'hat',fit:'hat-wide',profile:'wide',worn:{atlas:'/assets/hat-swordsman.png',source:[96,324,1081,632],pin:{from:[[330,840],[980,720]],to:HEAD_ANCHORS.hatSeat}}},
 // Optical centres of each lens land on the universal eye sockets.
 'glasses-sport':{rig:RIG_VERSION,slot:'glasses',fit:'glasses',worn:{atlas:ACCESSORIES,source:[45,880,570,235],pin:{from:[[344,1014],[557,1042]],to:[HEAD_ANCHORS.nearEye,HEAD_ANCHORS.farEye]}}},
 'glasses-cat':{rig:RIG_VERSION,slot:'glasses',fit:'glasses',worn:{atlas:ACCESSORIES,source:[640,890,600,240],pin:{from:[[945,1018],[1155,1036]],to:[HEAD_ANCHORS.nearEye,HEAD_ANCHORS.farEye]}}},
 'glasses-navigator':{rig:RIG_VERSION,slot:'glasses',fit:'glasses',worn:{atlas:'/assets/glasses-navigator.png',source:[29,483,1197,387],pin:{from:[[640,679],[1094,704]],to:[HEAD_ANCHORS.nearEye,HEAD_ANCHORS.farEye]}}},
 'glasses-hiphop':{rig:RIG_VERSION,slot:'glasses',fit:'glasses',worn:{atlas:'/assets/glasses-hiphop.png',source:[215,234,1556,494],pin:{from:[[965,490],[1548,540]],to:[HEAD_ANCHORS.nearEye,HEAD_ANCHORS.farEye]}}},
 'glasses-captain':{rig:RIG_VERSION,slot:'glasses',fit:'glasses',worn:{atlas:'/assets/glasses-captain.png',source:[28,254,1736,490],pin:{from:[[879,493],[1539,566]],to:[HEAD_ANCHORS.nearEye,HEAD_ANCHORS.farEye]}}},
};
/** Hats with tight, wide or helmet profiles hide the uncovered hairstyle. */
export const coversHair=(profile?:HeadProfile)=>profile==='tight'||profile==='wide'||profile==='helmet';
