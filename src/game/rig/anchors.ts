import {FACE_REGISTRATION} from '../faces';

/** Rig v1: the shared contract every cosmetic is measured against.
 * Coordinates use the same 1254px head template as FACE_REGISTRATION. A future body
 * or head generation gets a new RIG_VERSION with its own anchors and zones; items
 * declare the rig they were authored for, so old and new generations never mix silently. */
export const RIG_VERSION=1;
export type Point=readonly [number,number];

/** Measured from the composed universal head (character-base.png + any face). */
export const HEAD_ANCHORS={
 atlasSize:FACE_REGISTRATION.atlasSize,
 crown:[631,182] as Point,
 templeNear:[427,370] as Point,
 templeFar:[841,370] as Point,
 browLine:400,
 nearEye:FACE_REGISTRATION.sockets.leftEye as Point,
 farEye:FACE_REGISTRATION.sockets.rightEye as Point,
 nose:FACE_REGISTRATION.sockets.nose as Point,
 mouth:FACE_REGISTRATION.sockets.mouth as Point,
 neckPivot:FACE_REGISTRATION.neckPivot as Point,
 neckLine:631,
 /** One seat for every hat: front and back of the inner band. */
 hatSeat:[[428,406],[817,346]] as readonly [Point,Point]
} as const;
/** Head width (W). Every size limit is a multiple of it. */
export const HEAD_WIDTH=417;

/** Painted features no hair or hat may cover: eyes and mouth. */
export const FACE_KEEPOUT:readonly {center:Point;radius:Point}[]=[
 {center:HEAD_ANCHORS.nearEye,radius:[44,40]},
 {center:HEAD_ANCHORS.farEye,radius:[34,38]},
 {center:HEAD_ANCHORS.mouth,radius:[30,16]}
];

export type FitClass='hair-short'|'hair-long'|'hat-tight'|'hat-wide'|'hat-band'|'hat-helmet'|'glasses';
export type HeadProfile='open'|'band'|'tight'|'wide'|'helmet';
export interface FitZone {
 /** Maximum width as a multiple of HEAD_WIDTH; glasses also have a minimum. */
 maxWidth:number;minWidth?:number;
 /** How far above the crown the piece may rise, as a multiple of HEAD_WIDTH. */
 maxAboveCrown:number;
 /** Lowest allowed painted row (template px). */
 maxBottom:number;
 /** Highest allowed painted row, for pieces that must stay on the face. */
 minTop?:number;
 /** Painted pixels tolerated inside FACE_KEEPOUT (anti-aliasing). */
 keepoutTolerance:number|null;
}
export const FIT_ZONES:Readonly<Record<FitClass,FitZone>>={
 'hair-short':{maxWidth:1.45,maxAboveCrown:.30,maxBottom:640,keepoutTolerance:60},
 'hair-long':{maxWidth:1.55,maxAboveCrown:.30,maxBottom:820,keepoutTolerance:60},
 'hat-tight':{maxWidth:1.40,maxAboveCrown:.60,maxBottom:450,keepoutTolerance:null},
 'hat-wide':{maxWidth:1.75,maxAboveCrown:.90,maxBottom:470,keepoutTolerance:null},
 'hat-band':{maxWidth:1.20,maxAboveCrown:.30,maxBottom:420,keepoutTolerance:0},
 'hat-helmet':{maxWidth:1.30,maxAboveCrown:.70,maxBottom:470,keepoutTolerance:0},
 'glasses':{maxWidth:.95,minWidth:.80,maxAboveCrown:0,maxBottom:560,minTop:HEAD_ANCHORS.browLine-60,keepoutTolerance:null}
};
/** Transparent margin every painted layer keeps from the template frame. */
export const FRAME_MARGIN=24;

/** Phase 1 registry. Phase 2 moves these into per-item manifests. */
export const COSMETIC_FIT:Readonly<Record<string,{fit:FitClass;profile?:HeadProfile}>>={
 'hair-spiky':{fit:'hair-short'},'hair-silver':{fit:'hair-short'},'hair-wavy':{fit:'hair-short'},'hair-undercut':{fit:'hair-short'},'hair-ponytail':{fit:'hair-long'},
 'hat-cap':{fit:'hat-tight',profile:'tight'},'hat-thunder':{fit:'hat-tight',profile:'tight'},'hat-tide':{fit:'hat-tight',profile:'tight'},'hat-ruby':{fit:'hat-tight',profile:'tight'},
 'hat-tropical':{fit:'hat-wide',profile:'wide'},'hat-mage':{fit:'hat-wide',profile:'wide'},
 'hat-pilot':{fit:'hat-band',profile:'band'},'hat-knight':{fit:'hat-helmet',profile:'helmet'},
 'glasses-sport':{fit:'glasses'},'glasses-cat':{fit:'glasses'},'glasses-round':{fit:'glasses'},'glasses-pilot':{fit:'glasses'}
};
/** Standing body proportions shared by every outfit. */
export const BODY_PROPORTIONS={headShare:[.42,.48] as const,shoulderWidth:[.85,1.05] as const};
