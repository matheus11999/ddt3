import {z} from 'zod';
import type {PlayerPet} from './pets';
/** Pet commands (the client only asks; server/pets.ts and server/game.ts decide) and what the server answers. */
const petId=z.string().uuid();
const skillId=z.string().regex(/^[a-z][a-z0-9-]{1,39}$/);
export const petCommandSchemas=[
 z.object({type:z.literal('pet-list')}).strict(),
 z.object({type:z.literal('pet-equip'),pet:petId}).strict(),
 z.object({type:z.literal('pet-unequip'),pet:petId}).strict(),
 z.object({type:z.literal('pet-rename'),pet:petId,name:z.string().trim().min(1).max(16)}).strict(),
 z.object({type:z.literal('pet-lock'),pet:petId,locked:z.boolean()}).strict(),
 // Releasing is permanent: the client must send the pet's current name as confirmation.
 z.object({type:z.literal('pet-release'),pet:petId,confirm:z.literal(true),name:z.string().trim().min(1).max(16)}).strict(),
 z.object({type:z.literal('pet-feed'),pet:petId,food:z.string().regex(/^pet-food-[a-z0-9-]{1,32}$/),quantity:z.number().int().min(1).max(99)}).strict(),
 z.object({type:z.literal('pet-skill-slot'),pet:petId,slot:z.number().int().min(0).max(7),skill:skillId.nullable()}).strict(),
 // In battle, on your turn: use an active skill of the equipped pet (target = a fighter id, when the skill picks one).
 z.object({type:z.literal('pet-skill'),skill:skillId,target:z.string().min(1).max(64).optional()}).strict()
] as const;
export const PET_DOMAIN_EVENTS=['PET_OBTAINED','PET_EQUIPPED','PET_UNEQUIPPED','PET_RENAMED','PET_LOCKED','PET_UNLOCKED','PET_RELEASED','PET_FED','PET_VITALITY_CHANGED','PET_XP_GAINED','PET_LEVEL_UP','PET_SKILL_UNLOCKED','PET_SKILL_EQUIPPED','PET_SKILL_UNEQUIPPED','PET_BATTLE_SETTLED'] as const;
export type PetDomainEventKind=typeof PET_DOMAIN_EVENTS[number];
/** A pet domain event: persisted for audit (pet_events) and sent to the owner. `id` is unique, so replays are detectable. */
export interface PetDomainEvent {id:string;kind:PetDomainEventKind;petId:string;ownerId:string;at:string;data:Record<string,unknown>;}
export interface PetsState {pets:PlayerPet[];capacity:number;food:Record<string,number>;}
export interface PetResult {action:'grant'|'equip'|'unequip'|'rename'|'lock'|'release'|'feed'|'skill-slot'|'battle';petId?:string;message:string;events:PetDomainEvent[];}
