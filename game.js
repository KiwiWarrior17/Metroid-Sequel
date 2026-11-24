(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
const overlay=document.getElementById('overlay'),overlayTitle=document.getElementById('overlay-title'),overlayCopy=document.getElementById('overlay-copy');
const roomEl=document.getElementById('room'),nameEl=document.getElementById('room-name'),energyEl=document.getElementById('energy'),missilesEl=document.getElementById('missiles'),equipmentEl=document.getElementById('equipment');
const names=['THE WRECK','BROKEN PASSAGE','SINKHOLE SHAFT','BASALT CROSSING','SURVEY CACHE','CRACKED RESERVOIR','BURIED TUNNELS','FORGOTTEN EXCAVATION','THE NEST','DEEP TRANSIT','FOUNDRY APPROACH','SMELTING GALLERIES','THE COOLING WORKS','CORE CHAMBER','GLASSROOT THRESHOLD','LUMEN CANOPY','ROOTBOUND GROTTO','PRISM RESERVOIR','SILTED GATE','PRESSURE GALLERY','DROWNED INDEX','SILT CATHEDRAL'];
const keys=new Map([['ArrowLeft',1],['KeyA',1],['ArrowRight',2],['KeyD',2],['ArrowUp',4],['KeyW',4],['ArrowDown',8],['KeyS',8],['Space',16],['KeyJ',32],['KeyK',64],['KeyX',128],['KeyC',256],['KeyL',512]]);
let held=0,wasd=0,paused=false,mapOpen=false,last=0,acc=0,wasm=null,roomId=0,stars=[],cameraX=0,visualTime=0,roomFlash=0,previousRoom=0;
let particles=[],shockRings=[],previousProjectiles=[],previousBombs=[],previousTiles=new Uint8Array(32*14),visualPrev={room:0,enemyCount:0,bossHp:0,guardianHp:0,energy:99,projectiles:0},shake=0,shakeX=0,shakeY=0,fxSeed=17;
let actorAtlas=null,actorAtlasReady=false,bossAtlas=null,bossAtlasReady=false;
let audioPrimed=false,audioEnabled=true,audioPrev=null;
if(typeof Image!=='undefined'){actorAtlas=new Image();actorAtlas.onload=()=>{actorAtlasReady=true};actorAtlas.src='assets/actor_atlas.png';bossAtlas=new Image();bossAtlas.onload=()=>{bossAtlasReady=true};bossAtlas.src='assets/burrower_atlas.png'}
for(let i=0;i<75;i++)stars.push({x:(i*71+13)%512,y:(i*37+11)%180,a:.12+(i%5)*.07});
const call=(n,...a)=>wasm.exports[n](...a),txt=p=>{let m=new Uint8Array(wasm.exports.memory.buffer),s='';for(;m[p];p++)s+=String.fromCharCode(m[p]);return s};
function unlockAudio(){if(audioPrimed)return;audioPrimed=true;if(window.EODAudio)window.EODAudio.unlock();}
function audioPlay(name){if(window.EODAudio)window.EODAudio.play(name)}
function roomAudioName(id){return id>=769?'archive':id>=513?'glassroot':id===262?'reservoir':id===259?'shaft':id===265?'nest':id>=267?'foundry':'wreck'}
function toggleSound(){audioEnabled=!audioEnabled;if(window.EODAudio)window.EODAudio.setEnabled(audioEnabled);const b=document.getElementById('sound-toggle');if(b)b.textContent=audioEnabled?'SOUND ON':'SOUND OFF'}
function captureAudioState(){
 const enemyCount=call('eod_enemy_count'),enemyHp=[];let hpTotal=0;
 for(let i=0;i<enemyCount;i++){const hp=call('eod_enemy',i,3);enemyHp.push(hp);hpTotal+=hp;}
 let beam=0,missile=0;for(let i=0;i<call('eod_projectile_count');i++){if(call('eod_projectile',i,2)===1)missile++;else beam++;}
 return {room:call('eod_room_id'),energy:call('eod_player_energy'),enemyCount,enemyHp,hpTotal,beam,missile,bombs:call('eod_bomb_count'),pickups:call('eod_pickup_count'),bossState:call('eod_boss_state'),bossAttack:call('eod_boss_attack'),bossHp:call('eod_boss_hp'),guardianState:call('eod_guardian_state'),guardianHp:call('eod_guardian_hp'),prismState:call('eod_prism_state'),prismHp:call('eod_prism_hp'),wardenState:call('eod_warden_state'),wardenHp:call('eod_warden_hp')};
}
function updateAudioEvents(savePending){
 const now=captureAudioState();
 if(!audioPrev){audioPrev=now;return;}
 if(now.room!==audioPrev.room){audioPlay('door');if(window.EODAudio)window.EODAudio.setRoom(roomAudioName(now.room));}
 if(now.beam+now.missile>audioPrev.beam+audioPrev.missile){if(now.missile>audioPrev.missile)audioPlay('missile');else audioPlay('beam');}
 if(now.bombs>audioPrev.bombs){} // Bomb sound is reserved for the detonation, not placement.
 if(now.bombs<audioPrev.bombs)audioPlay('bomb');
 if(now.enemyCount<audioPrev.enemyCount)audioPlay('enemyDefeat');
 else if(now.hpTotal<audioPrev.hpTotal)audioPlay('enemyHit');
 if(now.bossHp<audioPrev.bossHp&&now.bossHp>0)audioPlay('enemyHit');
 if(now.guardianHp<audioPrev.guardianHp&&now.guardianHp>0)audioPlay('enemyHit');
 if(now.energy<audioPrev.energy)audioPlay('playerDamage');
 if(now.pickups<audioPrev.pickups)audioPlay('pickup');
 if(now.bossState===3&&audioPrev.bossState!==3)audioPlay('bossTelegraph');
 if(now.bossState===4&&audioPrev.bossState===3)audioPlay('bossImpact');
 if(now.bossState===6&&audioPrev.bossState!==6)audioPlay('pickup');
 if(now.guardianState===3&&audioPrev.guardianState!==3)audioPlay('bossTelegraph');
 if(now.guardianState===4&&audioPrev.guardianState===3)audioPlay('bossImpact');
 if(now.guardianState===6&&audioPrev.guardianState!==6)audioPlay('pickup');
 if(now.prismHp<audioPrev.prismHp&&now.prismHp>0)audioPlay('enemyHit');
 if(now.wardenHp<audioPrev.wardenHp&&now.wardenHp>0)audioPlay('enemyHit');
 if(now.prismState===3&&audioPrev.prismState!==3)audioPlay('bossTelegraph');
 if(now.prismState===4&&audioPrev.prismState===3)audioPlay('bossImpact');
 if(now.prismState===6&&audioPrev.prismState!==6)audioPlay('pickup');
 if(now.wardenState===3&&audioPrev.wardenState!==3)audioPlay('bossTelegraph');
 if(now.wardenState===4&&audioPrev.wardenState===3)audioPlay('bossImpact');
 if(now.wardenState===6&&audioPrev.wardenState!==6)audioPlay('pickup');
 if(window.EODAudio)window.EODAudio.setMusicMode((now.bossState>=1&&now.bossState<=5)||(now.guardianState>=1&&now.guardianState<=5)||(now.prismState>=1&&now.prismState<=5)||(now.wardenState>=1&&now.wardenState<=5)?'boss':'explore');
 if(savePending)audioPlay('save');
 audioPrev=now;
}
function toggleMap(){if(mapOpen){mapOpen=false;overlay.classList.remove('show')}else if(call('eod_map_unlocked')){mapOpen=true;paused=false;overlay.classList.remove('show')}else{overlayTitle.textContent='MAP DATA UNAVAILABLE';overlayCopy.textContent='Find the survey terminal in Basalt Crossing.';overlay.classList.add('show');paused=true}}
function keyDown(e){if(!e.repeat)unlockAudio();if(e.code==='KeyV'&&!e.repeat){toggleSound();return}if(keys.has(e.code)){e.preventDefault();held|=keys.get(e.code)}if(e.code==='KeyM'&&!e.repeat)toggleMap();if(e.code==='Escape'&&!e.repeat){if(mapOpen){mapOpen=false;overlay.classList.remove('show')}else if(overlay.classList.contains('show')){paused=false;overlay.classList.remove('show')}else{paused=!paused;overlayTitle.textContent='PAUSED';overlayCopy.textContent='The basin is quiet. Take a breath.';overlay.classList.toggle('show',paused)}}}
function keyUp(e){if(keys.has(e.code)){e.preventDefault();held&=~keys.get(e.code)}}
window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',()=>held=0);
document.querySelectorAll('#touch button').forEach(b=>{const bit=Number(b.dataset.bit);if(bit){b.addEventListener('pointerdown',e=>{e.preventDefault();unlockAudio();held|=bit;b.classList.add('on')});for(const ev of ['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,e=>{held&=~bit;b.classList.remove('on')})}else b.addEventListener('click',()=>{unlockAudio();if(b.dataset.action==='map')toggleMap();else if(b.dataset.action==='sound')toggleSound();else{paused=!paused;overlay.classList.toggle('show',paused)}}) });
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
  if(!Array.isArray(bytes)||(bytes.length!==size&&bytes.length!==1244)||bytes.some(v=>!Number.isInteger(v)||v<0||v>255))return false;
  for(let i=0;i<bytes.length;i++)call('eod_set_save_byte',i,bytes[i]);
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
 const ec=call('eod_enemy_count'),bh=call('eod_boss_active')?call('eod_boss_hp'):0,gh=call('eod_guardian_active')?call('eod_guardian_hp'):0,energy=call('eod_player_energy'),pc=call('eod_projectile_count');
 const nowProjectiles=readProjectiles(),nowBombs=readBombs();let nowTiles=previousTiles;const terrainMayHaveChanged=pc<previousProjectiles.length||nowBombs.length<previousBombs.length;if(visualPrev.room!==id||terrainMayHaveChanged)nowTiles=readTiles();
 if(visualPrev.room!==id){particles.length=0;shockRings.length=0;previousProjectiles=nowProjectiles;previousBombs=nowBombs;previousTiles=nowTiles;visualPrev={room:id,enemyCount:ec,bossHp:bh,guardianHp:gh,energy,projectiles:pc};return}
 if(ec<visualPrev.enemyCount){burst(pX-cameraX+8,pY+10,15,'#d9a36b',1.35);shake=Math.max(shake,2.5)}
 if(bh&&visualPrev.bossHp&&bh<visualPrev.bossHp){burst(call('eod_boss_x')-cameraX,call('eod_boss_y'),10,'#ffe09a',1.2);shake=Math.max(shake,1.7)}
 if(gh&&visualPrev.guardianHp&&gh<visualPrev.guardianHp){burst(call('eod_guardian_x')-cameraX,call('eod_guardian_y'),12,'#ffb36b',1.35);shake=Math.max(shake,2.1)}
 if(energy<visualPrev.energy){burst(pX-cameraX+7,pY+11,11,'#f27a70',1.4);shake=Math.max(shake,5)}
 if(pc>visualPrev.projectiles){const facing=call('eod_player_facing');burst(pX-cameraX+(facing?19:-3),pY+11,4,'#a9f8ff',.7)}
 // A shot that vanishes while overlapping solid terrain creates a material-specific surface spark.
 for(const old of previousProjectiles){let matched=false;for(const q of nowProjectiles)if(Math.abs(q.x-old.x)<15&&Math.abs(q.y-old.y)<15){matched=true;break}if(!matched){let hit=0,hx=old.x,hy=old.y,best=1e9;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const tx=Math.floor(old.x/16)+ox,ty=Math.floor(old.y/16)+oy;if(tx<0||tx>=32||ty<0||ty>=14)continue;const tile=nowTiles[ty*32+tx],cx=tx*16+8,cy=ty*16+8,d=(cx-old.x)*(cx-old.x)+(cy-old.y)*(cy-old.y);if(tile&&d<best){best=d;hit=tile;hx=cx;hy=cy}}if(hit&&best<625){const color=hit===3?'#f0b16b':hit===4?'#69f0ec':hit===5?'#e6a0f4':'#b8d4d8';burst(hx-cameraX,hy,old.type===1?10:5,color,old.type===1?1.25:.7);shockRings.push({x:hx,y:hy,r:2,life:8,max:8,color});}}}
 // Bomb expiry is the detonation event; tile removals below add individual rubble fragments.
 for(const old of previousBombs){let matched=false;for(const q of nowBombs)if(Math.abs(q.x-old.x)<8&&Math.abs(q.y-old.y)<8){matched=true;break}if(!matched){const sx=old.x-cameraX;burst(sx,old.y,30,'#e9a45c',1.9);burst(sx,old.y,12,'#fff0b2',1.15);shockRings.push({x:old.x,y:old.y,r:4,life:20,max:20,color:'#f5bd70'});shake=Math.max(shake,4.5)}}
 if(terrainMayHaveChanged)for(let i=0;i<nowTiles.length;i++){const before=previousTiles[i],after=nowTiles[i];if(before!==after&&before!==0&&after===0){const tx=i%32,ty=Math.floor(i/32),x=tx*16+8-cameraX,y=ty*16+8;if(before===3){burst(x,y,13,'#c58a58',1.25);burst(x,y,5,'#f0d29a',.8);shockRings.push({x:tx*16+8,y:ty*16+8,r:3,life:12,max:12,color:'#d9a66c'});shake=Math.max(shake,1.5)}else{burst(x,y,10,before===4?'#69e7e6':'#d88ce9',1.1);shockRings.push({x:tx*16+8,y:ty*16+8,r:3,life:13,max:13,color:before===4?'#69e7e6':'#d88ce9'})}}}
 previousProjectiles=nowProjectiles;previousBombs=nowBombs;previousTiles=nowTiles;
 visualPrev={room:id,enemyCount:ec,bossHp:bh,guardianHp:gh,energy,projectiles:pc};
}
function drawEnemySprite(x,y,t,frame,surface=0){
 if(t===4&&surface>0&&surface<4){
  const angle=surface===1?Math.PI:(surface===2?-Math.PI/2:Math.PI/2);
  ctx.save();ctx.translate(x+12,y+12);ctx.rotate(angle);ctx.translate(-x-12,-y-12);
  drawEnemySprite(x,y,t,frame,0);ctx.restore();return;
 }
 if(t===6){const pulse=.5+.5*Math.sin(visualTime*6+frame);glow(x+12,y+8,20,`rgba(96,207,225,${.15+pulse*.2})`);rect(x+2,y+7,22,8,'#367e91');rect(x+5,y+3,16,7,'#70c3cb');rect(x+8,y+5,10,2,'#c0f2e9');rect(x+1,y+13,7,3,'#285e75');rect(x+18,y+13,7,3,'#285e75');rect(x+10,y+7,3,3,'#123c52');return}
 if(t===5){const pulse=.5+.5*Math.sin(visualTime*9+frame);glow(x+10,y+8,17,`rgba(105,245,225,${.18+pulse*.22})`);rect(x+3,y+4,15,11,'#277f83');rect(x+7,y,8,18,'#74e5d0');rect(x+1,y+8,19,3,'#d1fff0');rect(x+8,y+6,6,5,'#143d52');return}
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
 }else if(id>=769){ // Silted Archive: suspended silt, pressure ribbons and rising bubbles.
  ctx.save();ctx.globalAlpha=.42;
  for(let band=0;band<5;band++){const y=40+band*31+Math.sin(visualTime*1.1+band)*3;for(let i=0;i<8;i++){const x=(i*41+band*19-Math.floor(visualTime*(3+band*.4))-cam*.06+512)%270-7;line(x,y,x+18,y+Math.sin(visualTime*2+i)*3,'#70c8d0')}}
  ctx.globalAlpha=.55;for(let i=0;i<18;i++){const x=(i*47+Math.sin(visualTime+i)*7-cam*.04+256)%256,y=205-((visualTime*(8+i%4)*4+i*19)%205);rect(x,y,2,3,'#80c8c4');if(i%3===0)glow(x,y,8,'rgba(85,196,204,.12)')}ctx.restore();
 }else if(id>=267){ // Abyssal Foundry: heat shimmer, falling sparks, and pressure-steam bursts.
  ctx.save();ctx.globalAlpha=.3;
  for(let band=0;band<5;band++){const y=38+band*34+Math.sin(visualTime*1.8+band)*2;for(let i=0;i<7;i++){const x=(i*43+band*17-Math.floor(visualTime*(2+band*.2))-cam*.08+512)%270-7;line(x,y,x+13,y+Math.sin(visualTime*2+i)*2,'#c96e3c')}}
  ctx.globalAlpha=.8;
  for(let i=0;i<19;i++){const x=(i*59+Math.floor(visualTime*(9+i%5))-cam*.12+512)%256,y=(i*31+Math.floor(visualTime*(13+i%4)))%210;const bright=.45+.5*Math.sin(visualTime*4+i);rect(x,y,1,2,`rgba(255,${120+Math.floor(bright*90)},${55+Math.floor(bright*35)},${.35+bright*.6})`);if(i%6===0)glow(x,y,6,'rgba(244,111,54,.13)')}
  for(let vent=0;vent<3;vent++){const x=(vent*91+28-cam*.05+512)%280-12,y=160+(vent%2)*24;for(let puff=0;puff<4;puff++){const rise=(visualTime*12+puff*13+vent*9)%54;rect(x+Math.sin(visualTime+puff)*3,y-rise,2,3,`rgba(185,205,195,${.08+(1-rise/54)*.18})`)}}
  ctx.restore();
 }
}
function renderMap(){
 rect(0,0,256,224,'#07131d');
 // Subtle map-grid texture keeps the screen legible without competing with route data.
 for(let x=18;x<256;x+=19)for(let y=30;y<174;y+=17)rect(x,y,1,1,'#17303b');
 ctx.textAlign='left';ctx.font='bold 8px monospace';ctx.fillStyle='#d7edf2';ctx.fillText('VEYRA-9  /  REGIONAL NETWORK',12,14);
 ctx.font='6px monospace';ctx.fillStyle='#6f9aa8';ctx.fillText('REGIONAL SURVEY // SECTOR NETWORK',12,25);
 const pts=[];
 for(const id of [...Array.from({length:14},(_,i)=>257+i),513,514,515,516,769,770,771,772]){
  const gx=call('eod_map_cell',id,0),gy=call('eod_map_cell',id,1),visited=call('eod_map_cell',id,3);
  pts.push({id,x:14+gx*18,y:54+gy*20,visited:!!visited,exits:call('eod_map_cell',id,2),phaseGate:id===262||id===514||id===515||id===516,pressureGate:id===771});
 }
 const byId=new Map(pts.map(p=>[p.id,p]));
 // Only chart connections whose two endpoints have actually been explored.
 for(const p of pts){
  if(!p.visited)continue;
  for(let d=0;d<4;d++)if(p.exits&(1<<d)){
   const target=call('eod_map_cell',p.id,4+d);
   const q=byId.get(target);
   if(q&&q.visited&&p.id<q.id)line(p.x,p.y,q.x,q.y,'#397080');
  }
 }
 for(const p of pts){
  const current=p.id===roomId;
  if(!p.visited){
   ctx.strokeStyle='#263d48';ctx.lineWidth=1;ctx.strokeRect(p.x-5.5,p.y-4.5,11,9);
   continue;
  }
  rect(p.x-7,p.y-5,14,10,current?'#a85f27':'#226a78');
  if(p.phaseGate&&!call('eod_player_phase_unlocked')){rect(p.x+4,p.y-7,4,4,'#e8c36c');line(p.x+3,p.y-3,p.x+8,p.y-3,'#f5df9b')}
  if(p.pressureGate&&!call('eod_player_pressure_regulator')){rect(p.x-7,p.y-7,4,4,'#6edce2');line(p.x-6,p.y-5,p.x-3,p.y-5,'#d5ffff')}
  ctx.strokeStyle=current?'#ffd18a':'#79b9c5';ctx.lineWidth=1;ctx.strokeRect(p.x-7.5,p.y-5.5,15,11);
  ctx.font='6px monospace';ctx.textAlign='center';ctx.fillStyle=current?'#fff2d8':'#e0f4f7';ctx.fillText(String(p.id>=769?p.id-768:p.id>=513?p.id-512:p.id-256).padStart(2,'0'),p.x,p.y+2);
  if(current){
   const pulse=2+Math.sin(visualTime*5)*1.1;
   ctx.strokeStyle='#ffbd70';ctx.beginPath();ctx.arc(p.x,p.y,pulse+7,0,Math.PI*2);ctx.stroke();
  }
 }
 ctx.textAlign='left';ctx.font='6px monospace';ctx.fillStyle='#7899a5';ctx.fillText('EXPLORED',12,169);
 rect(48,164,8,8,'#226a78');ctx.strokeStyle='#79b9c5';ctx.strokeRect(47.5,163.5,9,9);
 ctx.fillStyle='#7899a5';ctx.fillText('CURRENT SECTOR',70,169);
 rect(151,164,5,5,'#e8c36c');ctx.fillStyle='#7899a5';ctx.fillText('PHASE SEAL',160,169);
 rect(151,164,8,8,'#a85f27');ctx.strokeStyle='#ffd18a';ctx.strokeRect(150.5,163.5,9,9);
 const currentName=names[roomId>=769?18+(roomId-769):roomId>=513?14+(roomId-513):roomId-257]||'UNKNOWN SECTOR';
 ctx.font='bold 7px monospace';ctx.fillStyle='#f0c58e';ctx.fillText('CURRENT: '+currentName,12,188);
 const pct=call('eod_map_completion');ctx.fillStyle='#6f9aa8';ctx.font='6px monospace';ctx.fillText('SURVEY COVERAGE',12,204);
 rect(93,198,111,6,'#1b3440');rect(94,199,Math.round(109*pct/100),4,'#54b9c6');
 ctx.textAlign='right';ctx.font='bold 7px monospace';ctx.fillStyle='#d8eef2';ctx.fillText(pct+'%',244,204);
 ctx.textAlign='left';ctx.font='6px monospace';ctx.fillStyle='#6f9aa8';ctx.fillText('M / ESC  CLOSE MAP',12,218);
}
function render(){if(!wasm)return;const id=call('eod_room_id'),pX=call('eod_player_x'),pY=call('eod_player_y');const targetCam=Math.max(0,Math.min(256,pX-128));if(previousRoom!==id){cameraX=targetCam;roomFlash=12;previousRoom=id}else cameraX+=(targetCam-cameraX)*.16;const cam=cameraX;roomId=id;visualTime+=1/60;updateVisualEvents(id,pX,pY);if(shake>0){shakeX=(rand()-.5)*shake;shakeY=(rand()-.5)*shake;shake*=.78;if(shake<.2)shake=0}else{shakeX=shakeY=0}if(roomFlash>0)roomFlash--;if(mapOpen){renderMap();return}ctx.save();ctx.translate(shakeX,shakeY);rect(0,0,256,224,id>=769?'#071725':id>=513?'#071d1d':id>=267?'#20140e':id===262?'#071b24':id===265?'#160f21':id===259?'#101923':'#081722');for(const s of stars){let x=(s.x-cam*.18+512)%512;if(x<256)rect(x,s.y,1,1,`rgba(128,190,205,${s.a})`)}
// distant mineral silhouettes and drifting bioluminescent motes
for(let i=0;i<9;i++){let x=((i*67-cam*.32+1024)%320)-32;let h=18+(i*19%34);rect(x,150-h,3,h,'#102c38');rect(x+4,158-h,2,h-8,'#143541')}for(let i=0;i<18;i++){let x=(i*53+Math.floor(visualTime*5+i*7)-cam*.08+512)%256,y=(i*29+Math.floor(visualTime*3+i*11))%190;rect(x,y,1,1,`rgba(91,205,207,${.12+(i%4)*.06})`)}
// cavern backdrop
for(let x=0;x<256;x+=32){let wx=x+cam;let h=16+((Math.floor(wx/32)*13+id*7)%25);rect(x,0,32,h,id>=769?'#183a49':id>=513?'#123c38':id>=267?'#392319':id===262?'#10313a':id===265?'#28182d':id===259?'#202b31':'#0d2632');rect(x,0,32,2,id>=769?'#63aeb7':id>=513?'#4b9b78':id>=267?'#9a542b':id===262?'#28606a':id===265?'#633b61':id===259?'#48534d':'#183b49')}
drawRoomAtmosphere(id,cam);
if(id>=769){
 const pulse=.5+.5*Math.sin(visualTime*2.2);for(let i=0;i<9;i++){const x=(i*37+23-cam*.08+512)%270-7;const y=42+(i*23)%102;rect(x,y,3,34+(i%3)*12,'#173c4b');rect(x+3,y+4,2,28+(i%3)*10,'#286173');glow(x+2,y+8,10,`rgba(103,211,222,${.12+pulse*.1})`)}
}else if(id>=513){
 const pulse=.5+.5*Math.sin(visualTime*2.4);
 for(let i=0;i<8;i++){const x=(i*39+17-cam*.12+512)%270-7;const h=28+(i*17%45);rect(x,150-h,3,h,'#17483f');rect(x+3,150-h+5,2,h-5,'#286b58');rect(x-2,150-h+12,7,2,`rgba(126,239,178,${.25+pulse*.4})`);if(i%2===0)glow(x,150-h+14,10,'rgba(81,229,164,.12)')}
 for(let i=0;i<13;i++){const x=(i*47+Math.floor(visualTime*(2+i%3))-cam*.07+512)%256,y=(i*31+Math.floor(visualTime*4+i*5))%190;rect(x,y,2,2,`rgba(143,255,190,${.2+.35*(.5+.5*Math.sin(visualTime*3+i))})`)}
}
// The Core Chamber has a distinct reactor-vault silhouette rather than the
// generic Foundry cavern treatment: paired conduits frame the arena and a
// distant containment arch pulses behind the Guardian.
if(id===270){
 const archX=256-cam;
 rect(archX-74,43,148,5,'#573321');rect(archX-66,48,132,3,'#b86a36');
 rect(archX-72,51,5,91,'#74452f');rect(archX+67,51,5,91,'#74452f');
 rect(archX-61,58,4,69,'#a45a31');rect(archX+57,58,4,69,'#a45a31');
 rect(archX-48,72,96,2,'#d17b3c');rect(archX-36,80,72,2,'#7b492f');
 const reactorPulse=.5+.5*Math.sin(visualTime*2.1);
 glow(archX,111,42,`rgba(245,112,48,${.08+reactorPulse*.08})`);
 rect(archX-3,88,6,31,`rgba(255,178,91,${.3+reactorPulse*.3})`);
 for(let side=0;side<2;side++){
  const px=side?236:20, sx=px-cam;
  rect(sx-5,38,10,106,'#3c3430');rect(sx-3,44,6,91,'#a75c31');
  rect(sx-8,57,16,4,'#d58a4c');rect(sx-8,116,16,4,'#d58a4c');
  glow(sx,60,13,'rgba(255,125,55,.12)');
 }
 for(let i=0;i<5;i++){const arc=(visualTime*22+i*39)%150;const ax=archX-54+i*27;rect(ax,62+arc*.34,2,4,`rgba(255,194,123,${.12+(1-arc/150)*.45})`)}
}
// tiles
for(let ty=0;ty<14;ty++)for(let tx=0;tx<32;tx++){let t=call('eod_tile',tx,ty);if(!t)continue;let x=tx*16-cam,y=ty*16;if(x<-16||x>256)continue;let c=t===6?'#397f83':id>=769?(t===2?'#547e88':t===3?'#3a6978':t===4?'#5bb8c2':t===5?'#83cbd1':'#284d60'):id>=513?(t===2?'#4b8e73':t===3?'#34765f':t===4?'#54c7a0':t===5?'#a4d76b':'#204d43'):id>=267?(t===2?'#a56d45':t===3?'#9b4c27':t===4?'#3e9ca8':t===5?'#a45b9a':'#60402e'):(t===2?'#557d86':t===3?'#8a5735':t===4?'#3e9ca8':t===5?'#a45b9a':'#314b57');rect(x,y,16,16,c);rect(x,y,16,2,t===6?'#b7fff0':id>=769?(t===2?'#8abac0':'#5a9aa5'):id>=267?(t===2?'#e0ae71':t===3?'#e58b4c':'#a36a43'):(t===2?'#9bcbd0':t===3?'#d28a51':'#547482'));rect(x+1,y+4,14,1,'#203844');if(t===1||t===2){let seed=(tx*17+ty*31+id*7)%11;if(seed<4){rect(x+3+seed,y+7,2,1,'#6b8990');rect(x+11-seed,y+11,2,1,'#243c47')}if(seed===2){line(x+4,y+12,x+8,y+9,'#405d68');line(x+8,y+9,x+11,y+12,'#405d68')}}if(t===3){rect(x+2,y+3,12,11,'#70442f');rect(x+4,y+4,8,2,'#c17b49');rect(x+5,y+7,6,5,'#5e3929');rect(x+10,y+11,4,3,'#4c3028');rect(x+2,y+14,12,1,'#d0925c')}if(t===6){const pulse=.5+.5*Math.sin(visualTime*4+tx);rect(x+2,y+2,12,12,'#153d48');rect(x+5,y+1,6,14,`rgba(106,245,226,${.35+pulse*.5})`);rect(x+1,y+7,14,2,'#b7fff0');}
if(t===4||t===5){const pulse=.5+.5*Math.sin(visualTime*5+tx+ty);rect(x+3,y+2,10,12,'#101f2a');rect(x+5,y+3,6,10,t===4?'#176d75':'#713d7b');rect(x+7,y+4,2,8,t===4?'#5de6ef':'#f18ee2');rect(x+2,y+1,12,1,t===4?`rgba(100,245,240,${.35+pulse*.45})`:`rgba(245,150,250,${.3+pulse*.4})`)}}
// Thermal vents expose a visible warning window before their active damage cycle.
for(let h=0;h<call('eod_hazard_count');h++){
 if(call('eod_hazard',h,5)!==id)continue;
 const hx=call('eod_hazard',h,0)-cam,hy=call('eod_hazard',h,1),hw=call('eod_hazard',h,2),hh=call('eod_hazard',h,3),state=call('eod_hazard',h,4);
 if(id>=769){
  if(state===1){rect(hx,hy+hh-5,hw,5,'#286b7a');for(let k=0;k<4;k++)line(hx+k*9,hy+hh-4,hx+k*9+7,hy+hh-12,'#a1e7ec');glow(hx+hw/2,hy+hh-9,18,'rgba(93,200,225,.15)')}else if(state===2){rect(hx,hy+hh-6,hw,6,'#4aa4b5');for(let k=0;k<5;k++){const rise=(visualTime*34+k*13)%48;rect(hx+4+k*6+Math.sin(visualTime*6+k)*2,hy+hh-8-rise,3,5,`rgba(135,232,245,${.58-rise/100})`)}glow(hx+hw/2,hy+hh-16,27,'rgba(76,205,245,.23)')}
 }else if(id>=513){
  if(state===1){rect(hx,hy+hh-5,hw,5,'#276d70');for(let k=0;k<4;k++)line(hx+k*9,hy+hh-4,hx+k*9+7,hy+hh-12,'#8fffea');glow(hx+hw/2,hy+hh-9,18,'rgba(91,245,222,.15)')}
  else if(state===2){rect(hx,hy+hh-6,hw,6,'#36a99a');for(let k=0;k<5;k++){const rise=(visualTime*38+k*13)%48;rect(hx+4+k*6+Math.sin(visualTime*6+k)*2,hy+hh-8-rise,3,5,`rgba(116,255,220,${.58-rise/100})`)}glow(hx+hw/2,hy+hh-16,27,'rgba(76,245,207,.23)')}
 }else{
  if(state===1){rect(hx,hy+hh-5,hw,5,'#9b542c');for(let k=0;k<4;k++)line(hx+k*9,hy+hh-4,hx+k*9+7,hy+hh-12,'#f0b15c');glow(hx+hw/2,hy+hh-9,18,'rgba(245,154,73,.13)')}
  else if(state===2){rect(hx,hy+hh-6,hw,6,'#d36a31');for(let k=0;k<5;k++){const rise=(visualTime*42+k*11)%52;rect(hx+4+k*6+Math.sin(visualTime*7+k)*2,hy+hh-8-rise,3,5,`rgba(255,${125+Math.floor(rise)},${55+Math.floor(rise/2)},${.55-rise/110})`)}glow(hx+hw/2,hy+hh-16,27,'rgba(245,104,43,.2)')}
 }
}
// door frames
for(let d=0;d<4;d++){let dx=call('eod_door',d,0),dy=call('eod_door',d,1),dw=call('eod_door',d,2),dh=call('eod_door',d,3),dest=call('eod_door',d,4);if(!dest)continue;let x=dx-cam;rect(x,dy,dw,dh,'#112b39');if(d<2){rect(x,dy,3,dh,'#4d7d8d');rect(x+dw-3,dy,3,dh,'#4d7d8d')}else{rect(x,dy,dw,3,'#4d7d8d')}}
// pickups
for(let i=0;i<call('eod_pickup_count');i++){let x=call('eod_pickup',i,0)-cam,y=call('eod_pickup',i,1),t=call('eod_pickup',i,2);rect(x+3,y+4,18,16,t===1?'#f2a54c':t===3?'#d4c66b':t===2?'#7bd9ee':t===5?'#b6fff0':'#60d8d2');rect(x+7,y,10,4,'#e6fbf9');rect(x+8,y+8,8,8,'#19333e')}
// checkpoint beacons
for(let i=0;i<8;i++)if(call('eod_checkpoint',i,0)===id){let x=call('eod_checkpoint',i,1)-cam,y=call('eod_checkpoint',i,2);rect(x+13,y+4,6,30,'#3c9aa5');rect(x+9,y,14,8,'#9cebf0');rect(x+12,y+9,8,2,'#d8fcff')}
// Enemy sprites use distinct silhouettes and a two-beat locomotion cycle.
for(let i=0;i<call('eod_enemy_count');i++){let x=call('eod_enemy',i,0)-cam,y=call('eod_enemy',i,1),t=call('eod_enemy',i,2),surface=call('eod_enemy',i,4);drawEnemySprite(x,y,t,i,surface)}
for(let i=0;i<call('eod_enemy_shot_count');i++){let x=call('eod_enemy_shot',i,0)-cam,y=call('eod_enemy_shot',i,1);rect(x,y,4,4,id>=769?'#75d6e3':'#f29b54')}
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
// The Foundry Guardian is a separate machine boss: animated furnace core,
// articulated hammer arms, and attack-specific tells (not a recolored Burrower).
if(call('eod_guardian_active')){
 const gx=call('eod_guardian_x')-cam,gy=call('eod_guardian_y'),gs=call('eod_guardian_state'),ga=call('eod_guardian_attack'),gp=call('eod_guardian_phase'),gw=call('eod_guardian_vulnerable');
 const pulse=.5+.5*Math.sin(visualTime*7),core=gs===6?'#59656a':(gw?'#fff0a1':(gp===3?'#ff6b36':'#f39a43'));
 if(gs===3){
  ctx.font='7px monospace';ctx.fillStyle='#ffd08a';
  ctx.fillText(['','MOLTEN SWEEP','FURNACE PULSE','ANVIL DROP'][ga]||'CORE CHARGING',8,38);
  if(ga===1){rect(2,194,252,3,'rgba(255,119,48,.85)');rect(Math.max(4,Math.min(248,gx-24)),182,48,5,'#ffc16b');}
  if(ga===2){for(let k=-2;k<=2;k++){let ax=gx+k*17;rect(ax-3,gy-40,6,6,'#ffbd69');glow(ax,gy-36,10,'rgba(255,125,45,.28)')}}
  if(ga===3){let tx=call('eod_guardian_target_x')-cam;for(let k=-1;k<=1;k++){let ax=Math.max(4,Math.min(250,tx+k*40));rect(ax-5,28,10,3,'#ffd17b');rect(ax-1,31,2,8,'#fff0a1')}}
 }
 if(gs===4&&ga===1){rect(0,196,256,3,'rgba(255,105,35,.65)');}
 // Heavy shoulder housings and piston arms.
 rect(gx-34,gy-28,68,43,'#394b52');rect(gx-44,gy-20,18,26,'#60747a');rect(gx+26,gy-20,18,26,'#60747a');
 rect(gx-30,gy-35,20,12,'#8b9a91');rect(gx+10,gy-35,20,12,'#8b9a91');
 rect(gx-26,gy-17,52,31,'#263a43');rect(gx-18,gy-13,36,23,gw?'#f8df9a':'#b75a36');
 glow(gx,gy-2,gw?34:24,gw?'rgba(255,232,153,.34)':`rgba(255,${95+Math.floor(pulse*45)},45,.25)`);
 rect(gx-8,gy-8,16,14,core);rect(gx-4,gy-5,8,8,'#fff0b1');
 rect(gx-38,gy+13,76,7,'#202d32');rect(gx-30,gy+15,60,3,'#9c6a45');
 // Animated piston joints / warning lights.
 const arm=Math.sin(visualTime*4)*3;rect(gx-42,gy-2+arm,8,23,'#9ba69a');rect(gx+34,gy-2-arm,8,23,'#9ba69a');
 rect(gx-42,gy+17+arm,12,9,'#cf7c43');rect(gx+30,gy+17-arm,12,9,'#cf7c43');
 rect(10,25,236,4,'#233946');rect(10,25,236*call('eod_guardian_hp')/Math.max(1,call('eod_guardian_max_hp')),4,'#d86a3e');
 ctx.font='7px monospace';ctx.fillStyle='#f4d2ad';ctx.fillText('FOUNDRY GUARDIAN  PHASE '+gp,10,19);
 if(gw){ctx.fillStyle='#fff0a1';ctx.fillText('CORE EXPOSED',184,19)}
 if(gs===6){ctx.fillStyle='#9ba8a8';ctx.fillText('CORE SILENT',184,19)}
}
// Prism Sentinel: refractive predator with three distinct attack tells and a visible exposed core.
if(call('eod_prism_active')){
 const sx=call('eod_prism_x')-cam,sy=call('eod_prism_y'),ss=call('eod_prism_state'),sa=call('eod_prism_attack'),sp=call('eod_prism_phase'),sw=call('eod_prism_vulnerable');
 const pulse=.5+.5*Math.sin(visualTime*6),core=sw?'#fff6b5':(sp===3?'#f4a4ff':'#65e7d4');
 if(ss===3){ctx.font='7px monospace';ctx.fillStyle='#b9fff0';ctx.fillText(['','LENS BEAM','PRISM BURST','REFRACTION DASH'][sa]||'PRISM CHARGING',8,38);
  if(sa===1){let tx=call('eod_prism_target_x')-cam;rect(Math.min(sx,tx),sy-2,Math.abs(tx-sx),3,'rgba(151,255,237,.38)');rect(tx-2,28,4,8,'#baffef')}
  if(sa===2){for(let k=-2;k<=2;k++)rect(sx+k*13-3,31,6,7,'#9af8e4')}
  if(sa===3){rect(Math.max(0,Math.min(250,call('eod_prism_target_x')-cam-20)),190,40,3,'#f1a8ff')}
 }
 // Floating six-facet body; the open lens is only exposed during recovery.
 ctx.save();ctx.translate(sx,sy);ctx.rotate(Math.sin(visualTime*2)*.05);
 glow(0,0,sw?44:32,sw?'rgba(255,247,180,.32)':'rgba(70,230,210,.22)');
 ctx.fillStyle='#246d78';ctx.beginPath();ctx.moveTo(-28,-8);ctx.lineTo(-15,-27);ctx.lineTo(13,-27);ctx.lineTo(29,-7);ctx.lineTo(21,20);ctx.lineTo(-17,24);ctx.closePath();ctx.fill();
 ctx.fillStyle='#62cbb9';ctx.beginPath();ctx.moveTo(-18,-8);ctx.lineTo(-9,-20);ctx.lineTo(9,-20);ctx.lineTo(20,-5);ctx.lineTo(10,14);ctx.lineTo(-12,15);ctx.closePath();ctx.fill();
 ctx.fillStyle=core;ctx.beginPath();ctx.moveTo(-8,-12);ctx.lineTo(8,-12);ctx.lineTo(13,0);ctx.lineTo(0,12);ctx.lineTo(-13,0);ctx.closePath();ctx.fill();
 ctx.fillStyle='#e4fff5';ctx.fillRect(-3,-5,6,10);ctx.restore();
 rect(10,25,236,4,'#233946');rect(10,25,236*call('eod_prism_hp')/Math.max(1,call('eod_prism_max_hp')),4,'#55c9b2');
 ctx.font='7px monospace';ctx.fillStyle='#baf9e9';ctx.fillText('PRISM SENTINEL  PHASE '+sp,10,19);if(sw){ctx.fillStyle='#fff3a6';ctx.fillText('LENS EXPOSED',184,19)}
}
// Archive Warden: a broad pressure-shell guardian with a visible tidal core.
if(call('eod_warden_active')){
 const wx=call('eod_warden_x')-cam,wy=call('eod_warden_y'),ws=call('eod_warden_state'),wa=call('eod_warden_attack'),wp=call('eod_warden_phase'),wv=call('eod_warden_vulnerable');
 const pulse=.5+.5*Math.sin(visualTime*5),core=wv?'#fff3b0':(wp===3?'#8cf4ee':'#398f9c');
 if(ws===3){ctx.font='7px monospace';ctx.fillStyle='#b9f4f4';ctx.fillText(['','PRESSURE SLAM','SILT LANCE','VORTEX SURGE'][wa]||'WARDEN CHARGING',8,38);
  if(wa===1){for(let k=-1;k<=1;k++){let ax=wx+k*24;rect(ax-4,181,8,12,'rgba(117,235,235,.35)')}}
  if(wa===2){let tx=call('eod_warden_target_x')-cam;rect(Math.min(wx,tx),wy-2,Math.abs(tx-wx),4,'rgba(143,245,245,.42)');rect(tx-2,29,4,9,'#d5ffff')}
  if(wa===3){glow(wx,wy,52,'rgba(68,204,218,.25)')}
 }
 ctx.save();ctx.translate(wx,wy);ctx.rotate(Math.sin(visualTime*1.4)*.025);
 glow(0,0,wv?48:36,wv?'rgba(255,244,177,.32)':'rgba(54,192,207,.24)');
 ctx.fillStyle='#174e61';ctx.beginPath();ctx.moveTo(-38,-12);ctx.lineTo(-27,-31);ctx.lineTo(-9,-38);ctx.lineTo(18,-34);ctx.lineTo(38,-13);ctx.lineTo(32,19);ctx.lineTo(12,31);ctx.lineTo(-23,27);ctx.lineTo(-39,8);ctx.closePath();ctx.fill();
 ctx.fillStyle='#398c9b';ctx.beginPath();ctx.moveTo(-27,-10);ctx.lineTo(-17,-24);ctx.lineTo(4,-29);ctx.lineTo(25,-12);ctx.lineTo(21,13);ctx.lineTo(0,24);ctx.lineTo(-24,12);ctx.closePath();ctx.fill();
 ctx.fillStyle=core;ctx.beginPath();ctx.ellipse(0,0,12,18,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e1ffff';ctx.fillRect(-3,-8,6,16);
 for(let k=0;k<4;k++){ctx.strokeStyle=`rgba(126,236,238,${.25+.2*pulse})`;ctx.beginPath();ctx.arc(0,0,43+k*5,visualTime*.7+k,visualTime*.7+k+1.1);ctx.stroke()}
 ctx.restore();
 rect(10,25,236,4,'#233946');rect(10,25,236*call('eod_warden_hp')/Math.max(1,call('eod_warden_max_hp')),4,'#46aab4');
 ctx.font='7px monospace';ctx.fillStyle='#bdf8f5';ctx.fillText('ARCHIVE WARDEN  PHASE '+wp,10,19);if(wv){ctx.fillStyle='#fff3b0';ctx.fillText('CORE EXPOSED',184,19)}
}
// projectiles
for(let i=0;i<call('eod_projectile_count');i++){let x=call('eod_projectile',i,0)-cam,y=call('eod_projectile',i,1),t=call('eod_projectile',i,2);rect(x,y,t===1?7:5,t===1?5:3,t===1?'#ffb15b':'#b9f8ff')}
for(let i=0;i<call('eod_bomb_count');i++){let x=call('eod_bomb',i,0)-cam,y=call('eod_bomb',i,1),timer=call('eod_bomb',i,2),pulse=timer<12&&Math.floor(visualTime*18)%2===0;glow(x+3,y+3,9,pulse?'rgba(255,150,75,.34)':'rgba(235,165,80,.16)');rect(x,y,7,7,pulse?'#fff0bd':'#f3b65c');rect(x+2,y+2,3,3,'#fff0c7');rect(x+3,y-2,1,2,'#f6a65d')}
// Player animation is state-driven: stride, jump/fall lean, aim and Morph Ball roll.
let morph=call('eod_player_morph'),vx=call('eod_player_vx'),vy=call('eod_player_vy'),facing=call('eod_player_facing'),moving=Math.abs(vx)>0,airborne=Math.abs(vy)>1,run=Math.floor(visualTime*12)%4,blink=call('eod_player_invuln')>0&&Math.floor(performance.now()/70)%2===0,px=pX-cam,aim=call('eod_player_aim');
if(!morph){rect(px+1,pY+22,13,2,'rgba(0,0,0,.42)');glow(px+7+(facing?5:-5),pY+10,16,'rgba(73,204,218,.12)')}
if(!blink)drawPlayerSprite(px,pY,morph,moving,airborne,run,facing,aim);
if(call('eod_player_phase_timer')>0){const a=.22+.18*Math.sin(visualTime*18);ctx.strokeStyle=`rgba(131,255,239,${a+.25})`;ctx.lineWidth=1;ctx.strokeRect(px-3,pY-3,22,30);glow(px+8,pY+12,17,'rgba(91,245,222,.18)')}
// Environmental shock rings expand from bomb blasts, door breaks and hard impacts.
for(let i=shockRings.length-1;i>=0;i--){const q=shockRings[i];q.r+=q.life>14?2.1:1.15;q.life--;if(q.life<=0){shockRings.splice(i,1);continue}ctx.globalAlpha=Math.min(.72,q.life/q.max);ctx.strokeStyle=q.color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(q.x-cam,q.y,q.r,0,Math.PI*2);ctx.stroke()}
// Weapon impacts, terrain debris, enemy defeats and damage produce short-lived particles.
for(let i=particles.length-1;i>=0;i--){const q=particles[i];q.x+=q.vx;q.y+=q.vy;q.vy+=.055;q.vx*=.97;q.life--;if(q.life<=0){particles.splice(i,1);continue}ctx.globalAlpha=Math.min(1,q.life/8);rect(q.x,q.y,q.size,q.size,q.color);if(q.life>8&&q.size>1)glow(q.x,q.y,4,'rgba(110,220,235,.12)')}
ctx.globalAlpha=1;
// Subtle edge falloff and room-entry pulse frame the action without obscuring play.
ctx.fillStyle='rgba(0,8,14,.18)';ctx.fillRect(0,0,256,3);ctx.fillRect(0,221,256,3);if(roomFlash>0){ctx.fillStyle=`rgba(120,220,230,${roomFlash/90})`;ctx.fillRect(0,0,256,224)}
// HUD
rect(5,5,88,15,'#071018cc');ctx.font='7px monospace';ctx.fillStyle='#c6e4e9';ctx.fillText('ENERGY',9,15);rect(43,9,44,5,'#31434c');rect(43,9,44*call('eod_player_energy')/99,5,'#df756f');ctx.fillStyle='#c6e4e9';ctx.fillText('VEYRA-9',193,14);ctx.fillStyle='#7ea5b1';ctx.fillText('SECTOR '+(id>=769?'03-':id>=513?'02-':'01-')+String(id>=769?id-768:id>=513?id-512:id-256).padStart(2,'0'),193,23);
roomEl.textContent=(id>=769?'03-':id>=513?'02-':'01-')+String(id>=769?id-768:id>=513?id-512:id-256).padStart(2,'0');nameEl.textContent=names[id>=769?18+(id-769):id>=513?14+(id-513):id-257]||'UNKNOWN';energyEl.textContent=call('eod_player_energy');missilesEl.textContent=call('eod_player_missiles')+'/'+call('eod_player_missile_capacity');equipmentEl.textContent='BEAM ONLINE'+(call('eod_has_missiles')?' · MISSILES':'')+(call('eod_has_bombs')?' · BOMBS':'')+(call('eod_player_morph')?' · MORPH':'')+(call('eod_guardian_defeated')?' · CORE CELL':'')+(call('eod_player_phase_unlocked')?(call('eod_player_phase_timer')>0?' · PHASE '+call('eod_player_phase_timer'):' · PRISM PHASE'):'')+(call('eod_player_pressure_regulator')?' · PRESSURE REGULATOR':'')+(id>=769?' · SILTED ARCHIVE':id>=513?' · GLASSROOT':(id===270?(call('eod_glassroot_unlocked')?' · GLASSROOT ACCESS':' · CORE SEAL LOCKED'):''));
ctx.restore();
}
async function start(){const response=await fetch('eod.wasm');const bytes=await response.arrayBuffer();const {instance}=await WebAssembly.instantiate(bytes,{});wasm=instance;if(!call('eod_init'))throw Error('Crash Basin initialization failed');const restored=restoreSave();audioPrev=captureAudioState();if(window.EODAudio)window.EODAudio.setRoom(roomAudioName(audioPrev.room));if(restored){overlayTitle.textContent='SAVE DATA RESTORED';overlayCopy.textContent='Checkpoint and Crash Basin progress recovered.';overlay.classList.add('show');paused=true;}function frame(t){if(!last)last=t;let dt=Math.min(100,t-last);last=t;if(!paused&&!mapOpen){acc+=dt;const step=1000/60;let loops=0;while(acc>=step&&loops++<5){call('eod_update',held);const savePending=call('eod_checkpoint_save_pending');updateAudioEvents(savePending);if(savePending){if(call('eod_commit_browser_save'))persistSave();}acc-=step} }render();requestAnimationFrame(frame)}requestAnimationFrame(frame)}
start().catch(e=>{overlay.classList.add('show');overlayTitle.textContent='FIELD SYSTEM OFFLINE';overlayCopy.textContent=e.message;console.error(e)});
})();
