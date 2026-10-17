/**
 * Praça Celeste is three screens wide (the view is 1536×864); the camera follows
 * the player sideways. Positions are world coordinates shared by server and client.
 */
export const LOBBY_WIDTH=4608;
export const LOBBY_HEIGHT=864;
export const LOBBY_WALK={minX:120,maxX:LOBBY_WIDTH-120,minY:560,maxY:750} as const;
/** Walking pace on the plaza, px/s. Matches the stride the painted legs can take. */
export const LOBBY_WALK_SPEED=110;
export const LOBBY_SPAWN={x:2304,y:670} as const;
