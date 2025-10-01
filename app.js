
const canvas=document.getElementById('game');const ctx=canvas.getContext('2d');
function resize(){canvas.width=innerWidth;canvas.height=innerHeight;}window.addEventListener('resize',resize);resize();
const FRAME_W=128,FRAME_H=160,DIRS=['north','northeast','east','southeast','south','southwest','west','northwest'];
function loadImage(src){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src;});}
const HERO_IDLE={},Z_ANIMS={};
async function loadHero(){for(const d of DIRS){HERO_IDLE[d]=await loadImage(`hero_idle_${d}.png`);}}
async function loadZombies(){const sets=['worker','nurse','burned','rotting'];for(const s of sets){Z_ANIMS[s]={};Z_ANIMS[s].idle=await loadImage(`zombie_${s}_idle.png`);Z_ANIMS[s].walk=await loadImage(`zombie_${s}_walk.png`);}}
let hero={x:innerWidth/2,y:innerHeight/2,dir:'south'};let enemies=[];
function spawnZombie(){const names=['worker','nurse','burned','rotting'];const n=names[Math.floor(Math.random()*names.length)];enemies.push({x:Math.random()*canvas.width,y:-50,set:n,dir:'south'});}
function drawSprite(img,frames,x,y){const idx=Math.floor(performance.now()/250)%frames;ctx.drawImage(img,idx*FRAME_W,0,FRAME_W,FRAME_H,x-FRAME_W/2,y-FRAME_H/2,FRAME_W,FRAME_H);}
async function main(){await loadHero();await loadZombies();for(let i=0;i<5;i++)spawnZombie();loop();}
function loop(){ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);drawSprite(HERO_IDLE[hero.dir],2,hero.x,hero.y);for(const z of enemies){drawSprite(Z_ANIMS[z.set].walk,4,z.x,z.y);}requestAnimationFrame(loop);}main();
