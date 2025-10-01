
// Retro survival game: move+shoot, zombies, parallax bg, drivable Trans Am.
// All assets are flat files in repo root.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha:false });
function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; } addEventListener('resize', resize); resize();

const HUD = { hp:document.getElementById('hp'), kills:document.getElementById('kills'), wave:document.getElementById('wave'), mode:document.getElementById('mode') };
const FRAME_W=128, FRAME_H=160, DIRS=['north','northeast','east','southeast','south','southwest','west','northwest'];

function loadImage(src){ return new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.src=src; }); }

// Assets
const BG = {}, HERO={idle:{}, walk:{}}, ZOMB={}, FX={} , VEH={};

async function loadAssets(){
  BG.sky = await loadImage('bg_sky.png');
  BG.castle = await loadImage('bg_castle.png');
  BG.ground = await loadImage('bg_ground.png');

  for(const d of DIRS){
    HERO.idle[d] = await loadImage(`hero_idle_${d}.png`);
    HERO.walk[d] = await loadImage(`hero_walk_${d}.png`);
  }
  for(const z of ['worker','nurse','burned','rotting']){
    ZOMB[z] = {
      idle: await loadImage(`zombie_${z}_idle.png`),
      walk: await loadImage(`zombie_${z}_walk.png`),
    };
  }
  FX.blood = await loadImage('fx_blood_splatter.png');
  VEH.idle = await loadImage('vehicle_transam_idle.png');
  VEH.drive = await loadImage('vehicle_transam_drive.png');
}

// Game state
const state = {
  mode:'foot',  // 'foot' or 'car'
  hero:{ x: innerWidth/2, y: innerHeight/2, dir:'south', speed:2.4, hp:100 },
  car:{ x: innerWidth/2+120, y: innerHeight/2+40, speed:3.8, dir:0, drivingFrame:0 },
  bullets:[], enemies:[], kills:0, wave:1, time:0,
  stick:{active:false,sx:0,sy:0,x:0,y:0}, aim:{x:1,y:0}
};

function dirFromVec(x,y){
  const a = Math.atan2(y, x); const deg=(a*180/Math.PI+360)%360; const idx=Math.round(deg/45)%8;
  // map: 0E,1NE,2N,3NW,4W,5SW,6S,7SE
  return ['east','northeast','north','northwest','west','southwest','south','southeast'][idx];
}

function drawParallax(){
  // ground tile
  const g = BG.ground;
  for(let y=-(state.hero.y%1024)-1024; y<canvas.height+1024; y+=1024){
    for(let x=-(state.hero.x%1024)-1024; x<canvas.width+1024; x+=1024){
      ctx.drawImage(g, 0,0,1024,1024, x, y, 1024,1024);
    }
  }
  // sky + castle parallax
  ctx.drawImage(BG.sky, 0,0, BG.sky.width, BG.sky.height, 0,0, canvas.width, canvas.height);
  const cx = -((state.hero.x*0.3)%canvas.width);
  ctx.drawImage(BG.castle, 0,0, BG.castle.width, BG.castle.height, cx, 0, canvas.width*1.2, canvas.height);
  ctx.drawImage(BG.castle, 0,0, BG.castle.width, BG.castle.height, cx+canvas.width*1.2, 0, canvas.width*1.2, canvas.height);
}

function drawSheet(img, frames, x,y, fps=6){
  const idx = Math.floor((state.time/1000)*fps) % frames;
  ctx.drawImage(img, idx*FRAME_W, 0, FRAME_W, FRAME_H, x-FRAME_W/2, y-FRAME_H/2, FRAME_W, FRAME_H);
}

function spawnEnemy(){
  const names = ['worker','nurse','burned','rotting'];
  const name = names[Math.floor(Math.random()*names.length)];
  const side = Math.floor(Math.random()*4);
  let x=0,y=0;
  if(side===0){ x=-100; y=Math.random()*canvas.height; }
  if(side===1){ x=canvas.width+100; y=Math.random()*canvas.height; }
  if(side===2){ x=Math.random()*canvas.width; y=-120; }
  if(side===3){ x=Math.random()*canvas.width; y=canvas.height+120; }
  state.enemies.push({ x,y,set:name, hp:30, speed:1.0+Math.random()*0.5, dir:'south' });
}

function shoot(){
  const angle = Math.atan2(state.aim.y, state.aim.x);
  const speed = 7;
  let x=state.hero.x, y=state.hero.y-20;
  if(state.mode==='car'){ x=state.car.x; y=state.car.y-10; }
  state.bullets.push({ x,y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, life:140 });
}

function update(dt){
  // input movement (virtual stick, clamped)
  let mx = Math.max(-1, Math.min(1, state.stick.x/60));
  let my = Math.max(-1, Math.min(1, state.stick.y/60));
  // hero or car
  if(state.mode==='foot'){
    state.hero.x += mx*state.hero.speed;
    state.hero.y += my*state.hero.speed;
    if(mx||my) state.hero.dir = dirFromVec(mx,my);
  }else{
    state.car.x += mx*state.car.speed;
    state.car.y += my*state.car.speed;
    state.car.drivingFrame = (state.car.drivingFrame+dt*0.01)%3;
  }

  // bullets
  for(const b of state.bullets){ b.x+=b.vx; b.y+=b.vy; b.life--; }
  state.bullets = state.bullets.filter(b=>b.life>0 && b.x>-100 && b.x<canvas.width+100 && b.y>-120 && b.y<canvas.height+120);

  // enemies seek hero (or car)
  const tx = state.mode==='foot' ? state.hero.x : state.car.x;
  const ty = state.mode==='foot' ? state.hero.y : state.car.y;
  for(const z of state.enemies){
    const dx = tx - z.x, dy = ty - z.y; const dn = Math.hypot(dx,dy)||1;
    z.x += (dx/dn)*z.speed; z.y += (dy/dn)*z.speed;
    z.dir = dirFromVec(dx,dy);
    // bullet hit
    for(const b of state.bullets){
      if(Math.abs(b.x-z.x)<28 && Math.abs(b.y-z.y)<36){ z.hp-=20; b.life=0; }
    }
  }
  // deaths
  const alive=[]; for(const z of state.enemies){ if(z.hp<=0){ state.kills++; } else alive.push(z); } state.enemies=alive;
  // waves
  if(state.enemies.length<8+state.wave) spawnEnemy();

  HUD.kills.textContent = state.kills;
  HUD.wave.textContent = state.wave;
  HUD.hp.textContent = state.hero.hp;
  HUD.mode.textContent = state.mode==='foot' ? 'ON FOOT' : 'IN CAR';
}

function render(){
  drawParallax();
  // bullets
  ctx.fillStyle='#f4d'; for(const b of state.bullets){ ctx.fillRect(b.x-2,b.y-2,4,4); }
  // enemies
  for(const z of state.enemies){
    const anim = ZOMB[z.set].walk;
    drawSheet(anim, 4, z.x, z.y, 6);
  }
  // hero/car
  if(state.mode==='foot'){
    const anim = (Math.abs(state.stick.x)>2||Math.abs(state.stick.y)>2) ? HERO.walk[state.hero.dir] : HERO.idle[state.hero.dir];
    drawSheet(anim, anim.width/FRAME_W, state.hero.x, state.hero.y, 6);
  }else{
    const f = Math.floor(state.car.drivingFrame)%3;
    ctx.drawImage(VEH.drive, f*FRAME_W, 0, FRAME_W, FRAME_H, state.car.x-FRAME_W/2, state.car.y-FRAME_H/2, FRAME_W, FRAME_H);
  }
}

// Input
canvas.addEventListener('touchstart', e=>{
  for(const t of e.changedTouches){
    const x=t.clientX, y=t.clientY;
    if(x<innerWidth*0.6){ state.stick.active=true; state.stick.sx=x; state.stick.sy=y; state.stick.x=0; state.stick.y=0; }
    else { state.aim.x=x-(state.mode==='foot'?state.hero.x:state.car.x); state.aim.y=y-(state.mode==='foot'?state.hero.y:state.car.y); shoot(); }
  }
});
canvas.addEventListener('touchmove', e=>{ for(const t of e.changedTouches){ if(state.stick.active){ state.stick.x=t.clientX-state.stick.sx; state.stick.y=t.clientY-state.stick.sy; } } });
canvas.addEventListener('touchend', e=>{ state.stick.active=false; state.stick.x=0; state.stick.y=0; });

canvas.addEventListener('mousemove', e=>{ state.aim.x=e.clientX-(state.mode==='foot'?state.hero.x:state.car.x); state.aim.y=e.clientY-(state.mode==='foot'?state.hero.y:state.car.y); });
canvas.addEventListener('mousedown', e=>{ if(e.button===0) shoot(); });

// Buttons
document.getElementById('btnShoot').addEventListener('click', shoot);
document.getElementById('btnEnter').addEventListener('click', ()=>{
  state.mode = state.mode==='foot' ? 'car' : 'foot';
});

let last=performance.now();
async function main(){
  await loadAssets();
  requestAnimationFrame(loop);
}
function loop(t){
  const dt = t-last; last=t; state.time=t;
  update(dt); render();
  requestAnimationFrame(loop);
}
main();
