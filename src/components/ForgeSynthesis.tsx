import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {ArrowRight,ChevronDown,Combine,LoaderCircle,Minus,Plus} from 'lucide-react';
import {COMPOSITION_STONE_BY_ID} from '../../shared/composition';
import {SYNTHESIS_CATEGORIES,SYNTHESIS_RECIPES,SYNTHESIS_RECIPE_BY_ID,stockOf,synthesisMax,synthesisStone} from '../../shared/synthesis';
import type {SynthesisRecipe} from '../../shared/synthesis';
import {client,useGame} from '../client';
import {audio} from '../game/audio';
import {CompositionIcon} from './CompositionIcon';
import {ItemCardFrame} from './ItemCard';
import {RewardIcon} from './RewardIcon';
import {OutcomeBanner,OutcomeBurst,StoneIcon,StrengtheningEffect} from './Forge';

// Mesmo tempo do Fortalecer: pedras voam, o martelo bate e só então o resultado aparece.
const SYNTHESIS_ANIMATION_MS=1300;
const ROMAN=['I','II','III','IV','V'];
const money=(value:number)=>value.toLocaleString('pt-BR');

/** Pedra de fortalecimento ou de composição pelo id da síntese (`fortify-2`, `attack-1`…). */
function SynthIcon({id,size,tier=false}:{id:string;size:number;tier?:boolean}){
 const stone=synthesisStone(id);if(!stone)return null;
 return <span className="synthesis-icon" style={{width:size,height:size}}>{stone.kind==='fortify'?<StoneIcon level={stone.level} size={size}/>:<CompositionIcon stat={COMPOSITION_STONE_BY_ID[id].stat} size={size}/>}{tier&&<small>{ROMAN[stone.level-1]}</small>}</span>;
}
const nameOf=(id:string)=>synthesisStone(id)?.name??'';

/** Aba Síntese do ferreiro: receitas em tabela, uma categoria por menu que abre; a bancada à esquerda mostra a receita escolhida. */
export function ForgeSynthesis({tabs}:{tabs:ReactNode}){
 const state=useGame(),p=state.profile!;
 const [open,setOpen]=useState<Set<string>>(()=>new Set([SYNTHESIS_CATEGORIES[0].id])),[onlyAvailable,setOnlyAvailable]=useState(false);
 const [selected,setSelected]=useState(''),[count,setCount]=useState(1);
 const [pending,setPending]=useState(false),[result,setResult]=useState<{target:string;count:number;cost:number;key:number}|null>(null),[error,setError]=useState<string|null>(null);
 const submitted=useRef(state.synthesisResult),startedAt=useRef(0),pendingRef=useRef(false);
 const locked=pending||state.status!=='online'||!!state.battle||!!state.room;
 const recipe:SynthesisRecipe|undefined=SYNTHESIS_RECIPE_BY_ID[selected];
 const max=recipe?synthesisMax(p,recipe):0,amount=Math.max(1,Math.min(count,max)),have=recipe?stockOf(p,recipe.input):0;
 const canSynthesize=!locked&&!!recipe&&max>=1;
 const owned=(r:SynthesisRecipe)=>stockOf(p,r.input)>0;
 // "Mostrar apenas disponíveis": só categorias (e receitas) com material na mochila.
 const categories=SYNTHESIS_CATEGORIES.map(category=>({...category,recipes:SYNTHESIS_RECIPES.filter(r=>r.category===category.id&&(!onlyAvailable||owned(r)))})).filter(category=>category.recipes.length);
 useEffect(()=>{
  if(!pending)return;
  const outcome=state.synthesisResult;
  if(outcome&&outcome!==submitted.current&&outcome.stone===selected){
   const timer=window.setTimeout(()=>{if(!pendingRef.current)return;pendingRef.current=false;setPending(false);setCount(1);setResult({target:outcome.target,count:outcome.count,cost:outcome.cost,key:Date.now()});audio.play('turn');},Math.max(0,SYNTHESIS_ANIMATION_MS-(performance.now()-startedAt.current)));
   return()=>window.clearTimeout(timer);
  }
  if(state.error||state.status!=='online'){pendingRef.current=false;setPending(false);setError(state.error??'Conexão interrompida.');}
 },[pending,state.synthesisResult,state.error,state.status,selected]);
 function toggle(id:string){setOpen(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});audio.play('click');}
 function choose(id:string){if(locked)return;setSelected(id);setCount(1);setResult(null);setError(null);audio.play('click');}
 function step(next:number){if(locked||!recipe)return;setCount(Math.max(1,Math.min(max,next)));setResult(null);audio.play('click');}
 function submit(){
  if(!canSynthesize||pendingRef.current)return;pendingRef.current=true;submitted.current=state.synthesisResult;startedAt.current=performance.now();
  setPending(true);setResult(null);setError(null);client.update({error:null});client.send({type:'synthesize',stone:selected,count:amount});audio.play('click');
 }
 const feedback=error??(pending?'A forja está trabalhando…':result?`Recebeu ${result.count} × ${nameOf(result.target)} por ${money(result.cost)} de ouro.`:!recipe?'Escolha uma receita na tabela.':have<recipe.inputCount?`Faltam pedras: cada síntese usa ${recipe.inputCount} × ${nameOf(recipe.input)}.`:max<1?'Ouro insuficiente para esta síntese.':`${amount*recipe.inputCount} × ${nameOf(recipe.input)} viram ${amount} × ${nameOf(recipe.result)}.`);
 return <div className="smith-layout synthesis-layout">
  <section className={`smith-bench forge-workbench synthesis-bench ${pending?'is-strengthening':''}`} id="forge-service-content" role="tabpanel" aria-label="Bancada de síntese" aria-busy={pending}>
   <header className="smith-head">
    <span className="smith-head-icon" aria-hidden="true"><Combine size={22}/></span>
    <div className="smith-identity"><small>Síntese</small><h2>{recipe?nameOf(recipe.result):'Escolha uma receita'}</h2></div>
   </header>
   <div className={`smith-stage forge-workshop synthesis-stage ${pending?'working':''} ${result?'is-success':''}`}>
    <span className="smith-coals" aria-hidden="true"/>
    <div className="synthesis-recipe">
     <div className="synthesis-material">
      <ItemCardFrame variant="slot" empty={!recipe} className="synthesis-material-card">{recipe&&<SynthIcon id={recipe.input} size={58} tier/>}</ItemCardFrame>
      {recipe?<span className={have<recipe.inputCount*amount?'short':''}><b>{money(have)}</b> / {money(recipe.inputCount*amount)}</span>:<span>Material</span>}
     </div>
     <ArrowRight className="synthesis-arrow" size={30} aria-hidden="true"/>
     <div className="smith-anvil">
      <ItemCardFrame variant="hero" empty={!recipe} className="forge-weapon-target synthesis-result-card" role="img" aria-label={recipe?`${nameOf(recipe.result)} × ${amount}`:'Resultado da síntese'}>
       {recipe?<><SynthIcon id={recipe.result} size={96} tier/>{max>=1&&<b className="synthesis-yield">×{amount}</b>}</>:<><Combine className="smith-target-placeholder" size={34}/><span>Escolha uma receita</span></>}
      </ItemCardFrame>
      <span className="smith-anvil-base" aria-hidden="true"/>
      {pending&&<StrengtheningEffect/>}
     </div>
    </div>
    <div className="smith-forge-controls">
     <div className="synthesis-quantity" role="group" aria-label="Quantidade de sínteses">
      <small>Quantidade</small>
      <button aria-label="Uma a menos" disabled={locked||!recipe||amount<=1} onClick={()=>step(amount-1)}><Minus size={14}/></button>
      <strong aria-live="polite">{max>=1?amount:0}</strong>
      <button aria-label="Uma a mais" disabled={locked||!recipe||amount>=max} onClick={()=>step(amount+1)}><Plus size={14}/></button>
      <button className="synthesis-max" disabled={locked||!recipe||max<1||amount>=max} onClick={()=>step(max)}>Máx. {max}</button>
     </div>
     <div className={`composition-cost synthesis-cost ${recipe&&p.gold<recipe.cost*amount?'insufficient':''}`} title="Custo em ouro"><RewardIcon size={16}/><strong>{money(recipe?recipe.cost*amount:0)}</strong></div>
     <button className={`smith-action forge-submit ${pending?'pending':''} ${canSynthesize?'is-ready':''}`} disabled={!canSynthesize} aria-busy={pending} onClick={submit}>{pending?<LoaderCircle className="button-spinner" size={20}/>:<Combine size={20}/>}{pending?'Sintetizando…':'Sintetizar'}</button>
     <div className={`forge-feedback ${error?'is-error':result?'is-success':!canSynthesize&&!pending?'is-guidance':''}`} role="status" aria-live="polite">{feedback}</div>
    </div>
    {result&&<div key={result.key} className="forge-outcome success" role="status" aria-live="polite"><OutcomeBurst success/><OutcomeBanner success/><span className="forge-outcome-level">+{result.count} {nameOf(result.target)}</span></div>}
   </div>
  </section>
  <section className="smith-pane synthesis-pane" aria-label="Receitas de síntese">
   <div className="smith-toolbar"><h2><Combine size={16}/>Receitas</h2><span className="capacity">4 pedras → 1 do nível seguinte</span></div>
   <div className="smith-shelf">
    <div className="smith-grid synthesis-table-wrap">
     <table className="synthesis-table">
      <thead><tr><th>Item</th><th>Materiais</th><th>Máx.</th><th>Custo</th></tr></thead>
      {categories.map(category=>{const expanded=open.has(category.id),ready=category.recipes.filter(r=>synthesisMax(p,r)>0).length;return <tbody key={category.id} className={expanded?'open':''}>
       <tr className="synthesis-category"><td colSpan={4}><button aria-expanded={expanded} onClick={()=>toggle(category.id)}><ChevronDown size={16} className="synthesis-chevron"/>{category.name}<span>{ready?`${ready} ${ready===1?'disponível':'disponíveis'}`:'—'}</span></button></td></tr>
       {expanded&&category.recipes.map(r=>{const rowMax=synthesisMax(p,r),stock=stockOf(p,r.input);return <tr key={r.id} className={`synthesis-row ${selected===r.id?'selected':''} ${rowMax<1?'unavailable':''}`} aria-selected={selected===r.id} tabIndex={locked?-1:0} onClick={()=>choose(r.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(r.id);}}}>
        <td><div className="synthesis-item"><SynthIcon id={r.result} size={38}/><b>{nameOf(r.result)}</b></div></td>
        <td><div className="synthesis-need"><SynthIcon id={r.input} size={26}/><span><em><b>{r.inputCount}×</b> {nameOf(r.input)}</em><small className={stock<r.inputCount?'short':''}>Você tem {money(stock)}</small></span></div></td>
        <td className="synthesis-max-cell">{rowMax}</td>
        <td><span className="synthesis-price"><RewardIcon size={15}/>{money(r.cost)}</span></td>
       </tr>;})}
      </tbody>;})}
     </table>
     {!categories.length&&<p className="synthesis-empty">Nenhuma pedra para sintetizar na mochila.</p>}
    </div>
    {tabs}
   </div>
   <footer className="smith-footer">
    <label className="synthesis-filter"><input type="checkbox" checked={onlyAvailable} onChange={e=>{setOnlyAvailable(e.target.checked);audio.play('click');}}/><span>Mostrar apenas disponíveis</span></label>
    <div className="smith-wallet"><span title="Ouro"><RewardIcon size={18}/><b>{money(p.gold)}</b></span></div>
   </footer>
  </section>
 </div>;
}
