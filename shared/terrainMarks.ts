import {destructionProfileById,markBox} from './destruction';
import type {MapId} from './maps';
import {craterAnchor,terrainCols,terrainTemplate,WORLD} from './physics';
import type {TerrainMark} from './protocol';

/** Safety bound of the mark history (about 140 bytes of JSON each). Real matches stay far below it once
 * invisible marks are dropped: an old mark only leaves when no ground it could paint is left, never by age. */
export const MAX_TERRAIN_MARKS=1024;

/** World box (left, top, width, height) a mark can paint. Profile marks follow their painting; legacy and soot marks keep their old footprints. */
export function terrainMarkBox(mark:TerrainMark){
 const profile=mark.scorch?undefined:destructionProfileById(mark.profile);
 if(profile){const [ax,ay]=craterAnchor(mark.x,mark.y);return markBox(profile,ax,ay,mark.radius);}
 // Legacy paintings are rotated: their square reaches √2 further.
 const size=mark.scorch?Math.max(14,mark.radius*1.2)*(mark.stretch??1)**.5*5:Math.max(56,mark.radius*4.3)*1.42;
 return {x:mark.x-size/2,y:mark.y-size/2,width:size,height:size};
}
/** A painted mark is only ever visible on destructible ground (unbreakable layers never get it); soot also lands on unbreakable ground. */
export function markVisible(mark:TerrainMark,terrain:Uint8Array,map:MapId){
 const template=terrainTemplate(map),cols=terrainCols(terrain),box=terrainMarkBox(mark),onlyBreakable=!mark.scorch;
 const left=Math.max(0,Math.floor(box.x/WORLD.cell)),right=Math.min(cols,Math.ceil((box.x+box.width)/WORLD.cell)),top=Math.max(0,Math.floor(box.y/WORLD.cell)),bottom=Math.min(WORLD.rows,Math.ceil((box.y+box.height)/WORLD.cell));
 for(let y=top;y<bottom;y++)for(let x=left,i=y*cols+x;x<right;x++,i++)if(terrain[i]&&(!onlyBreakable||template.definition[template.regions[i]]?.destructible))return true;
 return false;
}
/** The history after a new mark: marks left with nothing to paint are dropped (the same on server and client). */
export function keepVisibleMarks(marks:readonly TerrainMark[],terrain:Uint8Array,map:MapId):TerrainMark[]{
 const kept=marks.filter(mark=>markVisible(mark,terrain,map));
 return kept.length>MAX_TERRAIN_MARKS?kept.slice(-MAX_TERRAIN_MARKS):kept;
}
