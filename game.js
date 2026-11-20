(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
const overlay=document.getElementById('overlay'),overlayTitle=document.getElementById('overlay-title'),overlayCopy=document.getElementById('overlay-copy');
const roomEl=document.getElementById('room'),nameEl=document.getElementById('room-name'),energyEl=document.getElementById('energy'),missilesEl=document.getElementById('missiles'),equipmentEl=document.getElementById('equipment');
const names=['THE WRECK','BROKEN PASSAGE','SINKHOLE SHAFT','BASALT CROSSING','SURVEY CACHE','CRACKED RESERVOIR','BURIED TUNNELS','FORGOTTEN EXCAVATION','THE NEST','DEEP TRANSIT'];
const keys=new Map([['ArrowLeft',1],['KeyA',1],['ArrowRight',2],['KeyD',2],['ArrowUp',4],['KeyW',4],['ArrowDown',8],['KeyS',8],['Space',16],['KeyJ',32],['KeyK',64],['KeyX',128],['KeyC',256]]);
let held=0,wasd=0,paused=false,mapOpen=false,last=0,acc=0,wasm=null,roomId=0,stars=[],cameraX=0,visualTime=0,roomFlash=0,previousRoom=0;
let particles=[],shockRings=[],previousProjectiles=[],previousBombs=[],previousTiles=new Uint8Array(32*14),visualPrev={room:0,enemyCount:0,bossHp:0,energy:99,projectiles:0},shake=0,shakeX=0,shakeY=0,fxSeed=17;
let actorAtlas=null,actorAtlasReady=false,bossAtlas=null,bossAtlasReady=false;
if(typeof Image!=='undefined'){actorAtlas=new Image();actorAtlas.onload=()=>{actorAtlasReady=true};actorAtlas.src='assets/actor_atlas.png';bossAtlas=new Image();bossAtlas.onload=()=>{bossAtlasReady=true};bossAtlas.src='assets/burrower_atlas.png'}
for(let i=0;i<75;i++)stars.push({x:(i*71+13)%512,y:(i*37+11)%180,a:.12+(i%5)*.07});
const call=(n,...a)=>wasm.exports[n](...a),txt=p=>{let m=new Uint8Array(wasm.exports.memory.buffer),s='';for(;m[p];p++)s+=String.fromCharCode(m[p]);return s};
function toggleMap(){if(mapOpen){mapOpen=false;overlay.classList.remove('show')}else if(call('eod_map_unlocked')){mapOpen=true;paused=false;overlay.classList.remove('show')}else{overlayTitle.textContent='MAP DATA UNAVAILABLE';overlayCopy.textContent='Find the survey terminal in Basalt Crossing.';overlay.classList.add('show');paused=true}}
function keyDown(e){if(keys.has(e.code)){e.preventDefault();held|=keys.get(e.code)}if(e.code==='KeyM'&&!e.repeat)toggleMap();if(e.code==='Escape'&&!e.repeat){if(mapOpen){mapOpen=false;overlay.classList.remove('show')}else if(overlay.classList.contains('show')){paused=false;overlay.classList.remove('show')}else{paused=!paused;overlayTitle.textContent='PAUSED';overlayCopy.textContent='The basin is quiet. Take a breath.';overlay.classList.toggle('show',paused)}}}
function keyUp(e){if(keys.has(e.code)){e.preventDefault();held&=~keys.get(e.code)}}
window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',()=>held=0);
document.querySelectorAll('#touch button').forEach(b=>{const bit=Number(b.dataset.bit);if(bit){b.addEventListener('pointerdown',e=>{e.preventDefault();held|=bit;b.classList.add('on')});for(const ev of ['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,e=>{held&=~bit;b.classList.remove('on')})}else b.addEventListener('click',()=>b.dataset.action==='map'?toggleMap():(paused=!paused,overlay.classList.toggle('show',paused))) });
const SAVE_KEY='eod-crash-basin-save-v1';
function persistSave(){
 try{
  const size=call('eod_save_size');
  const bytes=new Array(size);
  for(let i=0;i<size;i++)bytes[i]=call('eod_save_byte',i);
  localStorage.setItem(SAVE_KEY,JSON.stringify(bytes));
  return true;
 }catch(err){console.warn('Browser save unavailable:',err);return false}
}
function restoreSave(){
 try{
  const raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;
  const bytes=JSON.parse(raw),size=call('eod_save_size');
  if(!Array.isArray(bytes)||bytes.length!==size||bytes.some(v=>!Number.isInteger(v)||v<0||v>255))return false;
  for(let i=0;i<size;i++)call('eod_set_save_byte',i,bytes[i]);
  return !!call('eod_restore_browser_save');
 }catch(err){console.warn('Ignoring invalid browser save:',err);return false}
}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
function glow(x,y,r,c){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,c);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
function line(x,y,x2,y2,c){ctx.strokeStyle=c;ctx.beginPath();ctx.moveTo(x+.5,y+.5);ctx.lineTo(x2+.5,y2+.5);ctx.stroke()}
function rand(){fxSeed=(fxSeed*1664525+1013904223)>>>0;return fxSeed/4294967296}
function burst(x,y,count,color,power=1){for(let i=0;i<count;i++){const a=rand()*Math.PI*2,v=(.45+rand()*1.9)*power;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-0.35,life:12+Math.floor(rand()*15),max:27,size:1+Math.floor(rand()*2),color})}}
function readProjectiles(){const a=[];for(let i=0;i<call('eod_projectile_count');i++)a.push({x:call('eod_projectile',i,0),y:call('eod_projectile',i,1),type:call('eod_projectile',i,2)});return a}
function readBombs(){const a=[];for(let i=0;i<call('eod_bomb_count');i++)a.push({x:call('eod_bomb',i,0),y:call('eod_bomb',i,1),timer:call('eod_bomb',i,2)});return a}
function readTiles(){const a=new Uint8Array(32*14);for(let y=0;y<14;y++)for(let x=0;x<32;x++)a[y*32+x]=call('eod_tile',x,y);return a}
function updateVisualEvents(id,pX,pY){
 const ec=call('eod_enemy_count'),bh=call('eod_boss_active')?call('eod_boss_hp'):0,energy=call('eod_player_energy'),pc=call('eod_projectile_count');
 const nowProjectiles=readProjectiles(),nowBombs=readBombs();let nowTiles=previousTiles;const terrainMayHaveChanged=pc<previousProjectiles.length||nowBombs.length<previousBombs.length;if(visualPrev.room!==id||terrainMayHaveChanged)nowTiles=readTiles();
 if(visualPrev.room!==id){particles.length=0;shockRings.length=0;previousProjectiles=nowProjectiles;previousBombs=nowBombs;previousTiles=nowTiles;visualPrev={room:id,enemyCount:ec,bossHp:bh,energy,projectiles:pc};return}
 if(ec<visualPrev.enemyCount){burst(pX-cameraX+8,pY+10,15,'#d9a36b',1.35);shake=Math.max(shake,2.5)}
 if(bh&&visualPrev.bossHp&&bh<visualPrev.bossHp){burst(call('eod_boss_x')-cameraX,call('eod_boss_y'),10,'#ffe09a',1.2);shake=Math.max(shake,1.7)}
 if(energy<visualPrev.energy){burst(pX-cameraX+7,pY+11,11,'#f27a70',1.4);shake=Math.max(shake,5)}
 if(pc>visualPrev.projectiles){const facing=call('eod_player_facing');burst(pX-cameraX+(facing?19:-3),pY+11,4,'#a9f8ff',.7)}
 // A shot that vanishes while overlapping solid terrain creates a material-specific surface spark.
 for(const old of previousProjectiles){let matched=false;for(const q of nowProjectiles)if(Math.abs(q.x-old.x)<15&&Math.abs(q.y-old.y)<15){matched=true;break}if(!matched){let hit=0,hx=old.x,hy=old.y,best=1e9;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const tx=Math.floor(old.x/16)+ox,ty=Math.floor(old.y/16)+oy;if(tx<0||tx>=32||ty<0||ty>=14)continue;const tile=nowTiles[ty*32+tx],cx=tx*16+8,cy=ty*16+8,d=(cx-old.x)*(cx-old.x)+(cy-old.y)*(cy-old.y);if(tile&&d<best){best=d;hit=tile;hx=cx;hy=cy}}if(hit&&best<625){const color=hit===3?'#f0b16b':hit===4?'#69f0ec':hit===5?'#e6a0f4':'#b8d4d8';burst(hx-cameraX,hy,old.type===1?10:5,color,old.type===1?1.25:.7);shockRings.push({x:hx,y:hy,r:2,life:8,max:8,color});}}}
 // Bomb expiry is the detonation event; tile removals below add individual rubble fragments.
 for(const old of previousBombs){let matched=false;for(const q of nowBombs)if(Math.abs(q.x-old.x)<8&&Math.abs(q.y-old.y)<8){matched=true;break}if(!matched){const sx=old.x-cameraX;burst(sx,old.y,30,'#e9a45c',1.9);burst(sx,old.y,12,'#fff0b2',1.15);shockRings.push({x:old.x,y:old.y,r:4,life:20,max:20,color:'#f5bd70'});shake=Math.max(shake,4.5)}}
 if(terrainMayHaveChanged)for(let i=0;i<nowTiles.length;i++){const before=previousTiles[i],after=nowTiles[i];if(before!==after&&before!==0&&after===0){const tx=i%32,ty=Math.floor(i/32),x=tx*16+8-cameraX,y=ty*16+8;if(before===3){burst(x,y,13,'#c58a58',1.25);burst(x,y,5,'#f0d29a',.8);shockRings.push({x:tx*16+8,y:ty*16+8,r:3,life:12,max:12,color:'#d9a66c'});shake=Math.max(shake,1.5)}else{burst(x,y,10,before===4?'#69e7e6':'#d88ce9',1.1);shockRings.push({x:tx*16+8,y:ty*16+8,r:3,life:13,max:13,color:before===4?'#69e7e6':'#d88ce9'})}}}
 previousProjectiles=nowProjectiles;previousBombs=nowBombs;previousTiles=nowTiles;
 visualPrev={room:id,enemyCount:ec,bossHp:bh,energy,projectiles:pc};
}
function drawEnemySprite(x,y,t,frame){
 if(actorAtlasReady&&t>=0&&t<5){const f=Math.floor(visualTime*5+frame)%2;ctx.drawImage(actorAtlas,f*40,(t+1)*40,40,40,x-8,y-8,40,40);return}
 const bob=Math.sin(visualTime*5+frame*1.7),step=Math.floor(visualTime*9+frame)%2;
 if(t===0){ // plated cave scuttler
  rect(x+3,y+7+bob,18,8,'#a86c45');rect(x+6,y+3+bob,12,7,'#d18b54');rect(x+8,y+4+bob,8,2,'#efb477');
  rect(x+1,y+13+(step?1:0),5,2,'#76503b');rect(x+18,y+13+(step?0:1),5,2,'#76503b');rect(x+4,y+15,3,3,'#513c36');rect(x+18,y+15,3,3,'#513c36');rect(x+8,y+8,2,2,'#16232b');rect(x+15,y+8,2,2,'#16232b');
 }else if(t===1){ // cave mite
  rect(x+5,y+5+bob,13,9,'#709d62');rect(x+7,y+2+bob,9,5,'#a8ce7b');rect(x+1,y+1,6,5,'#b5d38b');rect(x+16,y+1,6,5,'#b5d38b');rect(x+3,y+13,4,3,'#47654c');rect(x+16,y+13,4,3,'#47654c');rect(x+9,y+7,2,2,'#152b25');rect(x+14,y+7,2,2,'#152b25');
 }else if(t===2){ // reservoir leech
  rect(x+2,y+7+bob,19,7,'#477f83');rect(x+5,y+3+bob,13,6,'#70b1a4');rect(x+7,y+4,9,2,'#b0d9ba');rect(x+3,y+14,4,3,'#355c62');rect(x+17,y+14,4,3,'#355c62');rect(x+9,y+8,2,2,'#142d36');rect(x+15,y+8,2,2,'#142d36');
 }else if(t===3){ // burrowling
  rect(x+2,y+8+bob,20,9,'#9b8056');rect(x+5,y+3+bob,13,8,'#c2a46b');rect(x+7,y+4,9,2,'#e0c68a');rect(x+4,y+15,4,3,'#4c392b');rect(x+17,y+15,4,3,'#4c392b');rect(x+8,y+8,2,2,'#30291f');rect(x+15,y+8,2,2,'#30291f');
 }else{ // armored shard crawler
  rect(x+1,y+8+bob,22,10,'#776c9e');rect(x+4,y+4+bob,16,8,'#a397c6');rect(x+6,y+1,12,5,'#d6c6e8');rect(x+5,y+10,14,3,'#514d76');rect(x+9,y+7,2,2,'#f1d9ff');rect(x+15,y+7,2,2,'#f1d9ff');rect(x+3,y+17,4,2,'#39354f');rect(x+17,y+17,4,2,'#39354f');
 }
}
function drawPlayerSprite(px,py,morph,moving,airborne,run,facing,aim){
 if(actorAtlasReady){
  const frame=morph?6+Math.floor(visualTime*8)%2:airborne?(call('eod_player_vy')<0?4:5):moving?1+(run%3):0;
  ctx.save();if(facing){ctx.drawImage(actorAtlas,frame*40,0,40,40,px-12,py-10,40,40)}else{ctx.translate(px+8,0);ctx.scale(-1,1);ctx.drawImage(actorAtlas,frame*40,0,40,40,-20,py-10,40,40)}ctx.restore();
  return;
 }
 if(morph){const roll=Math.floor(visualTime*10)%2;glow(px+8,py+9,10,'rgba(90,220,230,.16)');rect(px+1,py+4,15,11,'#c8e0df');rect(px+3,py+2,11,4,'#8fb8be');rect(px+5,py+7,7,5,'#365d6c');rect(px+4,py+13,9,2,'#6f9ca4');rect(px+(facing?13:0),py+8,3,4,'#efb66e');if(roll)rect(px+6,py+3,5,1,'#efffff');return}
 const stride=moving&&!airborne?[0,2,0,-2][run]:0,lean=airborne?(call('eod_player_vy')<0?-1:1):0;
 // backpack, torso, helmet, visor and articulated limbs
 rect(px+2,py+8+lean,3,9,'#547b87');rect(px+1,py+10+lean,3,6,'#82aeb5');
 rect(px+4,py+7+lean,8,10,'#b9d0cf');rect(px+5,py+8+lean,6,7,'#dbe9e5');rect(px+4,py+2+lean,9,6,'#9bbdc0');rect(px+5,py+1+lean,7,5,'#d4e6e3');rect(px+(facing?9:3),py+4+lean,5,3,'#18313d');rect(px+(facing?10:4),py+4+lean,3,1,'#8de1e2');
 const legA=airborne?2:stride,legB=airborne?-1:-stride;rect(px+4,py+16+lean,3,4+Math.max(0,legA),'#789ba2');rect(px+9,py+16+lean,3,4+Math.max(0,legB),'#91adb0');rect(px+3,py+19+lean+Math.max(0,legA),5,2,'#e0aa69');rect(px+9,py+19+lean+Math.max(0,legB),5,2,'#e0aa69');
 const armY=py+9+lean;rect(px+(facing?10:0),armY,3,6,'#d9e8e4');rect(px+(facing?12:0),armY+3,3,3,'#e7b36e');
 const aimDx=[4,3,0,-3,-4,-3,0,3][aim]||0,aimDy=[0,-3,-4,-3,0,3,4,3][aim]||0,gunX=px+8+aimDx,gunY=py+10+lean+aimDy;rect(gunX-2,gunY-1,5,3,'#b5d4d2');rect(gunX+(aimDx>=0?2:-3),gunY,4,2,'#e8f8f2');
}
function drawRoomAtmosphere(id,cam){
 // These are decorative layers only: they never participate in collision or gameplay.
 if(id===259){ // Sinkhole Shaft: narrow dusty light shafts and falling grit.
  ctx.save();ctx.globalAlpha=.18;
  for(let i=0;i<7;i++){const x=((i*47-cam*.12+512)%288)-16,w=2+(i%3);rect(x,0,w,176,'rgba(167,190,173,.22)');line(x+2,0,x-5,174,'rgba(184,204,185,.45)')}
  ctx.globalAlpha=.48;
  for(let i=0;i<22;i++){const x=(i*61+Math.floor(visualTime*(5+i%4))-cam*.1+512)%256,y=(i*43+Math.floor(visualTime*(8+i%3)))%218;rect(x,y,1,2,'#b9b39a')}
  ctx.restore();
 }else if(id===262){ // Cracked Reservoir: suspended water, caustics and bubbles.
  ctx.save();ctx.globalAlpha=.34;
  for(let band=0;band<4;band++){const y=66+band*39+Math.sin(visualTime*1.3+band)*2;for(let i=0;i<8;i++){const x=(i*39+Math.floor(visualTime*(5+band))+band*13)%270-7;line(x,y+Math.sin(i+visualTime*2)*2,x+12+(i%3)*4,y,'#5bc6c4')}}
  ctx.globalAlpha=.24;
  for(let i=0;i<10;i++){const x=(i*31+Math.sin(visualTime+i)*5-cam*.04+256)%256,y=190-((visualTime*(7+i%3)*5+i*23)%190);rect(x,y,1,2,'#9be8df');rect(x+2,y+3,1,1,'#65bdbb')}
  ctx.restore();
 }else if(id===265){ // The Nest: organic veins and drifting bioluminescent spores.
  ctx.save();ctx.globalAlpha=.34;
  for(let i=0;i<8;i++){const x=(i*37-cam*.16+512)%280-12,y=24+(i*29)%150;line(x,y,x+((i%2)?9:-7),y+24,'#9a557e');line(x+((i%2)?9:-7),y+24,x+((i%2)?5:-11),y+42,'#75456f')}
  ctx.globalAlpha=.62;
  for(let i=0;i<15;i++){const x=(i*53+Math.sin(visualTime*.8+i)*8-cam*.06+512)%256,y=(i*31-Math.floor(visualTime*(3+i%3))+240)%190;const pulse=.5+.5*Math.sin(visualTime*2+i);rect(x,y,2,2,`rgba(241,142,207,${.28+pulse*.42})`);if(i%3===0)glow(x,y,7,'rgba(185,91,166,.12)')}
  ctx.restore();
 }
}
function renderMap(){rect(0,0,256,224,'#07131d');ctx.font='7px monospace';ctx.fillStyle='#80a8b6';ctx.fillText('VEYRA-9 / CRASH BASIN',12,17);const pts=[];for(let id=257;id<=266;id++){let gx=call('eod_map_cell',id,0),gy=call('eod_map_cell',id,1),v=call('eod_map_cell',id,3);pts.push({id,x:50+gx*38,y:42+gy*34,v})}ctx.strokeStyle='#2a5362';ctx.lineWidth=2;for(const p of pts){let exits=call('eod_map_cell',p.id,2);for(let d=0;d<4;d++)if(exits&(1<<d)){let nx=p.x+(d===1?38:d===0?-38:0),ny=p.y+(d===3?34:d===2?-34:0);line(p.x,p.y,nx,ny,'#2a5362')}}for(const p of pts){rect(p.x-7,p.y-6,14,12,p.v?'#2e8490':'#172a35');ctx.strokeStyle=p.id===roomId?'#ffb65c':'#5a8290';ctx.strokeRect(p.x-7.5,p.y-6.5,15,13);ctx.fillStyle=p.v?'#e6f8fa':'#78919b';ctx.textAlign='center';ctx.fillText(String(p.id-256).padStart(2,'0'),p.x,p.y+2)}ctx.textAlign='left';ctx.fillStyle='#8daab5';ctx.fillText('DISCOVERED SECTORS',12,195);ctx.fillStyle='#ffb65c';ctx.fillText('CURRENT POSITION',12,208);ctx.fillStyle='#8daab5';ctx.fillText(call('eod_map_completion')+'% MAPPED',190,208)}
function render(){if(!wasm)return;const id=call('eod_room_id'),pX=call('eod_player_x'),pY=call('eod_player_y');const targetCam=Math.max(0,Math.min(256,pX-128));if(previousRoom!==id){cameraX=targetCam;roomFlash=12;previousRoom=id}else cameraX+=(targetCam-cameraX)*.16;const cam=cameraX;roomId=id;visualTime+=1/60;updateVisualEvents(id,pX,pY);if(shake>0){shakeX=(rand()-.5)*shake;shakeY=(rand()-.5)*shake;shake*=.78;if(shake<.2)shake=0}else{shakeX=shakeY=0}if(roomFlash>0)roomFlash--;if(mapOpen){renderMap();return}ctx.save();ctx.translate(shakeX,shakeY);rect(0,0,256,224,id===262?'#071b24':id===265?'#160f21':id===259?'#101923':'#081722');for(const s of stars){let x=(s.x-cam*.18+512)%512;if(x<256)rect(x,s.y,1,1,`rgba(128,190,205,${s.a})`)}
// distant mineral silhouettes and drifting bioluminescent motes
for(let i=0;i<9;i++){let x=((i*67-cam*.32+1024)%320)-32;let h=18+(i*19%34);rect(x,150-h,3,h,'#102c38');rect(x+4,158-h,2,h-8,'#143541')}for(let i=0;i<18;i++){let x=(i*53+Math.floor(visualTime*5+i*7)-cam*.08+512)%256,y=(i*29+Math.floor(visualTime*3+i*11))%190;rect(x,y,1,1,`rgba(91,205,207,${.12+(i%4)*.06})`)}
// cavern backdrop
for(let x=0;x<256;x+=32){let wx=x+cam;let h=16+((Math.floor(wx/32)*13+id*7)%25);rect(x,0,32,h,id===262?'#10313a':id===265?'#28182d':id===259?'#202b31':'#0d2632');rect(x,0,32,2,id===262?'#28606a':id===265?'#633b61':id===259?'#48534d':'#183b49')}
drawRoomAtmosphere(id,cam);
// tiles
for(let ty=0;ty<14;ty++)for(let tx=0;tx<32;tx++){let t=call('eod_tile',tx,ty);if(!t)continue;let x=tx*16-cam,y=ty*16;if(x<-16||x>256)continue;let c=t===2?'#557d86':t===3?'#8a5735':t===4?'#3e9ca8':t===5?'#a45b9a':'#314b57';rect(x,y,16,16,c);rect(x,y,16,2,t===2?'#9bcbd0':t===3?'#d28a51':'#547482');rect(x+1,y+4,14,1,'#203844');if(t===1||t===2){let seed=(tx*17+ty*31+id*7)%11;if(seed<4){rect(x+3+seed,y+7,2,1,'#6b8990');rect(x+11-seed,y+11,2,1,'#243c47')}if(seed===2){line(x+4,y+12,x+8,y+9,'#405d68');line(x+8,y+9,x+11,y+12,'#405d68')}}if(t===3){rect(x+2,y+3,12,11,'#70442f');rect(x+4,y+4,8,2,'#c17b49');rect(x+5,y+7,6,5,'#5e3929');rect(x+10,y+11,4,3,'#4c3028');rect(x+2,y+14,12,1,'#d0925c')}if(t===4||t===5){const pulse=.5+.5*Math.sin(visualTime*5+tx+ty);rect(x+3,y+2,10,12,'#101f2a');rect(x+5,y+3,6,10,t===4?'#176d75':'#713d7b');rect(x+7,y+4,2,8,t===4?'#5de6ef':'#f18ee2');rect(x+2,y+1,12,1,t===4?`rgba(100,245,240,${.35+pulse*.45})`:`rgba(245,150,250,${.3+pulse*.4})`)}}
// door frames
for(let d=0;d<4;d++){let dx=call('eod_door',d,0),dy=call('eod_door',d,1),dw=call('eod_door',d,2),dh=call('eod_door',d,3),dest=call('eod_door',d,4);if(!dest)continue;let x=dx-cam;rect(x,dy,dw,dh,'#112b39');if(d<2){rect(x,dy,3,dh,'#4d7d8d');rect(x+dw-3,dy,3,dh,'#4d7d8d')}else{rect(x,dy,dw,3,'#4d7d8d')}}
// pickups
for(let i=0;i<call('eod_pickup_count');i++){let x=call('eod_pickup',i,0)-cam,y=call('eod_pickup',i,1),t=call('eod_pickup',i,2);rect(x+3,y+4,18,16,t===1?'#f2a54c':t===3?'#d4c66b':'#60d8d2');rect(x+7,y,10,4,'#e6fbf9');rect(x+8,y+8,8,8,'#19333e')}
// checkpoint beacons
for(let i=0;i<4;i++)if(call('eod_checkpoint',i,0)===id){let x=call('eod_checkpoint',i,1)-cam,y=call('eod_checkpoint',i,2);rect(x+13,y+4,6,30,'#3c9aa5');rect(x+9,y,14,8,'#9cebf0');rect(x+12,y+9,8,2,'#d8fcff')}
// Enemy sprites use distinct silhouettes and a two-beat locomotion cycle.
for(let i=0;i<call('eod_enemy_count');i++){let x=call('eod_enemy',i,0)-cam,y=call('eod_enemy',i,1),t=call('eod_enemy',i,2);drawEnemySprite(x,y,t,i)}
for(let i=0;i<call('eod_enemy_shot_count');i++){let x=call('eod_enemy_shot',i,0)-cam,y=call('eod_enemy_shot',i,1);rect(x,y,4,4,'#f29b54')}
// Burrower: distinct warning, attack, and exposed-recovery tells.
if(call('eod_boss_active')){
 const bx=call('eod_boss_x'),x=bx-cam,y=call('eod_boss_y'),state=call('eod_boss_state'),attack=call('eod_boss_attack'),phase=call('eod_boss_phase'),weak=call('eod_boss_vulnerable');
 const body=weak?'#d8a85d':state===3?'#b9784f':state===4?'#a74753':'#704d68';
 if(state===3){
  const tx=call('eod_boss_target_x')-cam;
  rect(Math.max(0,tx-18),190,36,3,'#f2b35e');rect(Math.max(0,tx-2),184,4,10,'#f5d18a');
  ctx.font='7px monospace';ctx.fillStyle='#f0c27d';
  ctx.fillText(['','GROUND BREACH','WALL CHARGE','ROCK SPRAY','TUNNEL COLLAPSE'][attack]||'WARNING',8,38);
  if(attack===2){rect(4,42,3,142,'#bd7753');rect(249,42,3,142,'#bd7753');rect(x-28,y-30,56,2,'#e4a06c')}
  if(attack===3){for(let k=-1;k<=1;k++){rect(x+k*10-3,y-35,6,6,'#e6a66c');rect(x+k*10-1,y-29,2,5,'#f2d18c')}}
  if(attack===4){for(let k=-1;k<=1;k++){let hx=Math.max(2,Math.min(250,tx+k*16));rect(hx-4,29,8,3,'#e6a66c');rect(hx-1,32,2,8,'#f2d18c')}}
 } else if(state===5){rect(0,0,256,2,'#d6aa62')}
 if(bossAtlasReady){const bf=Math.floor(visualTime*5)%3;ctx.drawImage(bossAtlas,bf*96,0,96,64,x-36,y-30,72,48);if(weak)glow(x,y,30,'rgba(255,210,120,.22)')}
 else{rect(x-22,y-17,44,32,body);rect(x-16,y-25,32,13,'#b57970');rect(x-12,y-8,9,5,weak?'#fff0a0':'#ffca7d');rect(x+5,y-8,9,5,weak?'#fff0a0':'#ffca7d');rect(x-25,y+11,50,5,'#392d3d');rect(x-20,y+12,40,2,'#c08b65')}
 rect(10,25,236,4,'#233946');rect(10,25,236*call('eod_boss_hp')/Math.max(1,call('eod_boss_max_hp')),4,'#b85b6e');
 ctx.font='7px monospace';ctx.fillStyle='#c6e4e9';ctx.fillText('BURROWER  PHASE '+phase,10,19);
 if(weak){ctx.fillStyle='#f4d58c';ctx.fillText('EXPOSED',190,19)}
}
// projectiles
for(let i=0;i<call('eod_projectile_count');i++){let x=call('eod_projectile',i,0)-cam,y=call('eod_projectile',i,1),t=call('eod_projectile',i,2);rect(x,y,t===1?7:5,t===1?5:3,t===1?'#ffb15b':'#b9f8ff')}
for(let i=0;i<call('eod_bomb_count');i++){let x=call('eod_bomb',i,0)-cam,y=call('eod_bomb',i,1),timer=call('eod_bomb',i,2),pulse=timer<12&&Math.floor(visualTime*18)%2===0;glow(x+3,y+3,9,pulse?'rgba(255,150,75,.34)':'rgba(235,165,80,.16)');rect(x,y,7,7,pulse?'#fff0bd':'#f3b65c');rect(x+2,y+2,3,3,'#fff0c7');rect(x+3,y-2,1,2,'#f6a65d')}
// Player animation is state-driven: stride, jump/fall lean, aim and Morph Ball roll.
let morph=call('eod_player_morph'),vx=call('eod_player_vx'),vy=call('eod_player_vy'),facing=call('eod_player_facing'),moving=Math.abs(vx)>0,airborne=Math.abs(vy)>1,run=Math.floor(visualTime*12)%4,blink=call('eod_player_invuln')>0&&Math.floor(performance.now()/70)%2===0,px=pX-cam,aim=call('eod_player_aim');
if(!morph){rect(px+1,pY+22,13,2,'rgba(0,0,0,.42)');glow(px+7+(facing?5:-5),pY+10,16,'rgba(73,204,218,.12)')}
if(!blink)drawPlayerSprite(px,pY,morph,moving,airborne,run,facing,aim);
// Environmental shock rings expand from bomb blasts, door breaks and hard impacts.
for(let i=shockRings.length-1;i>=0;i--){const q=shockRings[i];q.r+=q.life>14?2.1:1.15;q.life--;if(q.life<=0){shockRings.splice(i,1);continue}ctx.globalAlpha=Math.min(.72,q.life/q.max);ctx.strokeStyle=q.color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(q.x-cam,q.y,q.r,0,Math.PI*2);ctx.stroke()}
// Weapon impacts, terrain debris, enemy defeats and damage produce short-lived particles.
for(let i=particles.length-1;i>=0;i--){const q=particles[i];q.x+=q.vx;q.y+=q.vy;q.vy+=.055;q.vx*=.97;q.life--;if(q.life<=0){particles.splice(i,1);continue}ctx.globalAlpha=Math.min(1,q.life/8);rect(q.x,q.y,q.size,q.size,q.color);if(q.life>8&&q.size>1)glow(q.x,q.y,4,'rgba(110,220,235,.12)')}
ctx.globalAlpha=1;
// Subtle edge falloff and room-entry pulse frame the action without obscuring play.
ctx.fillStyle='rgba(0,8,14,.18)';ctx.fillRect(0,0,256,3);ctx.fillRect(0,221,256,3);if(roomFlash>0){ctx.fillStyle=`rgba(120,220,230,${roomFlash/90})`;ctx.fillRect(0,0,256,224)}
// HUD
rect(5,5,88,15,'#071018cc');ctx.font='7px monospace';ctx.fillStyle='#c6e4e9';ctx.fillText('ENERGY',9,15);rect(43,9,44,5,'#31434c');rect(43,9,44*call('eod_player_energy')/99,5,'#df756f');ctx.fillStyle='#c6e4e9';ctx.fillText('VEYRA-9',193,14);ctx.fillStyle='#7ea5b1';ctx.fillText('SECTOR '+String(id-256).padStart(2,'0'),193,23);
roomEl.textContent='01-'+String(id-256).padStart(2,'0');nameEl.textContent=names[id-257]||'UNKNOWN';energyEl.textContent=call('eod_player_energy');missilesEl.textContent=call('eod_player_missiles')+'/'+call('eod_player_missile_capacity');equipmentEl.textContent='BEAM ONLINE'+(call('eod_has_missiles')?' · MISSILES':'')+(call('eod_has_bombs')?' · BOMBS':'')+(call('eod_player_morph')?' · MORPH':'');
ctx.restore();
}
async function start(){const response=await fetch('eod.wasm');const bytes=await response.arrayBuffer();const {instance}=await WebAssembly.instantiate(bytes,{});wasm=instance;if(!call('eod_init'))throw Error('Crash Basin initialization failed');const restored=restoreSave();if(restored){overlayTitle.textContent='SAVE DATA RESTORED';overlayCopy.textContent='Checkpoint and Crash Basin progress recovered.';overlay.classList.add('show');paused=true;}function frame(t){if(!last)last=t;let dt=Math.min(100,t-last);last=t;if(!paused&&!mapOpen){acc+=dt;const step=1000/60;let loops=0;while(acc>=step&&loops++<5){call('eod_update',held);if(call('eod_checkpoint_save_pending')){if(call('eod_commit_browser_save'))persistSave();}acc-=step} }render();requestAnimationFrame(frame)}requestAnimationFrame(frame)}
start().catch(e=>{overlay.classList.add('show');overlayTitle.textContent='FIELD SYSTEM OFFLINE';overlayCopy.textContent=e.message;console.error(e)});
})();
