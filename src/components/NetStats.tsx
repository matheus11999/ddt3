import {useEffect,useState} from 'react';
import {client} from '../client';
import {frameMeter} from '../game/frameMeter';
import {frameLimit} from '../game/frameLimit';
import './NetStats.css';

/** Small FPS and latency readout pinned to the top centre of the view, in every area. */
export function NetStats(){
 const [stats,setStats]=useState({fps:0,ping:-1});
 useEffect(()=>{
  // The scene skips painting under opaque menus; then the window's own frame rate (capped like the scene) stands in.
  let ui=0,raf=0;const tick=()=>{ui++;raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
  let last=performance.now();frameMeter.take();
  const sample=window.setInterval(()=>{
   const now=performance.now(),seconds=(now-last)/1000;last=now;
   const painted=frameMeter.take(),frames=painted>0?painted:Math.min(ui,frameLimit.get()*seconds);ui=0;
   const {status,latency}=client.state;
   setStats({fps:Math.round(frames/seconds),ping:status==='online'?latency:-1});
  },1000);
  return()=>{cancelAnimationFrame(raf);clearInterval(sample);};
 },[]);
 const fpsLevel=stats.fps>=frameLimit.get()*.83?'good':stats.fps>=30?'fair':'poor',pingLevel=stats.ping<0?'poor':stats.ping<=100?'good':stats.ping<=200?'fair':'poor';
 return <div className="net-stats" aria-hidden="true">
  <span data-level={fpsLevel}>{stats.fps||'–'}<small>FPS</small></span>
  <i/>
  <span data-level={pingLevel}>{stats.ping<0?'–':stats.ping}<small>ms</small></span>
 </div>;
}
