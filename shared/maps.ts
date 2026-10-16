export const MAP_IDS = ['garden','park','celestial'] as const;
export type CanonicalMapId = typeof MAP_IDS[number];
/** Legacy room identifiers remain readable; only canonical maps appear in the lobby. */
export type MapId = CanonicalMapId | 'sky' | 'valley';
export type MaterialId = 'earth'|'sand'|'stone'|'ice'|'metal'|'magic';
export type EnvironmentQuality = 'low'|'medium'|'high';
export type Point = readonly [number,number];
export type Shape = {kind:'polygon';points:readonly Point[]}|{kind:'ellipse';x:number;y:number;rx:number;ry:number}|{kind:'rect';x:number;y:number;width:number;height:number};
export interface MapRegion {id:string;shape:Shape;material:MaterialId;destructible:boolean;surface?:'grass'|'paving'|'marble'|'wood';}
export interface EnvironmentObject {id:string;kind:'tree'|'flowers'|'fence'|'fountain'|'butterfly'|'ferris'|'carousel'|'balloons'|'bunting'|'crystal'|'statue'|'flag'|'crate'|'barrel';x:number;y:number;scale:number;layer:3|5|6;region?:string;animated?:boolean;}
export interface MapDefinition {
 id:CanonicalMapId;name:string;subtitle:string;color:string;theme:'garden'|'park'|'celestial';
 dimensions:{width:number;height:number};camera:{minZoom:number;maxZoom:number};
 lighting:{sky:string;horizon:string;ambient:string};audio:{ambience:'birds'|'carnival'|'wind';impact:Partial<Record<MaterialId,'dust'|'spark'|'chime'>>};
 layers:readonly {id:string;depth:number;role:string}[];
 regions:readonly MapRegion[];objects:readonly EnvironmentObject[];spawns:readonly [readonly number[],readonly number[]];
 art:{midground:string};
}
export const MATERIALS:Record<MaterialId,{resistance:number;color:string;highlight:string;debris:string}>={
 earth:{resistance:1,color:'#a46c48',highlight:'#d9a16c',debris:'#b18455'},
 sand:{resistance:.72,color:'#d0aa69',highlight:'#f1d696',debris:'#e1c27c'},
 stone:{resistance:1.65,color:'#777c95',highlight:'#bdc0d0',debris:'#a4adc1'},
 ice:{resistance:.82,color:'#78bbd4',highlight:'#d1f5ff',debris:'#c7efff'},
 metal:{resistance:2.1,color:'#696d83',highlight:'#becbd7',debris:'#d8dcdf'},
 magic:{resistance:1.25,color:'#8778b8',highlight:'#d3b9f4',debris:'#c5a4ed'}
};
const layers=[{id:'sky',depth:.08,role:'Céu e horizonte'},{id:'landscape',depth:.22,role:'Paisagem distante'},{id:'near',depth:.55,role:'Ambiente próximo'},{id:'terrain',depth:1,role:'Terreno e colisão'},{id:'objects',depth:1,role:'Objetos e estruturas'},{id:'foreground',depth:1.12,role:'Primeiro plano'},{id:'atmosphere',depth:.85,role:'Partículas ambientais'}] as const;
const polygon=(points:readonly Point[]):Shape=>({kind:'polygon',points});
function island(surface:number,amplitude:number):Shape {
 const points:Point[]=[];
 for(let x=45;x<=1491;x+=6){const d=Math.abs(768-x);points.push([x,surface+Math.sin(d/112)*amplitude+Math.cos(d/43)*6+(d>650?(d-650)*.55:0)]);}
 for(let x=1491;x>=45;x-=6){const d=Math.abs(768-x);points.push([x,805-Math.pow(d/723,3)*140+Math.sin(d/63)*12]);}
 return polygon(points);
}
const structure=(id:string,points:readonly Point[],material:MaterialId='stone',surface:MapRegion['surface']='marble'):MapRegion=>({id,shape:polygon(points),material,destructible:false,surface});
const common={dimensions:{width:1536,height:864},camera:{minZoom:1,maxZoom:1.65},layers,spawns:[[260,395],[1276,1141]] as const};
export const MAP_DEFINITIONS:Record<CanonicalMapId,MapDefinition>={
 garden:{...common,id:'garden',name:'Jardim Encantado',subtitle:'Terra viva · Destrutível',color:'#e4a9c8',theme:'garden',lighting:{sky:'#86cde8',horizon:'#e9f8dd',ambient:'#f6dbab'},audio:{ambience:'birds',impact:{earth:'dust',stone:'dust',magic:'chime'}},art:{midground:'/assets/maps/garden-midground.png'},
  regions:[{id:'garden-island',shape:island(558,17),material:'earth',destructible:true,surface:'grass'},
   {id:'sand-left',shape:{kind:'ellipse',x:420,y:738,rx:95,ry:46},material:'sand',destructible:true},{id:'sand-right',shape:{kind:'ellipse',x:1116,y:738,rx:95,ry:46},material:'sand',destructible:true},
   {id:'crystal-root',shape:{kind:'ellipse',x:768,y:766,rx:130,ry:40},material:'magic',destructible:true},
   {id:'garden-crate-a',shape:{kind:'rect',x:500,y:527,width:38,height:52},material:'earth',destructible:true,surface:'wood'},
   {id:'garden-crate-b',shape:{kind:'rect',x:998,y:527,width:38,height:52},material:'earth',destructible:true,surface:'wood'}],
  objects:[{id:'tree-l',kind:'tree',x:115,y:535,scale:1.2,layer:3,animated:true},{id:'tree-r',kind:'tree',x:1412,y:538,scale:1.05,layer:3,animated:true},{id:'water',kind:'fountain',x:770,y:516,scale:.9,layer:3,animated:true},{id:'fence-l',kind:'fence',x:350,y:536,scale:1,layer:3},{id:'fence-r',kind:'fence',x:1070,y:536,scale:1,layer:3},{id:'crate-l',kind:'crate',x:519,y:579,scale:1,layer:5,region:'garden-crate-a'},{id:'crate-r',kind:'crate',x:1017,y:579,scale:1,layer:5,region:'garden-crate-b'},{id:'flower-front-l',kind:'flowers',x:65,y:811,scale:1.7,layer:6,animated:true},{id:'flower-front-r',kind:'flowers',x:1420,y:805,scale:1.6,layer:6,animated:true}]
 },
 park:{...common,id:'park',name:'Parque dos Sonhos',subtitle:'Terra e estruturas · Híbrido',color:'#dda1a6',theme:'park',lighting:{sky:'#9298d0',horizon:'#f8c5b4',ambient:'#ffcf9a'},audio:{ambience:'carnival',impact:{earth:'dust',metal:'spark',stone:'dust'}},art:{midground:'/assets/maps/park-midground.png'},
  regions:[{id:'park-island',shape:island(600,16),material:'earth',destructible:true,surface:'grass'},structure('park-bridge',[[450,604],[548,547],[988,547],[1086,604],[1068,621],[980,585],[556,585],[468,621]],'metal','paving'),
   structure('park-pillar-a',[[571,578],[612,578],[626,740],[563,760]],'stone','paving'),structure('park-pillar-b',[[924,578],[965,578],[973,760],[910,740]],'stone','paving'),
   {id:'park-barrel-a',shape:{kind:'ellipse',x:666,y:522,rx:21,ry:28},material:'earth',destructible:true,surface:'wood'},{id:'park-barrel-b',shape:{kind:'ellipse',x:870,y:522,rx:21,ry:28},material:'earth',destructible:true,surface:'wood'},
   {id:'park-sand-a',shape:{kind:'ellipse',x:300,y:725,rx:100,ry:50},material:'sand',destructible:true},{id:'park-sand-b',shape:{kind:'ellipse',x:1236,y:725,rx:100,ry:50},material:'sand',destructible:true}],
  objects:[{id:'wheel',kind:'ferris',x:349,y:337,scale:1.1,layer:3,animated:true},{id:'carousel',kind:'carousel',x:1182,y:499,scale:1,layer:3,animated:true},{id:'balloons-l',kind:'balloons',x:100,y:375,scale:.9,layer:3,animated:true},{id:'balloons-r',kind:'balloons',x:1435,y:385,scale:1.1,layer:3,animated:true},{id:'flags',kind:'bunting',x:550,y:405,scale:1,layer:3,animated:true},{id:'barrel-a',kind:'barrel',x:666,y:550,scale:1,layer:5,region:'park-barrel-a'},{id:'barrel-b',kind:'barrel',x:870,y:550,scale:1,layer:5,region:'park-barrel-b'},{id:'flower-park',kind:'flowers',x:1475,y:811,scale:1.8,layer:6,animated:true}]
 },
 celestial:{...common,id:'celestial',name:'Fortaleza Celestial',subtitle:'Pedra celestial · Indestrutível',color:'#a8b9e5',theme:'celestial',lighting:{sky:'#6c98ca',horizon:'#e3dcf6',ambient:'#dcefff'},audio:{ambience:'wind',impact:{stone:'dust',metal:'spark',magic:'chime'}},art:{midground:'/assets/maps/celestial-midground.png'},
  regions:[structure('celestial-left',[[80,582],[105,551],[560,551],[633,585],[585,674],[480,749],[368,785],[236,743],[129,666]]),structure('celestial-right',[[1456,582],[1431,551],[976,551],[903,585],[951,674],[1056,749],[1168,785],[1300,743],[1407,666]]),
   structure('celestial-bridge',[[537,551],[999,551],[999,582],[960,595],[918,581],[876,595],[834,581],[792,595],[750,581],[708,595],[666,581],[624,595],[582,581],[537,595]],'magic','marble'),
   structure('celestial-left-crystal',[[166,551],[156,527],[170,489],[186,527],[180,551]],'magic'),structure('celestial-right-crystal',[[1370,551],[1380,527],[1366,489],[1350,527],[1356,551]],'magic')],
  objects:[{id:'statue-a',kind:'statue',x:104,y:552,scale:.85,layer:3},{id:'statue-b',kind:'statue',x:1432,y:552,scale:.85,layer:3},{id:'crystal-a',kind:'crystal',x:171,y:551,scale:.65,layer:5,region:'celestial-left-crystal',animated:true},{id:'crystal-b',kind:'crystal',x:1365,y:551,scale:.65,layer:5,region:'celestial-right-crystal',animated:true},{id:'flag-a',kind:'flag',x:570,y:540,scale:1,layer:3,animated:true},{id:'flag-b',kind:'flag',x:966,y:540,scale:1,layer:3,animated:true},{id:'crystal-front-a',kind:'crystal',x:35,y:822,scale:2,layer:6,animated:true},{id:'crystal-front-b',kind:'crystal',x:1503,y:822,scale:1.8,layer:6,animated:true}]
 }
};
export const MAPS=MAP_IDS.map(id=>{const m=MAP_DEFINITIONS[id];return {id:m.id,name:m.name,subtitle:m.subtitle,color:m.color};});
export function canonicalMap(id:MapId):CanonicalMapId{return id==='sky'?'garden':id==='valley'?'park':id;}
export function getMap(id:MapId):MapDefinition{return MAP_DEFINITIONS[canonicalMap(id)];}
export function contains(shape:Shape,x:number,y:number):boolean {
 if(shape.kind==='rect')return x>=shape.x&&y>=shape.y&&x<shape.x+shape.width&&y<shape.y+shape.height;
 if(shape.kind==='ellipse')return ((x-shape.x)/shape.rx)**2+((y-shape.y)/shape.ry)**2<=1;
 let inside=false;for(let i=0,j=shape.points.length-1;i<shape.points.length;j=i++){const [ax,ay]=shape.points[i],[bx,by]=shape.points[j];if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;}return inside;
}
