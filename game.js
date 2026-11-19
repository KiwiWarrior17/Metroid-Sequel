(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
const overlay=document.getElementById('overlay'),overlayTitle=document.getElementById('overlay-title'),overlayCopy=document.getElementById('overlay-copy');
const roomEl=document.getElementById('room'),nameEl=document.getElementById('room-name'),energyEl=document.getElementById('energy'),missilesEl=document.getElementById('missiles'),equipmentEl=document.getElementById('equipment');
const names=['THE WRECK','BROKEN PASSAGE','SINKHOLE SHAFT','BASALT CROSSING','SURVEY CACHE','CRACKED RESERVOIR','BURIED TUNNELS','FORGOTTEN EXCAVATION','THE NEST','DEEP TRANSIT'];
const keys=new Map([['ArrowLeft',1],['KeyA',1],['ArrowRight',2],['KeyD',2],['ArrowUp',4],['KeyW',4],['ArrowDown',8],['KeyS',8],['Space',16],['KeyJ',32],['KeyK',64],['KeyX',128],['KeyC',256]]);
let held=0,wasd=0,paused=false,mapOpen=false,last=0,acc=0,wasm=null,roomId=0,stars=[];
for(let i=0;i<75;i++)stars.push({x:(i*71+13)%512,y:(i*37+11)%180,a:.12+(i%5)*.07});
const call=(n,...a)=>wasm.exports[n](...a),txt=p=>{let m=new Uint8Array(wasm.exports.memory.buffer),s='';for(;m[p];p++)s+=String.fromCharCode(m[p]);return s};
function toggleMap(){if(mapOpen){mapOpen=false;overlay.classList.remove('show')}else if(call('eod_map_unlocked')){mapOpen=true;paused=false;overlay.classList.remove('show')}else{overlayTitle.textContent='MAP DATA UNAVAILABLE';overlayCopy.textContent='Find the survey terminal in Basalt Crossing.';overlay.classList.add('show');paused=true}}
function keyDown(e){if(keys.has(e.code)){e.preventDefault();held|=keys.get(e.code)}if(e.code==='KeyM'&&!e.repeat)toggleMap();if(e.code==='Escape'&&!e.repeat){if(mapOpen){mapOpen=false;overlay.classList.remove('show')}else if(overlay.classList.contains('show')){paused=false;overlay.classList.remove('show')}else{paused=!paused;overlayTitle.textContent='PAUSED';overlayCopy.textContent='The basin is quiet. Take a breath.';overlay.classList.toggle('show',paused)}}}
function keyUp(e){if(keys.has(e.code)){e.preventDefault();held&=~keys.get(e.code)}}
window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',()=>{held=0;document.querySelectorAll('#touch button.on').forEach(b=>b.classList.remove('on'))});document.addEventListener('visibilitychange',()=>{if(document.hidden){held=0;document.querySelectorAll('#touch button.on').forEach(b=>b.classList.remove('on'))}});
document.querySelectorAll('#touch button').forEach(b=>{const bit=Number(b.dataset.bit);if(bit){const release=()=>{held&=~bit;b.classList.remove('on')};b.addEventListener('pointerdown',e=>{e.preventDefault();held|=bit;b.classList.add('on');try{b.setPointerCapture(e.pointerId)}catch(_){}});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,release)}else b.addEventListener('click',()=>{if(b.dataset.action==='map')toggleMap();else{paused=!paused;overlayTitle.textContent='PAUSED';overlayCopy.textContent='The basin is quiet. Take a breath.';overlay.classList.toggle('show',paused)}})});
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
function line(x,y,x2,y2,c){ctx.strokeStyle=c;ctx.beginPath();ctx.moveTo(x+.5,y+.5);ctx.lineTo(x2+.5,y2+.5);ctx.stroke()}
function renderMap(){rect(0,0,256,224,'#07131d');ctx.font='7px monospace';ctx.fillStyle='#80a8b6';ctx.fillText('VEYRA-9 / CRASH BASIN',12,17);const pts=[];for(let id=257;id<=266;id++){let gx=call('eod_map_cell',id,0),gy=call('eod_map_cell',id,1),v=call('eod_map_cell',id,3);pts.push({id,x:50+gx*38,y:42+gy*34,v})}ctx.strokeStyle='#2a5362';ctx.lineWidth=2;for(const p of pts){let exits=call('eod_map_cell',p.id,2);for(let d=0;d<4;d++)if(exits&(1<<d)){let nx=p.x+(d===1?38:d===0?-38:0),ny=p.y+(d===3?34:d===2?-34:0);line(p.x,p.y,nx,ny,'#2a5362')}}for(const p of pts){rect(p.x-7,p.y-6,14,12,p.v?'#2e8490':'#172a35');ctx.strokeStyle=p.id===roomId?'#ffb65c':'#5a8290';ctx.strokeRect(p.x-7.5,p.y-6.5,15,13);ctx.fillStyle=p.v?'#e6f8fa':'#78919b';ctx.textAlign='center';ctx.fillText(String(p.id-256).padStart(2,'0'),p.x,p.y+2)}ctx.textAlign='left';ctx.fillStyle='#8daab5';ctx.fillText('DISCOVERED SECTORS',12,195);ctx.fillStyle='#ffb65c';ctx.fillText('CURRENT POSITION',12,208);ctx.fillStyle='#8daab5';ctx.fillText(call('eod_map_completion')+'% MAPPED',190,208)}
function render(){if(!wasm)return;const id=call('eod_room_id'),pX=call('eod_player_x'),pY=call('eod_player_y'),cam=Math.max(0,Math.min(256,pX-128));roomId=id;if(mapOpen){renderMap();return}rect(0,0,256,224,'#081722');for(const s of stars){let x=(s.x-cam*.18+512)%512;if(x<256)rect(x,s.y,1,1,`rgba(128,190,205,${s.a})`)}
// cavern backdrop
for(let x=0;x<256;x+=32){let wx=x+cam;let h=16+((Math.floor(wx/32)*13+id*7)%25);rect(x,0,32,h,'#0d2632');rect(x,0,32,2,'#183b49')}
// tiles
for(let ty=0;ty<14;ty++)for(let tx=0;tx<32;tx++){let t=call('eod_tile',tx,ty);if(!t)continue;let x=tx*16-cam,y=ty*16;if(x<-16||x>256)continue;let c=t===2?'#557d86':t===3?'#8a5735':t===4?'#3e9ca8':t===5?'#a45b9a':'#314b57';rect(x,y,16,16,c);rect(x,y,16,2,t===2?'#9bcbd0':t===3?'#d28a51':'#547482');rect(x+1,y+4,14,1,'#203844');if(t===3){rect(x+5,y+5,5,5,'#5e3929');rect(x+10,y+11,4,3,'#5e3929')}if(t===4||t===5){rect(x+6,y+3,4,10,'#101f2a');rect(x+7,y+4,2,8,t===4?'#5de6ef':'#f18ee2')}}
// door frames
for(let d=0;d<4;d++){let dx=call('eod_door',d,0),dy=call('eod_door',d,1),dw=call('eod_door',d,2),dh=call('eod_door',d,3),dest=call('eod_door',d,4);if(!dest)continue;let x=dx-cam;rect(x,dy,dw,dh,'#112b39');if(d<2){rect(x,dy,3,dh,'#4d7d8d');rect(x+dw-3,dy,3,dh,'#4d7d8d')}else{rect(x,dy,dw,3,'#4d7d8d')}}
// pickups
for(let i=0;i<call('eod_pickup_count');i++){let x=call('eod_pickup',i,0)-cam,y=call('eod_pickup',i,1),t=call('eod_pickup',i,2);rect(x+3,y+4,18,16,t===1?'#f2a54c':t===3?'#d4c66b':'#60d8d2');rect(x+7,y,10,4,'#e6fbf9');rect(x+8,y+8,8,8,'#19333e')}
// checkpoint beacons
for(let i=0;i<4;i++)if(call('eod_checkpoint',i,0)===id){let x=call('eod_checkpoint',i,1)-cam,y=call('eod_checkpoint',i,2);rect(x+13,y+4,6,30,'#3c9aa5');rect(x+9,y,14,8,'#9cebf0');rect(x+12,y+9,8,2,'#d8fcff')}
// enemies and shots
for(let i=0;i<call('eod_enemy_count');i++){let x=call('eod_enemy',i,0)-cam,y=call('eod_enemy',i,1),t=call('eod_enemy',i,2);let c=['#d18b54','#86b66b','#5a9f9d','#b6a06b','#9c8ec7'][t]||'#b9a77c';if(t===0){rect(x+1,y+7,22,8,c);rect(x+5,y+3,14,7,c);rect(x+3,y+14,4,3,'#76503b');rect(x+17,y+14,4,3,'#76503b')}else if(t===1){rect(x+5,y+4,12,10,c);rect(x+1,y+1,7,5,'#b5d38b');rect(x+15,y+1,7,5,'#b5d38b')}else if(t===2){rect(x+1,y+6,20,8,c);rect(x+5,y+3,12,4,'#9bd0bd');rect(x+4,y+14,4,3,'#355c62');rect(x+16,y+14,4,3,'#355c62')}else if(t===3){rect(x+2,y+8,20,9,c);rect(x+5,y+3,13,8,c);rect(x+4,y+15,4,3,'#4c392b');rect(x+17,y+15,4,3,'#4c392b')}else{rect(x+1,y+7,22,11,c);rect(x+5,y+2,14,9,c);rect(x+7,y,10,5,'#d6c6e8');rect(x+5,y+11,14,3,'#625b83')}rect(x+7,y+7,2,2,'#101923');rect(x+16,y+7,2,2,'#101923')}
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
 rect(x-22,y-17,44,32,body);rect(x-16,y-25,32,13,'#b57970');
 rect(x-12,y-8,9,5,weak?'#fff0a0':'#ffca7d');rect(x+5,y-8,9,5,weak?'#fff0a0':'#ffca7d');
 rect(x-25,y+11,50,5,'#392d3d');rect(x-20,y+12,40,2,'#c08b65');
 rect(10,25,236,4,'#233946');rect(10,25,236*call('eod_boss_hp')/Math.max(1,call('eod_boss_max_hp')),4,'#b85b6e');
 ctx.font='7px monospace';ctx.fillStyle='#c6e4e9';ctx.fillText('BURROWER  PHASE '+phase,10,19);
 if(weak){ctx.fillStyle='#f4d58c';ctx.fillText('EXPOSED',190,19)}
}
// projectiles
for(let i=0;i<call('eod_projectile_count');i++){let x=call('eod_projectile',i,0)-cam,y=call('eod_projectile',i,1),t=call('eod_projectile',i,2);rect(x,y,t===1?7:5,t===1?5:3,t===1?'#ffb15b':'#b9f8ff')}
for(let i=0;i<call('eod_bomb_count');i++){let x=call('eod_bomb',i,0)-cam,y=call('eod_bomb',i,1);rect(x,y,7,7,'#f3b65c');rect(x+2,y+2,3,3,'#fff0c7')}
// player
let morph=call('eod_player_morph'),blink=call('eod_player_invuln')>0&&Math.floor(performance.now()/70)%2===0;if(!blink){rect(pX-cam+(morph?1:0),pY+(morph?4:0),morph?15:13,morph?12:22,'#d8e6e5');rect(pX-cam+3,pY+3,8,8,'#789aa1');rect(pX-cam+(call('eod_player_facing')?10:1),pY+7,3,3,'#142b37');rect(pX-cam+(call('eod_player_facing')?13:0),pY+12,3,5,'#e2aa68')}
// HUD
rect(5,5,88,15,'#071018cc');ctx.font='7px monospace';ctx.fillStyle='#c6e4e9';ctx.fillText('ENERGY',9,15);rect(43,9,44,5,'#31434c');rect(43,9,44*call('eod_player_energy')/99,5,'#df756f');ctx.fillStyle='#c6e4e9';ctx.fillText('VEYRA-9',193,14);ctx.fillStyle='#7ea5b1';ctx.fillText('SECTOR '+String(id-256).padStart(2,'0'),193,23);
roomEl.textContent='01-'+String(id-256).padStart(2,'0');nameEl.textContent=names[id-257]||'UNKNOWN';energyEl.textContent=call('eod_player_energy');missilesEl.textContent=call('eod_player_missiles')+'/'+call('eod_player_missile_capacity');equipmentEl.textContent='BEAM ONLINE'+(call('eod_has_missiles')?' · MISSILES':'')+(call('eod_has_bombs')?' · BOMBS':'')+(call('eod_player_morph')?' · MORPH':'');
}
async function start(){const response=await fetch('eod.wasm');const bytes=await response.arrayBuffer();const {instance}=await WebAssembly.instantiate(bytes,{});wasm=instance;if(!call('eod_init'))throw Error('Crash Basin initialization failed');function frame(t){if(!last)last=t;let dt=Math.min(100,t-last);last=t;if(!paused&&!mapOpen){acc+=dt;const step=1000/60;let loops=0;while(acc>=step&&loops++<5){call('eod_update',held);acc-=step} }render();requestAnimationFrame(frame)}requestAnimationFrame(frame)}
start().catch(e=>{overlay.classList.add('show');overlayTitle.textContent='FIELD SYSTEM OFFLINE';overlayCopy.textContent=e.message;console.error(e)});
})();
