/** Aim around the fighter, DDTank style: the green weapon-range band and the needle
 * pivot on the body centre and sit behind the avatar ('back'); the angle plate is
 * drawn over it ('front'). No rim, ticks or numbers (user request, 17/10/2026). */
export const AIM_PIVOT={x:4,y:-28,radius:66};
export function drawAimIndicator(c:CanvasRenderingContext2D,x:number,y:number,facing:1|-1,angle:number,slope:number,changedAge:number,minAngle=5,maxAngle=90,layer:'back'|'front'='back'){
 const cx=x+facing*AIM_PIVOT.x,cy=y+AIM_PIVOT.y,radius=AIM_PIVOT.radius,changed=changedAge>=0&&changedAge<1500,shown=Math.max(0,Math.min(90,angle));
 const point=(degree:number,r:number)=>({x:cx+facing*Math.cos(degree*Math.PI/180)*r,y:cy-Math.sin(degree*Math.PI/180)*r});
 const arc=(start:number,end:number,r:number,move=true)=>{const steps=Math.max(1,Math.ceil(Math.abs(end-start)/3));for(let i=0;i<=steps;i++){const p=point(start+(end-start)*i/steps,r);if(i===0&&move)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}};
 c.save();c.lineJoin='round';c.lineCap='round';
 if(layer==='back'){
 // Weapon range band only: no rim, ticks or numbers around the fighter.
 c.beginPath();arc(minAngle,maxAngle,radius-6);c.strokeStyle='#0b2a1aaa';c.lineWidth=9;c.stroke();
 c.beginPath();arc(minAngle,maxAngle,radius-6);c.strokeStyle='#4fe08a';c.lineWidth=5;c.shadowColor='#7dff9e';c.shadowBlur=6;c.stroke();c.shadowBlur=0;
 // Tapered needle from the hub to the rim.
 const tip=point(shown,radius-2),mid=point(shown,30),tail=point(shown,22),ux=(tip.x-mid.x)/(radius-32),uy=(tip.y-mid.y)/(radius-32);
 const needle=c.createLinearGradient(tail.x,tail.y,tip.x,tip.y);needle.addColorStop(0,'#ffe36b');needle.addColorStop(.6,'#ff8a1f');needle.addColorStop(1,changed?'#ff3b1f':'#e2261b');
 c.beginPath();c.moveTo(tip.x,tip.y);c.lineTo(mid.x-uy*5.5,mid.y+ux*5.5);c.lineTo(tail.x,tail.y);c.lineTo(mid.x+uy*5.5,mid.y-ux*5.5);c.closePath();
 c.shadowColor=changed?'#ffcf5a':'#ff9a3a';c.shadowBlur=changed?10:5;c.fillStyle=needle;c.fill();c.shadowBlur=0;c.strokeStyle='#5c1a0e';c.lineWidth=1.2;c.stroke();
 c.restore();return;}
 // Readout plate on the ground just past the band, on the facing side.
 const label=Math.round(angle)+'°',labelX=cx+facing*(radius+10),labelY=cy+16;
 c.font='900 17px "Nunito","Trebuchet MS",sans-serif';const w=c.measureText(label).width+14;
 c.beginPath();c.roundRect(labelX-w/2,labelY-11,w,22,8);c.fillStyle='#071629d9';c.fill();c.strokeStyle=changed?'#fff0a8':'#d8ab55';c.lineWidth=1.5;c.stroke();
 c.lineWidth=3;c.strokeStyle='#3a1a06';c.fillStyle=changed?'#fff7b0':'#ffe35e';c.strokeText(label,labelX,labelY+1);c.fillText(label,labelX,labelY+1);
 if(slope){const text=(slope>0?'+':'')+slope+'°';c.font='800 9px "Nunito","Trebuchet MS",sans-serif';c.lineWidth=3;c.strokeStyle='#0b1a2c';c.fillStyle='#bfe2f3';c.strokeText(text,labelX,labelY+20);c.fillText(text,labelX,labelY+20);}
 c.restore();
}
