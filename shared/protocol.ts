import {z} from 'zod';
import type {Equipment,BoostId,MapId,CharacterGender} from './catalog';
import {CHARACTER_GENDERS,DYE_IDS,DYE_SLOTS,MAX_FORGE_STONES,SLOTS} from './catalog';
import type {BattleRewards} from './rewards';
import type {CompositionStat,Compositions} from './composition';
import {ROOM_MODES} from './rooms';
import type {RoomMode} from './rooms';
import {ABILITY_IDS} from './abilities';
import type {AbilityId,AbilityEffect,AbilityLoadout} from './abilities';
import type {FighterFall} from './fall';
export interface Profile {id:string;name:string;gender:CharacterGender;level:number;xp:number;gold:number;wins:number;matches:number;equipment:Equipment;inventory:string[];equippedOnce:boolean;upgrades:Record<string,number>;stones:Record<string,number>;compositionStones:Record<string,number>;compositions:Compositions;contentVersion?:number;abilityLoadout?:AbilityLoadout;}
export interface ShopResult {items:string[];spent:number;}
export interface ForgeResult {item:string;success:boolean;level:number;chance:number;consumed:Record<string,number>;}
export interface CompositionResult {item:string;stone:string;stat:CompositionStat;success:boolean;previous:number;value:number;chance:number;cost:number;}
export interface LobbyPlayer {id:string;name:string;level:number;x:number;y:number;equipment:Equipment;}
export interface Seat {id:string;name:string;level:number;equipment:Equipment;ready:boolean;bot:boolean;team:0|1;slot:number;connected:boolean;abilityLoadout?:AbilityLoadout;}
export interface RoomSpectator {id:string;name:string;level:number;slot:0|1;connected:boolean;}
export interface Room {id:string;number:number;name:string;hostId:string;mode:RoomMode;openSlots:number[];map:MapId;status:'waiting'|'searching'|'playing';players:Seat[];spectatorSlots?:number[];spectators?:RoomSpectator[];practice?:boolean;matchStartedAt?:number;searchStartedAt?:number;}
export interface RoomInvitePlayer {id:string;name:string;level:number;}
export interface RoomInvitation {id:string;roomId:string;roomNumber:number;roomName:string;fromId:string;fromName:string;expiresAt:number;}
export interface RoomInviteResult {inviteId:string;playerId:string;roomId:string;status:'sent'|'accepted'|'declined'|'expired'|'unavailable';message?:string;}
export interface Fighter extends Seat {x:number;y:number;hp:number;maxHp:number;stamina:number;maxStamina:number;facing:1|-1;boosts:BoostId[];aimAngle?:number;aimSlope?:number;chargePower?:number;charging?:boolean;powerCharge?:number;powerArmed?:boolean;abilities?:Record<AbilityId,number>;homingArmed?:boolean;flightArmed?:boolean;invisibleTurns?:number;hidden?:boolean;fall?:FighterFall;}
export interface Battle {id:string;roomId:string;map:MapId;players:Fighter[];turnId:string;turnNumber:number;wind:number;deadline:number;phase:'aiming'|'resolving'|'finished';winner:0|1|null;terrain?:string;rewards?:BattleRewards;terrainMarks?:TerrainMark[];activeShot?:Shot;powerCutIn?:{id:string;playerId:string;endsAt:number};}
export interface Projectile {points:number[][];delay:number;flightTime:number;impact:{x:number;y:number;radius:number;material?:import('./maps').MaterialId;destructible?:boolean;region?:string;demolition?:number};effect:import('./catalog').WeaponEffect;powered?:boolean;kind?:'weapon'|'flight';fragment?:boolean;}
export interface TerrainMark {id:string;x:number;y:number;radius:number;effect:Projectile['effect'];level:number;}
export type HitKind='direct'|'graze'|'splash'|'fall';
export interface ShotHit {id:string;damage:number;x:number;y:number;projectileIndex:number;critical:boolean;kind:HitKind;quality:number;hidden?:boolean;}
export interface Shot {powered?:boolean;id:string;shooterId:string;projectiles:Projectile[];hits:ShotHit[];duration:number;startedAt:number;impacted:number[];hidden?:boolean;}
export interface ChatLine {id:string;name:string;text:string;channel:'world'|'room';time:number;}
import {LOBBY_WALK} from './lobby';
const finite=(lo:number,hi:number)=>z.number().finite().min(lo).max(hi);
const name=z.string().trim().min(2).max(24).regex(/^[\p{L}\p{N} _!.-]+$/u);
export const sessionRequestSchema=z.object({gender:z.enum(CHARACTER_GENDERS).optional()}).strict();
const abilitySlot=z.enum(ABILITY_IDS).nullable();
export const abilityLoadoutSchema=z.tuple([abilitySlot,abilitySlot,abilitySlot]).refine(slots=>new Set(slots.filter(slot=>slot!==null)).size===slots.filter(slot=>slot!==null).length,'Não repita habilidades nos espaços.');
export const equipmentVisibilitySchema=z.object({hat:z.boolean().optional(),glasses:z.boolean().optional(),costume:z.boolean().optional()}).strict();
export const equipmentSelectionSchema=z.object({
 items:z.record(z.enum(SLOTS),z.string().min(1).max(40)),
 dyes:z.partialRecord(z.enum(DYE_SLOTS),z.enum(DYE_IDS)).optional(),
 visibility:equipmentVisibilitySchema.optional()
}).strict();
export const stoneSelectionSchema=z.record(z.string().regex(/^[1-5]$/),z.number().int().min(0).max(MAX_FORGE_STONES)).refine(stones=>{const count=Object.values(stones).reduce((sum,n)=>sum+n,0);return count>=1&&count<=MAX_FORGE_STONES;},'Selecione de 1 a 20 pedras.');
export const commandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('arena-presence'),open:z.boolean()}).strict(),
 z.object({type:z.literal('move'),x:finite(LOBBY_WALK.minX,LOBBY_WALK.maxX),y:finite(LOBBY_WALK.minY,LOBBY_WALK.maxY)}),
 z.object({type:z.literal('rename'),name}),
 z.object({type:z.literal('equip'),item:z.string().max(40)}).strict(),
 z.object({type:z.literal('dye'),slot:z.enum(DYE_SLOTS),color:z.enum(DYE_IDS)}).strict(),
 z.object({type:z.literal('customize'),selection:equipmentSelectionSchema,requestId:z.string().min(1).max(64).optional()}).strict(),
 z.object({type:z.literal('ability-loadout'),slots:abilityLoadoutSchema,requestId:z.string().min(1).max(64).optional()}).strict(),
 z.object({type:z.literal('shop-buy'),items:z.array(z.string().min(1).max(40)).min(1).max(20).refine(items=>new Set(items).size===items.length,'Itens repetidos no carrinho.')}).strict(),
 z.object({type:z.literal('forge'),item:z.string().min(1).max(40),stones:stoneSelectionSchema}).strict(),
 z.object({type:z.literal('compose'),item:z.string().min(1).max(40),stone:z.string().regex(/^(attack|defense|agility|armor)-[1-3]$/)}).strict(),
 // Legacy mode/map are honored only by explicitly requested practice rooms.
 z.object({type:z.literal('create'),name:name.optional(),practice:z.boolean().optional(),mode:z.enum(ROOM_MODES).optional(),map:z.enum(['garden','park','celestial','sky','valley']).optional()}).strict(),
 z.object({type:z.literal('practice-start')}).strict(),
 z.object({type:z.literal('queue')}).strict(),z.object({type:z.literal('cancel-queue')}).strict(),
 z.object({type:z.literal('room-slot'),slot:z.number().int().min(1).max(3),open:z.boolean()}).strict(),
 z.object({type:z.literal('room-rename'),name:z.string().trim().min(2).max(24)}).strict(),
 z.object({type:z.literal('room-invite-list')}).strict(),
 z.object({type:z.literal('room-invite'),playerId:z.string().uuid()}).strict(),
 z.object({type:z.literal('room-invite-answer'),inviteId:z.string().uuid(),accept:z.boolean()}).strict(),
 z.object({type:z.literal('room-spectator-slot'),slot:z.union([z.literal(0),z.literal(1)]),open:z.boolean()}).strict(),
 z.object({type:z.literal('spectate'),roomId:z.string().uuid()}).strict(),
 z.object({type:z.literal('spectator-kick'),playerId:z.string().uuid()}).strict(),
 z.object({type:z.literal('kick'),playerId:z.string().min(1).max(64)}).strict(),
 z.object({type:z.literal('join'),roomId:z.string().uuid()}),
 z.object({type:z.literal('leave')}),z.object({type:z.literal('ready')}),z.object({type:z.literal('bot')}),z.object({type:z.literal('start')}),
 z.object({type:z.literal('power')}).strict(),
 z.object({type:z.literal('ability'),ability:z.enum(ABILITY_IDS)}).strict(),
 z.object({type:z.literal('flight'),active:z.boolean()}).strict(),
 z.object({type:z.literal('boost'),boost:z.enum(['extra1','extra2','trident','damage50','damage40','damage30','damage20'])}),
 z.object({type:z.literal('walk'),direction:z.union([z.literal(-1),z.literal(1)])}),
 z.object({type:z.literal('aim'),angle:finite(5,90),power:finite(0,100),charging:z.boolean()}).strict(),
 z.object({type:z.literal('fire'),angle:finite(5,90),power:finite(5,100)}),
 z.object({type:z.literal('reward-pick'),card:z.number().int().min(0).max(7)}).strict(),
 z.object({type:z.literal('pass')}),z.object({type:z.literal('rematch')}),
 z.object({type:z.literal('chat'),text:z.string().trim().min(1).max(180),channel:z.enum(['world','room'])}),
 z.object({type:z.literal('ping'),time:z.number().finite()})
]);
export type Command=z.infer<typeof commandSchema>;
export type ServerEvent =
 | {type:'welcome';profile:Profile;players:LobbyPlayer[];rooms:Room[];room:Room|null;battle:Battle|null;serverTime:number;channel:number;arenaOnline?:number}
 | {type:'profile';profile:Profile;requestId?:string}
 | {type:'shop-result';result:ShopResult}
 | {type:'forge-result';result:ForgeResult}
 | {type:'composition-result';result:CompositionResult}
 | {type:'lobby';players:LobbyPlayer[];online:number}
 | {type:'rooms';rooms:Room[]}
 | {type:'arena-population';count:number}
 | {type:'room-invite-list';roomId:string;players:RoomInvitePlayer[]}
 | {type:'room-invitation';invite:RoomInvitation}
 | ({type:'room-invite-result'} & RoomInviteResult)
 | {type:'room';room:Room|null}
 | {type:'battle';battle:Battle|null}
 | {type:'shot';shot:Shot}
 | {type:'impact';shotId:string;projectileIndex:number;at:number;hits:ShotHit[]}
 | ({type:'ability-effect'} & AbilityEffect)
 | {type:'chat';message:ChatLine}
 | {type:'error';message:string;requestId?:string}
 | {type:'pong';time:number;serverTime:number};
