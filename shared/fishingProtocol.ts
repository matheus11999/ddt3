import {z} from 'zod';
import {MAX_FISHING_BUY,MAX_FISH_SELL} from './fishing';
/** Pescaria commands (the client only asks; server/fishing.ts and server/game.ts decide). */
export const fishingCommandSchemas=[
 // Walk through the gate between Praça Celeste and the Pescaria.
 z.object({type:z.literal('zone'),zone:z.enum(['plaza','fishing'])}).strict(),
 z.object({type:z.literal('fish-cast'),spot:z.string().regex(/^[a-z0-9-]{1,40}$/)}).strict(),
 // A press on the bar, stamped with the client's estimate of server time.
 z.object({type:z.literal('fish-press'),at:z.number().finite()}).strict(),
 z.object({type:z.literal('fish-stop')}).strict(),
 z.object({type:z.literal('fish-auto'),on:z.boolean()}).strict(),
 z.object({type:z.literal('fish-gear'),rod:z.string().regex(/^rod-[a-z0-9-]{1,32}$/)}).strict(),
 // Sell fish from the Sacola at the Casa de Pesca (each fish by its id).
 z.object({type:z.literal('fish-sell'),ids:z.array(z.string().regex(/^[a-z0-9-]{1,40}$/)).min(1).max(MAX_FISH_SELL)}).strict(),
 z.object({type:z.literal('fish-buy'),offer:z.string().regex(/^[a-z0-9-]{1,40}$/),quantity:z.number().int().min(1).max(MAX_FISHING_BUY)}).strict(),
] as const;
