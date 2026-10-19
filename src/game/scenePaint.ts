/** Lets a loading cover wait until the canvas has painted a complete frame: the plaza with all its art, or the battle. */
let waiters:(()=>void)[]=[];
export const scenePaint={
 wanted:()=>waiters.length>0,
 done(){const list=waiters;waiters=[];for(const finish of list)finish();}
};
/** Resolves on the next complete frame, or after `timeout` ms whatever the canvas is doing. */
export function completeFrame(timeout:number){
 return new Promise<void>(resolve=>{let settled=false;const finish=()=>{if(settled)return;settled=true;waiters=waiters.filter(f=>f!==finish);resolve();};waiters.push(finish);setTimeout(finish,timeout);});
}
