/** Read-only snapshot the Scene publishes each frame for HUD widgets (minimap).
 * Terrain is the live destructible grid; version bumps whenever it changes. */
export const sceneView={terrain:null as Uint8Array|null,version:0,camera:{x:768,y:432,zoom:1}};
export function publishTerrain(terrain:Uint8Array){sceneView.terrain=terrain;sceneView.version++;}
