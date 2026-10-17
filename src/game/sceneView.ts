/** Read-only snapshot the Scene publishes each frame for HUD widgets (minimap).
 * Terrain is the live destructible grid; version bumps whenever it changes. */
export const sceneView={terrain:null as Uint8Array|null,version:0,camera:{x:768,y:432,zoom:1},
 /** Where the player is looking through the minimap. The Scene follows it while dragging and for a moment after,
  * then goes back to following the turn; a new shot or a new turn ends it at once. */
 look:null as {x:number;y:number;dragging:boolean;until:number;turn:number}|null};
export function publishTerrain(terrain:Uint8Array){sceneView.terrain=terrain;sceneView.version++;}
