/** Read-only snapshot the Scene publishes each frame for HUD widgets (minimap).
 * Terrain is the live destructible grid; version bumps whenever it changes. */
export const sceneView={terrain:null as Uint8Array|null,version:0,camera:{x:768,y:432,zoom:1},
 /** Where the player is looking while holding the mouse/finger down (dragging the battlefield or the minimap).
  * While set, the camera stays there; on release it is cleared and the camera follows the turn and the shot again. */
 look:null as {x:number;y:number}|null};
export function publishTerrain(terrain:Uint8Array){sceneView.terrain=terrain;sceneView.version++;}
