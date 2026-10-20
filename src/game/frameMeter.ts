/** Frames the scene actually painted (it skips frames under menus and above 60 FPS), for the FPS indicator. */
let painted=0;
export const frameMeter={
 /** Called by the scene once per painted frame. */
 paint(){painted++;},
 /** Painted frames since the last call. */
 take(){const n=painted;painted=0;return n;},
};
