/** Quarter-circle protractor beside the fighter. The needle stays inside the
 * rim (no long aim arrow); the green band is the weapon range on this ground. */
export function drawAimIndicator(c:CanvasRenderingContext2D,x:number,y:number,facing:1|-1,angle:number,slope:number,changedAge:number,minAngle=5,maxAngle=90){
 const cx=x+facing*40,cy=y-30,radius=74,inner=50,changed=changedAge>=0&&changedAge<1500,shown=Math.max(0,Math.min(90,angle));
 const point=(degree:number,r:number)=>({x:cx+facing*Math.cos(degree*Math.PI/180)*r,y:cy-Math.sin(degree*Math.PI/180)*r});
 const arc=(start:number,end:number,r:number,move=true)=>{const steps=Math.max(1,Math.ceil(Math.abs(end-start)/3));for(let i=0;i<=steps;i++){const p=point(start+(end-start)*i/steps,r);if(i===0&&move)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}};
 c.save();c.lineJoin='round';c.lineCap='round';
 // Glass quadrant with a warm metal rim.
 const glass=c.createRadialGradient(cx,cy,inner*.4,cx,cy,radius);glass.addColorStop(0,'#0b1d3400');glass.addColorStop(.55,'#0e2a4a8c');glass.addColorStop(1,'#12355cc4');
 c.beginPath();c.moveTo(cx,cy);arc(0,90,radius,false);c.closePath();c.fillStyle=glass;c.fill();
 c.beginPath();arc(0,90,radius);c.strokeStyle='#5a3b16';c.lineWidth=4;c.stroke();c.strokeStyle='#f3c968';c.lineWidth=2;c.stroke();
 c.beginPath();c.moveTo(point(0,radius).x,point(0,radius).y);c.lineTo(cx,cy);c.lineTo(point(90,radius).x,point(90,radius).y);c.strokeStyle='#f3c96877';c.lineWidth=1;c.stroke();
 // Weapon range band, blocked arcs dimmed red.
 c.beginPath();arc(0,90,radius-6);c.strokeStyle='#9c2a3366';c.lineWidth=6;c.lineCap='butt';c.stroke();
 c.beginPath();arc(minAngle,maxAngle,radius-6);c.strokeStyle='#4fe08a';c.shadowColor='#7dff9e';c.shadowBlur=6;c.stroke();c.shadowBlur=0;c.lineCap='round';
 for(let degree=0;degree<=90;degree+=5){
  const major=degree%15===0,p=point(degree,radius-10),q=point(degree,radius-(major?20:15));c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.strokeStyle=degree>=minAngle&&degree<=maxAngle?'#fff2c8':'#a6b3bd88';c.lineWidth=major?1.8:.9;c.stroke();
 }
 c.textAlign='center';c.textBaseline='middle';c.font='800 8px "Nunito","Trebuchet MS",sans-serif';c.lineWidth=2.5;c.strokeStyle='#0b1a2c';c.fillStyle='#d9e8f2';
 for(const degree of [30,60,90]){const p=point(degree,inner-8);c.strokeText(String(degree),p.x,p.y);c.fillText(String(degree),p.x,p.y);}
 // Tapered needle from the hub to the rim.
 const tip=point(shown,radius-4),base=point(shown,10),side=(d:number)=>point(shown+d,6);
 const needle=c.createLinearGradient(cx,cy,tip.x,tip.y);needle.addColorStop(0,'#ffe36b');needle.addColorStop(.6,'#ff8a1f');needle.addColorStop(1,changed?'#ff3b1f':'#e2261b');
 c.beginPath();c.moveTo(tip.x,tip.y);const l=side(90),r=side(-90);c.lineTo(l.x,l.y);c.lineTo(base.x+(cx-base.x)*1.6,base.y+(cy-base.y)*1.6);c.lineTo(r.x,r.y);c.closePath();
 c.shadowColor=changed?'#ffcf5a':'#ff9a3a';c.shadowBlur=changed?10:5;c.fillStyle=needle;c.fill();c.shadowBlur=0;c.strokeStyle='#5c1a0e';c.lineWidth=1.2;c.stroke();
 c.beginPath();c.arc(cx,cy,5,0,Math.PI*2);c.fillStyle='#ffe08a';c.fill();c.strokeStyle='#7a4b17';c.lineWidth=1.5;c.stroke();
 // Readout plate below the pivot, on the facing side.
 const label=Math.round(angle)+'°',labelX=cx+facing*50,labelY=cy+15;
 c.font='900 17px "Nunito","Trebuchet MS",sans-serif';const w=c.measureText(label).width+14;
 c.beginPath();c.roundRect(labelX-w/2,labelY-11,w,22,8);c.fillStyle='#071629d9';c.fill();c.strokeStyle=changed?'#fff0a8':'#d8ab55';c.lineWidth=1.5;c.stroke();
 c.lineWidth=3;c.strokeStyle='#3a1a06';c.fillStyle=changed?'#fff7b0':'#ffe35e';c.strokeText(label,labelX,labelY+1);c.fillText(label,labelX,labelY+1);
 if(slope){const text=(slope>0?'+':'')+slope+'°';c.font='800 9px "Nunito","Trebuchet MS",sans-serif';c.lineWidth=3;c.strokeStyle='#0b1a2c';c.fillStyle='#bfe2f3';c.strokeText(text,labelX,labelY+20);c.fillText(text,labelX,labelY+20);}
 c.restore();
}
