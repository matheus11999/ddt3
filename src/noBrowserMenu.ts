/**
 * Global rule: the browser's own context menu never opens in the game.
 * Only the game's menus (player menu, backpack menu…) answer the right click.
 * Capture phase + preventDefault only, so the game's own onContextMenu handlers still run.
 */
export function blockBrowserContextMenu(target:Window=window){
 const block=(event:Event)=>event.preventDefault();
 target.addEventListener('contextmenu',block,{capture:true});
 return()=>target.removeEventListener('contextmenu',block,{capture:true});
}
if(typeof window!=='undefined')blockBrowserContextMenu();
