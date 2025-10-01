
const canvas=document.getElementById('game'); const ctx=canvas.getContext('2d',{alpha:false});
function resize(){canvas.width=innerWidth; canvas.height=innerHeight;} addEventListener('resize',resize); resize();

const HUD={hp:document.getElementById('hp'),kills:document.getElementById('kills'),wave:document.getElementById('wave'),weapon:document.getElementById('weapon')};

const FRAME_W=96, FRAME_H=128, DIRS=['north','northeast','east','southeast','south','southwest','west','northwest'];
function loadImage(src){ return new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.src=src; }); }
function dirFromVec(x,y){ const a=Math.atan2(y,x); const deg=(a*180/Math.PI+360)%360; const idx=Math.round(deg/45)%8;
  return ['east','northeast','north','northwest','west','southwest','south','southeast'][idx]; }

// ASSETS
const BG=[], HERO={idle:{},walk:{}}, ZOMB={}, FX={};
async function loadAssets(){
  for(const f of ['bg_level1.png','bg_level2.png','bg_level3.png']) BG.push(await loadImage(f));
  for(const d of DIRS){ HERO.idle[d]=await loadImage(`hero_idle_${d}.png`); HERO.walk[d]=await loadImage(`hero_walk_${d}.png`); }
  for(const z of ['worker','nurse','burned','rotting']) ZOMB[z]={ idle: await loadImage(`zombie_${z}_idle.png`), walk: await loadImage(`zombie_${z}_walk.png`) };
  FX.muzzle = await loadImage('fx_muzzle.png'); FX.bullet = await loadImage('fx_bullet.png');
}

// STATE
const S={
  level:0, time:0,
  hero:{x:innerWidth/2,y:innerHeight/2,dir:'south',hp:100,speed:3},
  stickL:{id:null,active:false,sx:0,sy:0,x:0,y:0},
  stickR:{id:null,active:false,sx:0,sy:0,x:1,y:0,shooting:false},
  bullets:[], enemies:[], kills:0, wave:1,
  weapon:{name:'PISTOL', fireRate:220, bulletSpeed:8, spread:0, multi:1, lastShot:0}
};

// Weapons
const WEAPONS=[
  {name:'PISTOL', fireRate:220, bulletSpeed:9, spread:0.02, multi:1},
  {name:'SMG',    fireRate:90,  bulletSpeed:10, spread:0.07, multi:1},
  {name:'SHOTGUN',fireRate:500, bulletSpeed:8, spread:0.15, multi:6},
];
let wpnIndex=0;
function cycleWeapon(){ wpnIndex=(wpnIndex+1)%WEAPONS.length; Object.assign(S.weapon, WEAPONS[wpnIndex]); HUD.weapon.textContent=S.weapon.name; }
document.getElementById('btnWpn').addEventListener('click', cycleWeapon);

// Input - Mobile twin sticks
canvas.addEventListener('touchstart',e=>{
  for(const t of e.changedTouches){
    if(t.clientX<innerWidth*0.45 && !S.stickL.active){ S.stickL={id:t.identifier,active:true,sx:t.clientX,sy:t.clientY,x:0,y:0}; }
    else { S.stickR={id:t.identifier,active:true,sx:t.clientX,sy:t.clientY,x:0,y:0,shooting:true}; }
  }
});
canvas.addEventListener('touchmove',e=>{
  for(const t of e.changedTouches){
    if(S.stickL.active && t.identifier===S.stickL.id){ S.stickL.x=t.clientX-S.stickL.sx; S.stickL.y=t.clientY-S.stickL.sy; }
    if(S.stickR.active && t.identifier===S.stickR.id){ S.stickR.x=t.clientX-S.stickR.sx; S.stickR.y=t.clientY-S.stickR.sy; }
  }
});
function endStick(id){ if(S.stickL.id===id) S.stickL={id:null,active:false,sx:0,sy:0,x:0,y:0}; if(S.stickR.id===id) S.stickR={id:null,active:false,sx:0,sy:0,x:0,y:0,shooting:false}; }
canvas.addEventListener('touchend',e=>{ for(const t of e.changedTouches) endStick(t.identifier); });
canvas.addEventListener('touchcancel',e=>{ for(const t of e.changedTouches) endStick(t.identifier); });

// Desktop: WASD + Mouse aim + hold LMB to fire
const keys={};
addEventListener('keydown',e=>{ keys[e.key.toLowerCase()]=true; if(e.key===' ') e.preventDefault(); });
addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });
canvas.addEventListener('mousemove',e=>{ S.stickR.active=true; S.stickR.x=e.clientX-S.hero.x; S.stickR.y=e.clientY-S.hero.y; });
let mouseDown=false;
canvas.addEventListener('mousedown',e=>{ if(e.button===0){ mouseDown=true; S.stickR.active=true; S.stickR.shooting=true; } });
addEventListener('mouseup',e=>{ if(e.button===0){ mouseDown=false; S.stickR.shooting=false; } });

// Spawn logic
function spawnEnemy(){
  const types=['worker','nurse','burned','rotting'];
  const t=types[Math.floor(Math.random()*types.length)];
  const pad=120;
  const side=Math.floor(Math.random()*4);
  let x=0,y=0;
  if(side===0){x=-pad;y=Math.random()*canvas.height;}
  if(side===1){x=canvas.width+pad;y=Math.random()*canvas.height;}
  if(side===2){x=Math.random()*canvas.width;y=-pad;}
  if(side===3){x=Math.random()*canvas.width;y=canvas.height+pad;}
  const speed=1+Math.random()*0.7 + S.wave*0.05;
  S.enemies.push({x,y,type:t,hp:30+S.wave*5,speed,dir:'south',hurt:0});
}

// Shooting
function tryShoot(t){
  const w=S.weapon;
  if(t - w.lastShot < w.fireRate) return;
  w.lastShot=t;
  const aimx = S.stickR.active ? S.stickR.x : 1;
  const aimy = S.stickR.active ? S.stickR.y : 0;
  const ang = Math.atan2(aimy,aimx);
  for(let i=0;i<w.multi;i++){
    const a = ang + (Math.random()-0.5)*w.spread*2;
    S.bullets.push({ x:S.hero.x, y:S.hero.y-16, vx:Math.cos(a)*w.bulletSpeed, vy:Math.sin(a)*w.bulletSpeed, life:120, dmg: (w.name==='SHOTGUN'?14:18) });
  }
}

// Update
function update(dt,t){
  // Level change by kills
  if(S.kills>40) S.level=2; else if(S.kills>15) S.level=1; else S.level=0;

  // Movement
  let mx=0,my=0;
  if(S.stickL.active){ mx=S.stickL.x; my=S.stickL.y; }
  else{ // keyboard
    if(keys['w']||keys['arrowup']) my-=1;
    if(keys['s']||keys['arrowdown']) my+=1;
    if(keys['a']||keys['arrowleft']) mx-=1;
    if(keys['d']||keys['arrowright']) mx+=1;
  }
  const mag=Math.hypot(mx,my)||1;
  mx/=mag; my/=mag;
  S.hero.x += mx*S.hero.speed; S.hero.y += my*S.hero.speed;
  if(Math.abs(mx)>0.01||Math.abs(my)>0.01) S.hero.dir=dirFromVec(mx,my);

  // Shooting hold
  if((S.stickR.active && S.stickR.shooting) || mouseDown){ tryShoot(t); }

  // Bullets
  for(const b of S.bullets){ b.x+=b.vx; b.y+=b.vy; b.life--; }
  S.bullets = S.bullets.filter(b=>b.life>0 && b.x>-100 && b.x<canvas.width+100 && b.y>-120 && b.y<canvas.height+120);

  // Enemies
  if(S.enemies.length < 8 + S.wave*2) spawnEnemy();
  const target=S.hero;
  for(const e of S.enemies){
    const dx=target.x-e.x, dy=target.y-e.y; const dn=Math.hypot(dx,dy)||1;
    e.x += (dx/dn)*e.speed; e.y += (dy/dn)*e.speed;
    e.dir=dirFromVec(dx,dy);
    // bullet hit
    for(const b of S.bullets){
      if(Math.abs(b.x-e.x)<24 && Math.abs(b.y-e.y)<32){ e.hp-=b.dmg; b.life=0; e.hurt=100; }
    }
    // touch damage
    if(Math.abs(target.x-e.x)<28 && Math.abs(target.y-e.y)<40){ S.hero.hp = Math.max(0, S.hero.hp-0.05*dt); }
  }
  // deaths
  const alive=[]; for(const e of S.enemies){ if(e.hp<=0){ S.kills++; } else alive.push(e); } S.enemies=alive;

  // waves scale by time
  if(t%60000<16) S.wave++;

  HUD.kills.textContent=S.kills|0; HUD.wave.textContent=S.wave; HUD.hp.textContent=S.hero.hp|0;
}

// Draw
function drawSheet(img,frames,x,y,fps=8){ const idx=Math.floor(performance.now()/1000*fps)%frames; ctx.drawImage(img,idx*FRAME_W,0,FRAME_W,FRAME_H,x-FRAME_W/2,y-FRAME_H/2,FRAME_W,FRAME_H); }
function render(){
  // bg
  const bg=BG[S.level]; ctx.drawImage(bg,0,0,canvas.width,canvas.height);
  // bullets
  for(const b of S.bullets){ ctx.drawImage(FX.bullet, b.x-8, b.y-8); }
  // enemies
  for(const e of S.enemies){ drawSheet(ZOMB[e.type].walk,4,e.x,e.y,6); }
  // hero
  const moving = (Math.abs(S.stickL.x)>4||Math.abs(S.stickL.y)>4) || keys['w']||keys['a']||keys['s']||keys['d']||keys['arrowup']||keys['arrowdown']||keys['arrowleft']||keys['arrowright'];
  const himg = moving ? HERO.walk[S.hero.dir] : HERO.idle[S.hero.dir];
  drawSheet(himg, moving?4:2, S.hero.x, S.hero.y, moving?8:4);
}

// Main loop
let last=performance.now();
async function main(){ await loadAssets(); requestAnimationFrame(loop); }
function loop(t){ const dt=t-last; last=t; S.time=t; update(dt,t); render(); requestAnimationFrame(loop); }
main();
