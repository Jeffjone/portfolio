(() => {
  'use strict';
  const button=document.getElementById('enter-portfolio'),stage=document.getElementById('encounter');
  const top=button.querySelector('.sphere-top'),bottom=button.querySelector('.sphere-bottom');
  const a=top.getContext('2d'),b=bottom.getContext('2d');if(!a||!b)return;
  const size=240,radius=116,buffer=document.createElement('canvas');buffer.width=buffer.height=size;
  const ctx=buffer.getContext('2d');if(!ctx)return;
  const image=ctx.createImageData(size,size),pixels=image.data,surface=[];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const nx=(x-size/2)/radius,ny=(y-size/2)/radius,z2=1-nx*nx-ny*ny;
    if(z2>=0)surface.push([4*(y*size+x),nx,ny,Math.sqrt(z2)]);
  }
  const motion=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,previous=0;
  function paint(angle){
    const c=Math.cos(angle),s=Math.sin(angle);
    for(const [i,x,y,z] of surface){
      // Rotate the surface around its vertical axis. Lighting remains in world space.
      const front=x*s+z*c,side=x*c-z*s;
      const knob=front>.93&&Math.hypot(side,y)<.28;
      let color=y<0?[174,84,137]:[238,232,239];
      if(Math.abs(y)<.047)color=[42,33,48];
      if(knob){const d=Math.hypot(side,y);color=d>.21?[42,33,48]:d>.15?[185,176,194]:[249,242,255];}
      const diffuse=Math.max(0,-.43*x-.56*y+.7*z),shade=.32+.68*diffuse;
      const shine=Math.pow(Math.max(0,-.3*x-.4*y+.866*z),55)*95;
      for(let k=0;k<3;k++)pixels[i+k]=Math.min(255,color[k]*shade+shine);
      pixels[i+3]=Math.min(255,(1-Math.sqrt(x*x+y*y))*radius*255);
    }
    ctx.putImageData(image,0,0);a.clearRect(0,0,size,size);b.clearRect(0,0,size,size);
    a.drawImage(buffer,0,0,size,size/2,0,0,size,size/2);b.drawImage(buffer,0,size/2,size,size/2,0,size/2,size,size/2);
  }
  function tick(time){frame=0;if(stage.hidden||document.hidden||motion.matches||stage.classList.contains('is-opening'))return;
    if(time-previous>33){paint(time/2200);previous=time;}frame=requestAnimationFrame(tick);
  }
  function resume(){cancelAnimationFrame(frame);paint(0);if(!motion.matches&&!stage.hidden&&!document.hidden)frame=requestAnimationFrame(tick);}
  paint(0);button.classList.add('sphere-ready');
  new MutationObserver(()=>{if(stage.hidden||stage.classList.contains('is-opening'))cancelAnimationFrame(frame);else resume();}).observe(stage,{attributes:true,attributeFilter:['hidden','class']});
  document.addEventListener('visibilitychange',resume);motion.addEventListener('change',resume);resume();
})();
