/** Quarter-circle protractor. The small rim marker replaces long aim arrows. */
export function drawAimIndicator(c:CanvasRenderingContext2D,x:number,y:number,facing:1|-1,angle:number,slope:number,changedAge:number,minAngle=5,maxAngle=90){
 const cx=x+facing*32,cy=y-30,radius=73,inner=56,changed=changedAge>=0&&changedAge<1500;
 const point=(degree:number,r:number)=>({x:cx+facing*Math.cos(degree*Math.PI/180)*r,y:cy-Math.sin(degree*Math.PI/180)*r});
 const arc=(start:number,end:number,r:number)=>{const steps=Math.ceil(Math.abs(end-start)/3);for(let i=0;i<=steps;i++){const p=point(start+(end-start)*i/Math.max(1,steps),r);if(i===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}};
 c.save();c.lineJoin='round';c.lineCap='round';
 c.beginPath();arc(0,90,radius);const end=point(90,inner);c.lineTo(end.x,end.y);for(let degree=90;degree>=0;degree-=3){const p=point(degree,inner);c.lineTo(p.x,p.y);}c.closePath();c.fillStyle='#172334b5';c.fill();c.strokeStyle='#d8c297b5';c.lineWidth=1;c.stroke();
 c.beginPath();arc(minAngle,maxAngle,inner+2);c.strokeStyle='#f4d798b5';c.lineWidth=2;c.stroke();
 for(let degree=0;degree<=90;degree+=5){
  const major=degree%15===0,p=point(degree,radius-2),q=point(degree,radius-(major?10:6));c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.strokeStyle=degree>=minAngle&&degree<=maxAngle?'#f8e9ca':'#9cabb177';c.lineWidth=major?1.4:.8;c.stroke();
 }
 c.textAlign='center';c.textBaseline='middle';c.font='700 8px "Trebuchet MS",sans-serif';c.lineWidth=2;c.strokeStyle='#101f32';c.fillStyle='#f3e4c6';
 for(const degree of [0,30,60,90]){const p=point(degree,47);c.strokeText(String(degree),p.x,p.y);c.fillText(String(degree),p.x,p.y);}
 const marker=point(Math.max(0,Math.min(90,angle)),radius-3);c.save();c.translate(marker.x,marker.y);c.rotate(-facing*angle*Math.PI/180);c.fillStyle=changed?'#fff6c1':'#ffcf69';c.strokeStyle='#76532a';c.lineWidth=1.3;c.beginPath();c.moveTo(0,-5);c.lineTo(4,0);c.lineTo(0,5);c.lineTo(-4,0);c.closePath();c.fill();c.stroke();c.restore();
 const labelX=cx+facing*39,labelY=cy+16;
 c.font='900 17px "Trebuchet MS",sans-serif';c.lineWidth=4;c.strokeStyle='#132135';c.fillStyle=changed?'#fff3b1':'#ffe4a1';c.strokeText(Math.round(angle)+'°',labelX,labelY);c.fillText(Math.round(angle)+'°',labelX,labelY);
 if(slope){const label=(slope>0?'+':'')+slope+'°';c.font='700 9px "Trebuchet MS",sans-serif';c.lineWidth=3;c.fillStyle='#e4d6b8';c.strokeText(label,labelX,labelY+16);c.fillText(label,labelX,labelY+16);}
 c.restore();
}
