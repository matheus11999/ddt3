// Brick breaker painter. Every drawing works in a 512 design space.
const TAU=Math.PI*2, INK='#2b110a';
function seeded(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function lg(c,x0,y0,x1,y1,stops){const g=c.createLinearGradient(x0,y0,x1,y1);stops.forEach(([o,col])=>g.addColorStop(o,col));return g;}
function rg(c,x,y,r0,x1,y1,r1,stops){const g=c.createRadialGradient(x,y,r0,x1,y1,r1);stops.forEach(([o,col])=>g.addColorStop(o,col));return g;}
function poly(c,pts){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
function ink(c,w=4,color=INK){c.lineJoin='round';c.lineCap='round';c.strokeStyle=color;c.lineWidth=w;c.stroke();}
function speckle(c,clip,rand,n,colors,size=[0.6,1.8],bounds){c.save();clip();c.clip();for(let i=0;i<n;i++){c.fillStyle=colors[i%colors.length];c.globalAlpha=.25+rand()*.35;const r=size[0]+rand()*(size[1]-size[0]);c.beginPath();c.arc(bounds[0]+rand()*bounds[2],bounds[1]+rand()*bounds[3],r,0,TAU);c.fill();}c.restore();}

const PAL={
 clay:{front:['#e2593a','#b8341f'],top:['#ff9a6a','#e9673f'],side:['#8f2414','#6d190e'],speck:['#7a1c10','#ffb28a','#c74a2c']},
 hot:{front:['#ff6a32','#c92c18'],top:['#ffd08a','#ff8a3d'],side:['#a8240f','#7c160a'],speck:['#ffe7a0','#ff9e40','#a5260f']},
 cinder:{front:['#c9ccd6','#8e93a6'],top:['#f2f3f8','#cfd2de'],side:['#6c7086','#4e5266'],speck:['#5f6377','#ffffff','#a9adbe']},
 gold:{front:['#ffd25a','#d1891c'],top:['#fff2a8','#ffcf4a'],side:['#a8600f','#7f450a'],speck:['#fff6c0','#b56f12','#ffe48a']},
};
/** A chunky 3D brick: front, top and side faces, chipped corner, optional cinder holes. */
function brick(c,x,y,w,h,d,angle,pal,{holes=0,seed=1,glow=false,cracks=false}={}){
 const p=PAL[pal],rand=seeded(seed),dx=d*.85,dy=-d*.55;
 c.save();c.translate(x,y);c.rotate(angle);
 const front=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]],top=[[-w/2,-h/2],[-w/2+dx,-h/2+dy],[w/2+dx,-h/2+dy],[w/2,-h/2]],side=[[w/2,-h/2],[w/2+dx,-h/2+dy],[w/2+dx,h/2+dy],[w/2,h/2]];
 if(glow){c.save();c.shadowColor='#ffb02e';c.shadowBlur=26;poly(c,[[-w/2,-h/2+dy],[w/2+dx,-h/2+dy],[w/2+dx,h/2],[-w/2,h/2]]);c.fillStyle='#ff9a2e';c.fill();c.restore();}
 poly(c,side);c.fillStyle=lg(c,w/2,0,w/2+dx,0,[[0,p.side[0]],[1,p.side[1]]]);c.fill();
 poly(c,top);c.fillStyle=lg(c,0,-h/2+dy,0,-h/2,[[0,p.top[0]],[1,p.top[1]]]);c.fill();
 poly(c,front);c.fillStyle=lg(c,0,-h/2,0,h/2,[[0,p.front[0]],[1,p.front[1]]]);c.fill();
 speckle(c,()=>poly(c,front),rand,Math.round(w*h/40),p.speck,[.6,1.6],[-w/2,-h/2,w,h]);
 speckle(c,()=>poly(c,top),rand,Math.round(w*d/60),p.speck,[.5,1.2],[-w/2,-h/2+dy,w+dx,-dy]);
 for(let i=0;i<holes;i++){const hx=-w/2+w*(i+.5)/holes,hw=w/holes*.48,hh=h*.42;
  c.beginPath();c.moveTo(hx-hw/2+dx*.35,-h/2+dy*.35+0);c.lineTo(hx+hw/2+dx*.35,-h/2+dy*.35);c.lineTo(hx+hw/2,-h/2+dy*.05);c.lineTo(hx-hw/2,-h/2+dy*.05);c.closePath();
  c.fillStyle='#3a3d4d';c.fill();
  // holes on the front read as the cinder block windows of the crate reference
  poly(c,[[hx-hw/2,-hh/2],[hx+hw/2,-hh/2],[hx+hw/2,hh/2],[hx-hw/2,hh/2]]);c.fillStyle=lg(c,0,-hh/2,0,hh/2,[[0,'#23252f'],[1,'#585d70']]);c.fill();ink(c,1.6,'#1d1f28');
  poly(c,[[hx-hw/2,hh/2-2],[hx+hw/2,hh/2-2],[hx+hw/2,hh/2],[hx-hw/2,hh/2]]);c.fillStyle='#e8eaf2';c.fill();}
 if(cracks){c.save();c.shadowColor='#ffd36b';c.shadowBlur=10;c.strokeStyle='#fff0a8';c.lineWidth=2.2;c.beginPath();c.moveTo(-w*.38,-h*.1);c.lineTo(-w*.15,h*.15);c.lineTo(w*.05,-h*.12);c.lineTo(w*.32,h*.2);c.moveTo(-w*.15,h*.15);c.lineTo(-w*.1,h*.45);c.stroke();c.restore();}
 // chipped corner + rim light
 c.beginPath();c.moveTo(-w/2,-h/2);c.lineTo(w/2,-h/2);c.strokeStyle=pal==='cinder'?'#ffffff':'#ffd8b0';c.globalAlpha=.8;c.lineWidth=2;c.stroke();c.globalAlpha=1;
 poly(c,[[-w/2,-h/2],[-w/2+dx,-h/2+dy],[w/2+dx,-h/2+dy],[w/2+dx,h/2+dy],[w/2,h/2],[-w/2,h/2]]);ink(c,3.2);
 c.beginPath();c.moveTo(w/2,-h/2);c.lineTo(w/2+dx,-h/2+dy);c.moveTo(-w/2,-h/2);c.lineTo(w/2,-h/2);c.lineTo(w/2,h/2);ink(c,1.8);
 c.restore();
}
function rope(c,pts,width=9,colors=['#f2d89a','#b98a46']){
 c.save();c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.lineWidth=width+4;c.strokeStyle=INK;c.lineCap='round';c.lineJoin='round';c.stroke();
 c.lineWidth=width;c.strokeStyle=colors[1];c.stroke();c.lineWidth=width*.45;c.strokeStyle=colors[0];c.setLineDash([width*.6,width*.55]);c.stroke();c.restore();
}
function shadow(c,x,y,rx,ry,a=.28){c.save();c.fillStyle=rg(c,x,y,0,x,y,rx,[[0,`rgba(40,12,6,${a})`],[1,'rgba(40,12,6,0)']]);c.scale(1,ry/rx);c.beginPath();c.arc(x,y*rx/ry,rx,0,TAU);c.fill();c.restore();}
function sparkle(c,x,y,r,color='#fff6c8'){c.save();c.translate(x,y);c.fillStyle=color;c.shadowColor='#ffd060';c.shadowBlur=r*1.6;c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*.28:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.restore();}
function gem(c,x,y,r,col=['#7dffb8','#11a356','#05522a']){c.save();c.translate(x,y);poly(c,[[0,-r],[r*.85,-r*.15],[r*.55,r*.85],[-r*.55,r*.85],[-r*.85,-r*.15]]);c.fillStyle=rg(c,-r*.3,-r*.4,1,0,0,r*1.2,[[0,col[0]],[.5,col[1]],[1,col[2]]]);c.fill();ink(c,3);poly(c,[[0,-r*.55],[r*.4,-r*.1],[0,r*.3],[-r*.4,-r*.1]]);c.fillStyle='rgba(255,255,255,.45)';c.fill();c.restore();}

/* ---------- +0..8: red cloth sack tied with rope, bricks peeking out ---------- */
function sack(c){
 shadow(c,256,440,170,34);
 // bricks behind the neck
 brick(c,212,170,92,46,26,-.5,'clay',{seed:3});brick(c,300,160,96,48,26,.38,'clay',{seed:4});brick(c,256,150,86,44,24,-.06,'clay',{seed:5});
 // body
 const body=()=>{c.beginPath();c.moveTo(178,215);c.bezierCurveTo(95,250,70,355,112,410);c.bezierCurveTo(160,462,350,465,400,412);c.bezierCurveTo(445,360,420,250,334,214);c.bezierCurveTo(300,232,215,232,178,215);c.closePath();};
 body();c.fillStyle=rg(c,210,290,20,256,330,230,[[0,'#ff5a42'],[.45,'#d82a20'],[.85,'#981812'],[1,'#6e0f0b']]);c.fill();
 // stitched patch + folds
 c.save();body();c.clip();
 c.strokeStyle='rgba(90,10,6,.55)';c.lineWidth=5;[[150,250,140,390],[200,240,205,440],[318,240,330,440],[372,250,388,392]].forEach(([a,b,cx,d])=>{c.beginPath();c.moveTo(a,b);c.quadraticCurveTo((a+cx)/2+12,(b+d)/2,cx,d);c.stroke();});
 c.strokeStyle='rgba(255,140,110,.45)';c.lineWidth=3;[[160,252,152,385],[212,244,218,436],[330,244,342,430]].forEach(([a,b,cx,d])=>{c.beginPath();c.moveTo(a+5,b);c.quadraticCurveTo((a+cx)/2+17,(b+d)/2,cx+5,d);c.stroke();});
 // gold brick-pattern emblem
 c.save();c.translate(256,345);poly(c,[[-62,-44],[62,-44],[62,44],[-62,44]]);c.fillStyle=lg(c,0,-44,0,44,[[0,'#7c120c'],[1,'#5a0a07']]);c.fill();ink(c,3,'#ffcf5a');
 c.strokeStyle='#ffcf5a';c.lineWidth=3;for(let r=-1;r<=1;r++){c.beginPath();c.moveTo(-62,r*29);c.lineTo(62,r*29);c.stroke();}
 for(let r=0;r<3;r++)for(let k=-2;k<=2;k++){const x=k*30+(r%2?15:0);if(Math.abs(x)<60){c.beginPath();c.moveTo(x,-44+r*29);c.lineTo(x,-44+(r+1)*29);c.stroke();}}
 c.restore();
 c.fillStyle='rgba(255,255,255,.18)';c.beginPath();c.ellipse(170,300,22,70,-.25,0,TAU);c.fill();
 c.restore();
 body();ink(c,5);
 // gathered neck
 c.beginPath();c.moveTo(170,214);c.quadraticCurveTo(256,250,342,212);c.lineTo(352,190);c.quadraticCurveTo(256,215,162,192);c.closePath();c.fillStyle=lg(c,0,190,0,240,[[0,'#ff6a4c'],[1,'#a91c15']]);c.fill();ink(c,4);
 for(let i=0;i<7;i++){c.beginPath();c.moveTo(180+i*27,198+Math.sin(i)*3);c.lineTo(186+i*26,226);c.strokeStyle='rgba(90,10,6,.6)';c.lineWidth=3;c.stroke();}
 rope(c,[[160,222],[210,238],[256,242],[302,238],[352,220]],12);
 // knot and hanging tassel
 rope(c,[[150,226],[120,262],[112,300]],10);rope(c,[[150,226],[96,240],[80,272]],10);
 c.beginPath();c.ellipse(152,226,20,16,.3,0,TAU);c.fillStyle=rg(c,146,220,2,152,226,20,[[0,'#ffe6aa'],[1,'#b58641']]);c.fill();ink(c,4);
 c.save();c.translate(112,312);poly(c,[[-10,-8],[10,-8],[16,30],[-16,30]]);c.fillStyle=lg(c,0,-8,0,30,[[0,'#ffd06a'],[1,'#c07a1c']]);c.fill();ink(c,3);c.restore();
 c.save();c.translate(80,282);poly(c,[[-9,-6],[9,-6],[13,24],[-13,24]]);c.fillStyle=lg(c,0,-6,0,24,[[0,'#ffd06a'],[1,'#c07a1c']]);c.fill();ink(c,3);c.restore();
}

/* ---------- +9: golden pot of bricks with a pickaxe ---------- */
function pickaxe(c,x,y,angle,scale=1,gold=false){
 c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);
 // handle
 poly(c,[[-7,0],[7,0],[7,210],[-7,210]]);c.fillStyle=lg(c,-7,0,7,0,[[0,'#8a4a22'],[.45,'#c98447'],[1,'#6a3415']]);c.fill();ink(c,3.5);
 [40,120,190].forEach(v=>{c.beginPath();c.moveTo(-7,v);c.lineTo(7,v+6);c.strokeStyle='#4a230c';c.lineWidth=2;c.stroke();});
 // head
 c.beginPath();c.moveTo(-96,34);c.quadraticCurveTo(-40,-14,0,-12);c.quadraticCurveTo(40,-14,96,34);c.quadraticCurveTo(44,6,0,12);c.quadraticCurveTo(-44,6,-96,34);c.closePath();
 c.fillStyle=gold?lg(c,0,-14,0,30,[[0,'#fff1a0'],[.5,'#ffc93e'],[1,'#b06d0e']]):lg(c,0,-14,0,30,[[0,'#f4f7ff'],[.45,'#a9b3c9'],[1,'#525b72']]);c.fill();ink(c,4);
 c.beginPath();c.moveTo(-80,26);c.quadraticCurveTo(-30,-4,0,-4);c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=2.5;c.stroke();
 poly(c,[[-14,-16],[14,-16],[14,18],[-14,18]]);c.fillStyle=lg(c,0,-16,0,18,[[0,'#ffe27a'],[1,'#b8741a']]);c.fill();ink(c,3);
 c.restore();
}
function cloud(c,x,y,s){c.save();c.translate(x,y);c.scale(s,s);c.beginPath();c.moveTo(-20,6);c.bezierCurveTo(-28,-10,-8,-20,0,-8);c.bezierCurveTo(4,-22,26,-16,20,0);c.bezierCurveTo(30,4,24,16,12,12);c.moveTo(-6,2);c.arc(-2,2,5,Math.PI,TAU*.9);c.strokeStyle='#ffd46a';c.lineWidth=3.2;c.lineCap='round';c.stroke();c.restore();}
function pot(c){
 shadow(c,256,450,175,32);
 brick(c,196,178,96,48,28,-.42,'clay',{seed:11});brick(c,300,170,100,50,28,.32,'clay',{seed:12});brick(c,250,150,92,46,26,-.08,'clay',{seed:13});brick(c,350,200,78,40,24,.85,'clay',{seed:14});brick(c,160,210,74,38,22,-.9,'clay',{seed:15});
 pickaxe(c,372,112,.55,.95,false);
 // ring handles
 for(const s of [-1,1]){c.save();c.translate(256+s*176,300);c.beginPath();c.ellipse(0,10,26,30,0,0,TAU);c.lineWidth=13;c.strokeStyle=INK;c.stroke();c.lineWidth=8;c.strokeStyle=lg(c,-26,0,26,0,[[0,'#ffe68a'],[1,'#b8721a']]);c.stroke();
  c.beginPath();c.ellipse(-s*6,-20,16,12,0,0,TAU);c.fillStyle=lg(c,0,-32,0,-8,[[0,'#fff1a0'],[1,'#c07d16']]);c.fill();ink(c,3.5);c.restore();}
 // body
 const body=()=>{c.beginPath();c.moveTo(108,232);c.bezierCurveTo(78,310,110,412,170,440);c.lineTo(342,440);c.bezierCurveTo(402,412,434,310,404,232);c.closePath();};
 body();c.fillStyle=lg(c,108,0,404,0,[[0,'#8a4a0c'],[.18,'#e6a52c'],[.42,'#fff0a0'],[.62,'#f2b63a'],[1,'#7e420a']]);c.fill();
 c.save();body();c.clip();
 // red band with gold cloud swirls
 c.beginPath();c.rect(60,276,400,108);c.fillStyle=lg(c,0,276,0,384,[[0,'#c22416'],[.5,'#e33b22'],[1,'#7a0f09']]);c.fill();
 c.strokeStyle='#ffcf5a';c.lineWidth=4;c.beginPath();c.moveTo(60,280);c.lineTo(460,280);c.moveTo(60,380);c.lineTo(460,380);c.stroke();
 [[150,330,1.3],[256,322,1.6],[362,330,1.3],[205,355,.9],[310,355,.9]].forEach(([x,y,s])=>cloud(c,x,y,s));
 c.fillStyle='rgba(255,255,255,.35)';c.beginPath();c.ellipse(200,300,14,90,-.05,0,TAU);c.fill();
 c.restore();body();ink(c,5);
 // foot
 c.beginPath();c.moveTo(162,436);c.lineTo(350,436);c.lineTo(334,462);c.lineTo(178,462);c.closePath();c.fillStyle=lg(c,0,436,0,462,[[0,'#ffd65c'],[1,'#8a4c0c']]);c.fill();ink(c,4);
 // rim
 c.beginPath();c.ellipse(256,232,152,30,0,0,TAU);c.fillStyle=lg(c,0,202,0,262,[[0,'#fff4b0'],[.5,'#e0a234'],[1,'#7e440a']]);c.fill();ink(c,5);
 c.beginPath();c.ellipse(256,230,128,18,0,0,TAU);c.fillStyle='#4a1a08';c.fill();ink(c,3);
 // bricks spilling over the rim front
 brick(c,214,232,84,42,22,-.12,'clay',{seed:16});brick(c,298,236,80,40,22,.18,'clay',{seed:17});
 sparkle(c,400,226,12);sparkle(c,128,262,8);
}

/* ---------- +10/11: crimson lacquer crate of cinder blocks ---------- */
function crate(c,{gold=false}={}){
 shadow(c,256,456,182,30);
 // blocks behind
 brick(c,190,166,110,58,34,-.32,gold?'hot':'cinder',{holes:2,seed:21,glow:gold,cracks:gold});
 brick(c,318,150,116,60,34,.22,gold?'hot':'cinder',{holes:2,seed:22,glow:gold,cracks:gold});
 brick(c,250,196,104,56,32,-.04,gold?'hot':'cinder',{holes:2,seed:23,glow:gold,cracks:gold});
 brick(c,370,222,86,46,28,.7,gold?'gold':'clay',{seed:24});
 // legs
 for(const x of [120,392]){c.save();c.translate(x,430);c.beginPath();c.moveTo(-14,0);c.quadraticCurveTo(-22,22,-6,34);c.lineTo(10,34);c.quadraticCurveTo(4,20,14,0);c.closePath();c.fillStyle=lg(c,0,0,0,34,[[0,'#ffe07a'],[1,'#8a4c0c']]);c.fill();ink(c,3.5);c.restore();}
 // front box (slight perspective)
 const front=[[96,250],[416,250],[400,432],[112,432]],top=[[96,250],[136,222],[446,222],[416,250]],side=[[416,250],[446,222],[430,402],[400,432]];
 poly(c,side);c.fillStyle=lg(c,416,0,446,0,[[0,gold?'#7a1120':'#5e0b0b'],[1,gold?'#4a0814':'#3a0606']]);c.fill();ink(c,4);
 poly(c,front);c.fillStyle=lg(c,0,250,0,432,gold?[[0,'#d81e3c'],[.5,'#a50f2a'],[1,'#5c0614']]:[[0,'#e02a1e'],[.5,'#b0150f'],[1,'#650808']]);c.fill();
 c.save();poly(c,front);c.clip();
 // lacquer pattern: gold meander + flame curls
 c.strokeStyle='#ffcf5a';c.lineWidth=5;c.lineCap='round';
 for(let i=0;i<6;i++){const x=126+i*50;c.beginPath();c.moveTo(x,412);c.lineTo(x,330);c.quadraticCurveTo(x+4,300,x+22,302);c.quadraticCurveTo(x+38,306,x+30,326);c.quadraticCurveTo(x+22,340,x+14,326);c.stroke();}
 c.beginPath();c.moveTo(96,288);c.lineTo(416,288);c.moveTo(96,412);c.lineTo(416,412);c.lineWidth=6;c.stroke();
 c.fillStyle='rgba(255,255,255,.22)';c.beginPath();c.moveTo(110,256);c.lineTo(160,256);c.lineTo(140,430);c.lineTo(116,430);c.closePath();c.fill();
 c.restore();poly(c,front);ink(c,5);
 // gold frame trims
 const trim=(pts,w=12)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.lineWidth=w+5;c.strokeStyle=INK;c.lineJoin='round';c.stroke();c.lineWidth=w;c.strokeStyle=lg(c,0,220,0,440,[[0,'#fff3a6'],[.5,'#ffc23c'],[1,'#a8640e']]);c.stroke();};
 trim([[96,250],[416,250],[446,222]]);trim([[96,250],[112,432],[400,432],[430,402]]);trim([[416,250],[400,432]],10);
 for(const [x,y] of [[96,250],[416,250],[112,432],[400,432]]){c.beginPath();c.arc(x,y,10,0,TAU);c.fillStyle=rg(c,x-3,y-3,1,x,y,10,[[0,'#fff6c0'],[1,'#c07d16']]);c.fill();ink(c,3);}
 if(gold){
  // +12 crest: winged emblem with an ember gem, crossed hammer and pickaxe
  for(const s of [-1,1]){c.save();c.translate(256+s*58,345);c.scale(s,1);c.beginPath();c.moveTo(0,-26);c.bezierCurveTo(30,-60,74,-50,92,-30);c.bezierCurveTo(70,-28,72,-10,52,-8);c.bezierCurveTo(62,4,50,18,30,12);c.bezierCurveTo(24,26,8,24,0,18);c.closePath();c.fillStyle=lg(c,0,-60,0,26,[[0,'#fff6b8'],[.5,'#ffc63c'],[1,'#a8620e']]);c.fill();ink(c,3.5);
   [[20,-20,60,-36],[22,-6,64,-20],[16,8,44,0]].forEach(([a,b,d,e])=>{c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.strokeStyle='#9a5a0c';c.lineWidth=2.5;c.stroke();});c.restore();}
  c.save();c.translate(256,345);poly(c,[[0,-46],[40,-20],[34,30],[0,52],[-34,30],[-40,-20]]);c.fillStyle=lg(c,0,-46,0,52,[[0,'#fff3a6'],[1,'#b26e10']]);c.fill();ink(c,4);c.restore();
  gem(c,256,342,24,['#ffe6a0','#ff6a1e','#8a1a06']);
  sparkle(c,150,212,14);sparkle(c,380,140,12);sparkle(c,444,300,9);sparkle(c,100,330,8);
 }else{
  c.save();c.translate(256,350);poly(c,[[0,-34],[30,-14],[24,22],[0,38],[-24,22],[-30,-14]]);c.fillStyle=lg(c,0,-34,0,38,[[0,'#fff3a6'],[1,'#b26e10']]);c.fill();ink(c,4);c.restore();
  gem(c,256,348,17,['#9cf0ff','#1e8de0','#0a3e7a']);
 }
}
function relic(c){
 // +12 adds a royal aura behind the crate before painting it
 c.save();c.globalCompositeOperation='source-over';
 c.fillStyle=rg(c,256,250,30,256,250,250,[[0,'rgba(255,190,70,.55)'],[.55,'rgba(255,110,40,.18)'],[1,'rgba(255,90,30,0)']]);c.fillRect(0,0,512,512);c.restore();
 pickaxe(c,118,92,-.55,.9,true);
 // golden hammer
 c.save();c.translate(402,96);c.rotate(.55);poly(c,[[-7,0],[7,0],[7,190],[-7,190]]);c.fillStyle=lg(c,-7,0,7,0,[[0,'#7a2a10'],[.5,'#c95a2a'],[1,'#5a1a08']]);c.fill();ink(c,3.5);
 poly(c,[[-46,-30],[46,-30],[46,14],[-46,14]]);c.fillStyle=lg(c,0,-30,0,14,[[0,'#fff3a6'],[.5,'#ffc23c'],[1,'#a8640e']]);c.fill();ink(c,4);c.beginPath();c.moveTo(-40,-24);c.lineTo(40,-24);c.strokeStyle='#fff8d0';c.lineWidth=2.5;c.stroke();c.restore();
 crate(c,{gold:true});
 for(let i=0;i<14;i++){const r=seeded(90+i);sparkle(c,60+r()*390,60+r()*150,3+r()*5,'#ffe9a0');}
}

/* ---------- VFX atlas: 4 tiers × (projectile, muzzle, impact) ---------- */
function projectile(c,tier){
 // a tied bundle that grows: clay → clay+gold band → cinder+crimson → molten relic
 if(tier===0){brick(c,0,0,70,34,20,0,'clay',{seed:31});rope(c,[[-8,-26],[-6,22]],6);}
 if(tier===1){brick(c,-4,10,72,34,18,0,'clay',{seed:32});brick(c,4,-24,72,34,18,0,'clay',{seed:33});
  for(const x of [-14,14]){c.beginPath();c.rect(x-5,-44,10,74);c.fillStyle=lg(c,x-5,0,x+5,0,[[0,'#fff1a0'],[1,'#b8741a']]);c.fill();ink(c,2.5);}}
 if(tier===2){brick(c,-14,14,74,36,20,0,'cinder',{holes:2,seed:34});brick(c,14,-20,74,36,20,0,'clay',{seed:35});brick(c,-10,-50,60,30,16,.1,'clay',{seed:36});
  c.beginPath();c.rect(-6,-68,12,104);c.fillStyle=lg(c,-6,0,6,0,[[0,'#ff4a3a'],[1,'#8a0d0d']]);c.fill();ink(c,2.5);gem(c,0,-6,9,['#9cf0ff','#1e8de0','#0a3e7a']);}
 if(tier===3){c.fillStyle=rg(c,0,-10,4,0,-10,90,[[0,'rgba(255,214,110,.7)'],[1,'rgba(255,120,40,0)']]);c.fillRect(-100,-110,200,200);
  brick(c,-14,16,76,36,20,0,'hot',{holes:2,seed:37,glow:true,cracks:true});brick(c,14,-20,76,36,20,0,'hot',{seed:38,glow:true,cracks:true});brick(c,-8,-54,62,30,16,.1,'gold',{seed:39});
  for(const x of [-18,18]){c.beginPath();c.rect(x-5,-74,10,112);c.fillStyle=lg(c,x-5,0,x+5,0,[[0,'#fff1a0'],[1,'#b8741a']]);c.fill();ink(c,2.5);}gem(c,0,-8,10,['#ffe6a0','#ff6a1e','#8a1a06']);sparkle(c,40,-60,8);sparkle(c,-44,30,6);}
}
function dustPuff(c,x,y,r,rand,tint=['#f4e2c2','#d9b48a','#b98660']){
 for(let i=0;i<7;i++){const a=rand()*TAU,d=r*.45*rand();const px=x+Math.cos(a)*d,py=y+Math.sin(a)*d*.7,pr=r*(.45+rand()*.35);
  c.beginPath();c.arc(px,py,pr,0,TAU);c.fillStyle=rg(c,px-pr*.35,py-pr*.45,pr*.1,px,py,pr,[[0,tint[0]],[.6,tint[1]],[1,tint[2]]]);c.fill();c.lineWidth=2.5;c.strokeStyle='rgba(110,60,32,.6)';c.stroke();}
}
function muzzle(c,tier){
 const rand=seeded(50+tier),len=70+tier*26;
 // forward dust cone pointing +x with chips
 for(let i=0;i<5+tier*2;i++){const t=i/(4+tier*2);dustPuff(c,-30+t*len,(rand()-.5)*20*t,14+t*16+tier*2,rand);}
 c.save();c.globalCompositeOperation='lighter';for(let i=0;i<4+tier*2;i++){c.strokeStyle=tier>=3?'#ffd36b':'#ffe9c0';c.lineWidth=3;c.beginPath();const y=(rand()-.5)*40;c.moveTo(-10,y*.3);c.lineTo(len*.9,y);c.stroke();}c.restore();
 for(let i=0;i<2+tier*2;i++)brick(c,len*.4+rand()*len*.6,(rand()-.5)*60,14+rand()*6,8,5,rand()*3,tier>=3?'hot':i%3===2&&tier>=2?'cinder':'clay',{seed:60+i});
 if(tier>=2)sparkle(c,len,-10,10);
}
function impact(c,tier){
 const rand=seeded(70+tier),R=70+tier*16;
 if(tier>=1){c.fillStyle=rg(c,0,0,4,0,0,R*1.25,[[0,tier>=3?'rgba(255,236,150,.95)':'rgba(255,220,160,.85)'],[.4,tier>=3?'rgba(255,130,40,.55)':'rgba(255,140,80,.35)'],[1,'rgba(255,100,40,0)']]);c.fillRect(-R*1.4,-R*1.4,R*2.8,R*2.8);}
 // ground-hugging dust ring
 for(let i=0;i<14;i++){const a=Math.PI*(1+i/13),x=Math.cos(a)*R*.95,y=Math.sin(a)*R*.55+R*.25;dustPuff(c,x,y,R*.22+rand()*R*.08,rand);}
 dustPuff(c,0,-R*.1,R*.38,rand);
 // star burst
 c.save();c.translate(0,-R*.05);c.beginPath();for(let i=0;i<16;i++){const a=i*TAU/16,r=i%2?R*.25:R*(.7+rand()*.25);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();
 c.fillStyle=rg(c,0,0,2,0,0,R*.8,[[0,'#fffbe0'],[.4,tier>=3?'#ffcc4a':'#ffd7a0'],[1,tier>=3?'rgba(255,90,30,.2)':'rgba(230,120,70,.15)']]);c.fill();c.restore();
 for(let i=0;i<6+tier*3;i++){const a=rand()*TAU,d=R*(.5+rand()*.6);brick(c,Math.cos(a)*d,Math.sin(a)*d*.7-R*.15,16+rand()*12,9+rand()*4,6,rand()*TAU,tier>=3&&i%2?'hot':tier>=2&&i%3===0?'cinder':'clay',{seed:80+i,glow:tier>=3&&i%3===0});}
 if(tier>=2)for(let i=0;i<3+tier;i++)sparkle(c,(rand()-.5)*R*2,(rand()-.6)*R*1.4,5+rand()*5);
}
function atlas(){
 const W=1448,H=1086,c=canvas(W,H),x=c.getContext('2d');
 for(let row=0;row<3;row++)for(let col=0;col<4;col++){x.save();x.translate((col+.5)*W/4,(row+.5)*H/3);
  if(row===0){x.scale(1.25,1.25);projectile(x,col);}else if(row===1){x.translate(-40,0);x.scale(1.05,1.05);muzzle(x,col);}else{x.scale(1.05,1.05);impact(x,col);}x.restore();}
 return c;
}
function residue(){
 const S=1024,c=canvas(S,S),x=c.getContext('2d'),rand=seeded(404);x.translate(S/2,S/2);
 // scorched clay dust ring with cracked mortar and broken bricks around an empty center
 for(let i=0;i<220;i++){const a=rand()*TAU,d=230+rand()*170;x.globalAlpha=.25+rand()*.35;x.fillStyle=['#7a3d22','#a85a35','#5c2a16','#c98b5e'][i%4];x.beginPath();x.arc(Math.cos(a)*d,Math.sin(a)*d,6+rand()*22,0,TAU);x.fill();}
 x.globalAlpha=1;x.strokeStyle='#3a160b';x.lineWidth=5;
 for(let i=0;i<16;i++){const a=i*TAU/16+rand()*.2;x.beginPath();let r=250;x.moveTo(Math.cos(a)*r,Math.sin(a)*r);for(let k=0;k<4;k++){r+=30+rand()*25;const aa=a+(rand()-.5)*.25;x.lineTo(Math.cos(aa)*r,Math.sin(aa)*r);}x.stroke();}
 for(let i=0;i<20;i++){const a=rand()*TAU,d=270+rand()*150;brick(x,Math.cos(a)*d,Math.sin(a)*d,26+rand()*30,14+rand()*10,8,rand()*TAU,i%5===0?'cinder':'clay',{seed:500+i});}
 return c;
}
function stage(fn){const S=1254,c=canvas(S,S),x=c.getContext('2d');x.scale(S/512,S/512);fn(x);return c;}
window.paintAll=()=>({
 'weapon-brick-base.png':stage(sack).toDataURL(),
 'weapon-brick-evolved.png':stage(pot).toDataURL(),
 'weapon-brick-awakened.png':stage(c=>crate(c)).toDataURL(),
 'weapon-brick.png':stage(relic).toDataURL(),
 'vfx/brick-effects.png':atlas().toDataURL(),
 'vfx/brick-residue.png':residue().toDataURL(),
});
