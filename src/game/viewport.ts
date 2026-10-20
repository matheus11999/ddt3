/**
 * The game's view: always 864 units tall; as wide as the window's shape asks, from 1536 (16:9) up to
 * MAX_VIEW_WIDTH, so a browser window wider than 16:9 shows more of the plaza, the Pescaria or the battle
 * instead of black bars (20/10, matheus). The HUD sits in a frame of the same size, pinned to its edges.
 * Windows narrower than 16:9 keep the 1536 frame (bars above and below): no map is taller than 864.
 */
export const VIEW_HEIGHT=864,BASE_VIEW_WIDTH=1536;
/** The Pescaria (2304 wide) is the narrowest world the plaza view walks across. */
export const MAX_VIEW_WIDTH=2304;
export const view={width:BASE_VIEW_WIDTH};
/** View width for a window of innerWidth × innerHeight CSS px. */
export function viewWidthFor(innerWidth:number,innerHeight:number){
 if(innerWidth<=0||innerHeight<=0)return BASE_VIEW_WIDTH;
 return Math.max(BASE_VIEW_WIDTH,Math.min(MAX_VIEW_WIDTH,Math.round(VIEW_HEIGHT*innerWidth/innerHeight)));
}
