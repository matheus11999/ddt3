import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blockBrowserContextMenu} from '../src/noBrowserMenu';

test('browser context menu is blocked while the game menu handler still runs',()=>{
 const target=new EventTarget();
 const stop=blockBrowserContextMenu(target as unknown as Window);
 let gameMenu=false;
 target.addEventListener('contextmenu',()=>{gameMenu=true;});
 const event=new Event('contextmenu',{cancelable:true});
 target.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true);
 assert.equal(gameMenu,true);
 stop();
 const later=new Event('contextmenu',{cancelable:true});
 target.dispatchEvent(later);
 assert.equal(later.defaultPrevented,false);
});
