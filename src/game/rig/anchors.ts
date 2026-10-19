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

/** Near ear of the universal head, traced along the middle of its painted outline and closed where
 * it joins the skull. Hair is cut away inside it and outlined along the cut, so every hairstyle wraps
 * around the ear with one continuous contour. */
export const EAR_FRONT:readonly Point[]=[[470,422],[482,419],[497,425],[507,431],[514,441],[520,458],[522,478],[522,498],[524,512],[527,524],[516,531],[502,533.5],[489,531],[478,529],[468.5,523.5],[460,518],[453.5,512],[448,505],[442,498],[438.7,490],[436,481],[434.5,471.5],[436,462],[437.5,451.5],[441,440.5],[449,432.5],[458.5,425]];

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
 'hat-tight':{maxWidth:1.40,maxAboveCrown:.60,maxBottom:470,keepoutTolerance:null},
 'hat-wide':{maxWidth:1.75,maxAboveCrown:.90,maxBottom:495,keepoutTolerance:null},
 'hat-band':{maxWidth:1.20,maxAboveCrown:.30,maxBottom:420,keepoutTolerance:0},
 'hat-helmet':{maxWidth:1.30,maxAboveCrown:.70,maxBottom:470,keepoutTolerance:0},
 'glasses':{maxWidth:.95,minWidth:.80,maxAboveCrown:0,maxBottom:560,minTop:HEAD_ANCHORS.browLine-60,keepoutTolerance:null}
};
/** Transparent margin every painted layer keeps from the template frame. */
export const FRAME_MARGIN=24;

/** Drawn head size relative to the body art, applied at neckPivot in every pose and screen.
 * Head cosmetics are pinned in head space, so they scale with it; the template stays 1254px. */
export const HEAD_SCALE=1.3;
/** Standing (lobby) body proportions shared by every outfit, measured with HEAD_SCALE applied.
 * Shoulder width compares the body art with the unscaled reference head (HEAD_WIDTH). Like DDTank,
 * the body is narrower than the drawn head (the approved Cartógrafo measures 0.61×). */
export const BODY_PROPORTIONS={headShare:[.47,.53] as const,shoulderWidth:[.5,.8] as const};
/** Painted lobby walk sheet (docs/combat-frames.md, "Andar do lobby"): the head may bob this many avatar
 * units between frames and the boots must reach the ground line within `groundGap`. */
export const WALK_SHEET={frames:6,bob:8,groundGap:4} as const;
/** Painted combat atlas (docs/combat-frames.md): 12 frames, each painted with its hands; the measured head
 * may sit this far (avatar units) from the contract's head point. */
export const COMBAT_SHEET={frames:12,headDrift:8,groundGap:4} as const;
/** Combat prone body shared by every outfit (docs/prone-combat.md). armShare is the
 * fraction of the prone torso lifted into the universal arms layer; length is the
 * body from feet to fists against the head at HEAD_SCALE; the hand point must
 * land on painted fist pixels so the projectile glow and throw arc start there. */
export const PRONE_PROPORTIONS={armShare:[.06,.4] as const,length:[1,1.8] as const,handReach:40};
