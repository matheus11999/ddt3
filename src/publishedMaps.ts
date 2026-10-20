import {applyMapOverride,registerPinnedMap,releasePinnedMaps,removeMapOverride} from '../shared/maps';
import type {MapOverride} from '../shared/maps';
import {applyLobbyLayout,LOBBY_OBSTACLES,LOBBY_SPAWN,LOBBY_WALK} from '../shared/lobby';
import type {LobbyLayoutOverride} from '../shared/lobby';
import {LOBBY_STATION_DEFAULTS} from './game/lobbyWorld';
import type {PublishedMaps} from '../shared/mapAdmin';
import {applyFishingLayout,publishedFishingLayout,defaultFishingLayout} from '../shared/fishingMap';
import type {FishingLayout} from '../shared/fishingMap';

/** Maps published in the admin panel (GET /api/maps), applied the same way the server applies them. */
const shipped:LobbyLayoutOverride=structuredClone({spawn:{...LOBBY_SPAWN},walk:{...LOBBY_WALK},obstacles:[...LOBBY_OBSTACLES],stations:[...LOBBY_STATION_DEFAULTS]});
let applied=new Set<string>(),pending:Promise<void>|null=null,fishingApplied='';

export function applyPublishedMaps(data:PublishedMaps){
 const next=new Set(data.maps.map(m=>m.id));
 for(const id of applied)if(!next.has(id))removeMapOverride(id);
 for(const map of data.maps)applyMapOverride(map as MapOverride);
 // A match in progress keeps the version it started on (`Battle.map` = `snow@12`).
 releasePinnedMaps((data.pinned??[]).map(map=>registerPinnedMap({...map,revision:map.revision} as MapOverride&{revision:number})));
 applyLobbyLayout(data.lobby?.lobby??shipped);
 // The Pescaria: only rebuilt when its published revision changes (the world bakes its floor again).
 const fishing=data.fishing?`${data.fishing.id}@${data.fishing.revision}`:'';
 if(fishing!==fishingApplied){fishingApplied=fishing;applyFishingLayout(publishedFishingLayout(data.fishing?.fishing as FishingLayout|undefined));}
 applied=next;
}

/** Fetches and applies the published maps; a failure keeps the maps already in use. */
export function syncPublishedMaps():Promise<void>{
 pending??=fetch('/api/maps',{signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():null).then(data=>{if(data&&Array.isArray(data.maps))applyPublishedMaps(data as PublishedMaps);}).catch(()=>{}).finally(()=>{pending=null;});
 return pending;
}
