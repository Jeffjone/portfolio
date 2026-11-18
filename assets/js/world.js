(() => {
  'use strict';
  const map = document.getElementById('world-map');
  const player = document.getElementById('map-player');
  const action = document.getElementById('map-interact');
  const status = document.getElementById('map-status');
  const keys = new Set();
  const directions = {ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
  let x=.49,y=.52,frame=0,last=0,nearby=null;
  const active=()=>!document.getElementById('home').hidden && !document.getElementById('portfolio').inert && !document.getElementById('game-dialog').open && !document.hidden;
  function draw(){player.style.left=(x*100)+'%';player.style.top=(y*100)+'%';findNearby();}
  function findNearby(){
    const box=map.getBoundingClientRect(),px=box.left+x*box.width,py=box.top+y*box.height;
    let nearest=null,distance=Infinity;
    map.querySelectorAll('.map-place,.map-stop,.map-trainer').forEach(el=>{
      const b=(el.querySelector('.building')||el).getBoundingClientRect();
      const d=Math.hypot(px-Math.max(b.left,Math.min(b.right,px)),py-Math.max(b.top,Math.min(b.bottom,py))); 
      if(d<distance){distance=d;nearest=el;}
    });
    const next=distance<Math.min(40,box.width*.14)?nearest:null;
    if(nearby!==next){nearby?.classList.remove('in-range');nearby=next;nearby?.classList.add('in-range');
      action.disabled=!nearby;const label=nearby?.getAttribute('aria-label')||nearby?.textContent.trim();
      action.textContent=nearby?'Explore: '+label:'Explore town';status.textContent=nearby?'E / Enter to interact.':'Walk up to a building or sign.';
    }
  }
  function blocked(nx,ny){
    const b=map.getBoundingClientRect();const px=b.left+nx*b.width,py=b.top+ny*b.height;
    if(nx<.04||nx>.83||ny<.12||ny>.94)return true;
    // Test the explorer's feet against scenery, leaving room to approach doors.
    return [...map.querySelectorAll('.building,.map-trees')].some(el=>{const r=el.getBoundingClientRect();return px+7>r.left&&px-7<r.right&&py>r.top-12&&py<r.bottom+6;});
  }
  function move(dx,dy){
    const box=map.getBoundingClientRect();
    const nx=x+dx/box.width,ny=y+dy/box.height;
    if(!blocked(nx,y))x=nx;if(!blocked(x,ny))y=ny;draw();
  }
  function tick(time){
    frame=0;if(!active()||!keys.size){stop();return;}
    const dt=Math.min((time-(last||time))/1000,.04);last=time;
    let dx=(keys.has('right')?1:0)-(keys.has('left')?1:0),dy=(keys.has('down')?1:0)-(keys.has('up')?1:0);
    const length=Math.hypot(dx,dy)||1;move(dx/length*125*dt,dy/length*125*dt);
    if(dx||dy)player.dataset.facing=dy<0?'up':dy>0?'down':dx<0?'left':'right';
    player.classList.toggle('walking',Boolean(dx||dy));frame=requestAnimationFrame(tick);
  }
  function start(direction){if(!active())return;keys.add(direction);if(!frame){last=0;frame=requestAnimationFrame(tick);}}
  function stop(){keys.clear();cancelAnimationFrame(frame);frame=0;last=0;player.classList.remove('walking');}
  map.addEventListener('keydown',e=>{
    if(e.target!==map)return;const direction=directions[e.key]||directions[e.key.toLowerCase()];
    if(direction){e.preventDefault();start(direction);}
    if(['e','E','Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat&&active())nearby?.click();}
  });
  window.addEventListener('keyup',e=>{keys.delete(directions[e.key]||directions[e.key.toLowerCase()]);});
  document.querySelectorAll('[data-move]').forEach(button=>{
    let pressed=false;
    button.addEventListener('pointerdown',e=>{e.preventDefault();pressed=true;button.setPointerCapture(e.pointerId);start(button.dataset.move);});
    const release=()=>{pressed=false;keys.delete(button.dataset.move);};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    button.addEventListener('click',e=>{if(e.detail===0&&!pressed&&active()){const d=button.dataset.move;move(d==='right'?18:d==='left'?-18:0,d==='down'?18:d==='up'?-18:0);player.dataset.facing=d;}});
  });
  action.addEventListener('click',()=>{if(active())nearby?.click();});
  map.addEventListener('blur',stop);window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);document.addEventListener('game:navigate',()=>{stop();if(!document.getElementById('home').hidden)draw();});
  new ResizeObserver(()=>{if(map.getBoundingClientRect().width){draw();if(blocked(x,y)){x=.49;y=.52;draw();}}}).observe(map);
  draw();
})();
