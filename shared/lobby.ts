/**
 * Praça Celeste is three screens wide (the view is 1536×864); the camera follows
 * the player sideways. Positions are world coordinates shared by server and client.
 */
export const LOBBY_WIDTH=4608;
export const LOBBY_HEIGHT=864;
export const LOBBY_WALK={minX:120,maxX:LOBBY_WIDTH-120,minY:560,maxY:750} as const;
/** Walking pace on the plaza, px/s. Matches the stride the painted legs can take. */
export const LOBBY_WALK_SPEED=132;
export const LOBBY_SPAWN={x:2304,y:670} as const;

/** Floor footprint of a solid plaza structure: an ellipse around the base, in world px. */
export interface LobbyObstacle {id:string;x:number;y:number;rx:number;ry:number;}
/**
 * Players walk around the stalls, podiums and arena gate instead of through them.
 * Measured from the bottom of each painted layer (public/assets/lobby): the base's
 * width and the floor line where it stands. `ry` is how deep the base reads on the floor.
 */
export const LOBBY_OBSTACLES:readonly LobbyObstacle[]=[
 {id:'shop',x:562,y:618,rx:150,ry:36},
 {id:'storage',x:1221,y:622,rx:95,ry:32},
 {id:'podium-2',x:2040,y:608,rx:72,ry:32},
 {id:'podium-1',x:2304,y:600,rx:86,ry:32},
 {id:'podium-3',x:2568,y:612,rx:72,ry:32},
 {id:'arena',x:2980,y:609,rx:136,ry:36},
 {id:'forge',x:3722,y:624,rx:150,ry:36},
];

const inside=(o:LobbyObstacle,x:number,y:number)=>((x-o.x)/o.rx)**2+((y-o.y)/o.ry)**2<1;
const clampWalk=(x:number,y:number)=>({x:Math.max(LOBBY_WALK.minX,Math.min(LOBBY_WALK.maxX,x)),y:Math.max(LOBBY_WALK.minY,Math.min(LOBBY_WALK.maxY,y))});

/** Nearest walkable spot: a point inside a footprint moves out to its edge (to the front when dead centre). */
export function lobbyFree(x:number,y:number):{x:number;y:number}{
 let p=clampWalk(x,y);
 for(const o of LOBBY_OBSTACLES){
  if(!inside(o,p.x,p.y))continue;
  const ux=(p.x-o.x)/o.rx,uy=(p.y-o.y)/o.ry,d=Math.hypot(ux,uy);
  p=d<1e-6?{x:o.x,y:o.y+o.ry*1.01}:{x:o.x+ux/d*o.rx*1.01,y:o.y+uy/d*o.ry*1.01};
 }
 return clampWalk(p.x,p.y);
}

/**
 * One walking step of at most `distance` px toward `to`. Running into a footprint
 * slides along its edge in the direction of the goal (around the front when it is
 * straight ahead), so players walk around structures instead of stopping or passing through.
 */
export function lobbyStep(from:{x:number;y:number},to:{x:number;y:number},distance:number):{x:number;y:number}{
 const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy);
 if(d<=distance)return lobbyFree(to.x,to.y);
 const ex=dx/d,ey=dy/d,next={x:from.x+ex*distance,y:from.y+ey*distance};
 const o=LOBBY_OBSTACLES.find(item=>inside(item,next.x,next.y));
 if(!o)return lobbyFree(next.x,next.y);
 const ux=(from.x-o.x)/o.rx,uy=(from.y-o.y)/o.ry;
 let tx=-uy*o.rx,ty=ux*o.ry;const t=Math.hypot(tx,ty)||1;tx/=t;ty/=t;
 const along=tx*ex+ty*ey;
 if(Math.abs(along)<1e-3?ty<0:along<0){tx=-tx;ty=-ty;}
 return lobbyFree(from.x+tx*distance,from.y+ty*distance);
}
