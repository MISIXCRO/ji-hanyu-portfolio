/* CircularCarousel: native DOM adaptation of the React Bits source supplied by the owner.
 * Preserves the cylinder geometry, eight-strip card bend, assemble intro,
 * spring focus, momentum drag and pointer parallax without adding React.
 */
(() => {
  'use strict';
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const wrap=a=>((a+180)%360+360)%360-180;
  const RAD=Math.PI/180;
  const rotateX=([x,y,z],a)=>[x,y*Math.cos(a*RAD)-z*Math.sin(a*RAD),y*Math.sin(a*RAD)+z*Math.cos(a*RAD)];
  const rotateY=([x,y,z],a)=>[x*Math.cos(a*RAD)+z*Math.sin(a*RAD),y,-x*Math.sin(a*RAD)+z*Math.cos(a*RAD)];
  const easeOut=t=>1-Math.pow(1-t,4);

  window.createPortfolioCarousel=({root,items,onChange,onPauseChange})=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const fine=matchMedia('(hover: hover) and (pointer: fine)');
    const abort=new AbortController();
    const listen=(el,type,fn,options={})=>el.addEventListener(type,fn,{...options,signal:abort.signal});
    const settings={cardW:220,cardH:220,gap:64,perspective:3200,tilt:-5,speed:10,parallax:.33,momentum:.6};
    const view=document.createElement('div');view.className='cc-view';view.setAttribute('aria-hidden','true');
    const stage=document.createElement('div');stage.className='cc-stage';
    const camera=document.createElement('div');camera.className='cc-camera';
    const ring=document.createElement('div');ring.className='cc-ring';
    view.append(stage);stage.append(camera);camera.append(ring);root.prepend(view);
    const slots=Array.from({length:items.length*2},(_,i)=>{
      const card=document.createElement('div');card.className='cc-card';card.dataset.ccIndex=String(i);ring.append(card);return card;
    });
    const s={angle:0,velocity:0,target:null,dir:-1,fit:1,radius:0,count:0,step:0,last:0,
      enabled:false,entranceReady:true,visible:false,ready:false,away:false,manualPause:false,hover:false,focus:false,
      press:null,drag:false,ignoreClickUntil:0,holdUntil:0,pointerInside:false,
      pointerX:0,pointerY:0,yaw:0,pitch:0,introTime:0,introDone:reduced.matches,active:0};
    let raf=0,wheelTimer=0,loadTimer=0,destroyed=false,lastPauseKey='';
    root.classList.add('circular-carousel');root.setAttribute('aria-roledescription','轮播');
    root.setAttribute('aria-busy','true');root.dataset.ccState='loading';

    function buildTiles(){
      slots.forEach((card,index)=>{
        card.replaceChildren();const item=items[index%items.length];
        for(const back of [false,true])for(let i=0;i<8;i++){
          const start=i*settings.cardW/8-(i>0?1.25:0);
          const end=(i+1)*settings.cardW/8+(i<7?1.25:0);
          const alpha=((start+end)/2-settings.cardW/2)/s.radius;
          const shift=s.radius*Math.sin(alpha),sink=-s.radius*(1-Math.cos(alpha));
          const tile=document.createElement('div');tile.className='cc-tile';
          Object.assign(tile.style,{left:`${-(end-start)/2}px`,top:`${-settings.cardH/2}px`,width:`${end-start}px`,height:`${settings.cardH}px`,transform:`translate3d(${shift}px,0,${sink}px) rotateY(${alpha/RAD}deg)${back?' rotateY(180deg)':''}`});
          const strip=back?7-i:i;
          const frame=document.createElement('div');frame.className='cc-frame';
          frame.style.borderRadius=`${strip===0?12:0}px ${strip===7?12:0}px ${strip===7?12:0}px ${strip===0?12:0}px`;
          const image=item.querySelector('img').cloneNode(false);image.className='cc-photo';image.alt='';image.draggable=false;
          image.loading='eager';image.setAttribute('fetchpriority','auto');image.sizes='220px';
          Object.assign(image.style,{left:`${-(back?settings.cardW-end:start)}px`,width:`${settings.cardW}px`,height:`${settings.cardH}px`});
          image.addEventListener('error',()=>card.classList.add('is-image-error'),{once:true});
          frame.append(image);
          if(back){const inner=document.createElement('div');inner.className='cc-inner';frame.append(inner)}
          const shade=document.createElement('div');shade.className='cc-shade';frame.append(shade);tile.append(frame);card.append(tile);
        }
        const unavailable=document.createElement('span');unavailable.className='cc-unavailable';unavailable.textContent=`${item.dataset.title} · 图片暂未载入`;card.append(unavailable);
      });
    }
    function measure(){
      const rect=root.getBoundingClientRect();if(!rect.width||!rect.height)return;
      // Repeating the four works fills the desktop cylinder; phones use one set.
      const count=rect.width<600?items.length:items.length*2;
      if(count!==s.count){
        const active=((Math.round(-s.angle/(s.step||90))%items.length)+items.length)%items.length;
        s.count=count;s.step=360/count;s.angle=-active*s.step;s.velocity=0;s.target=null;
        const n=Math.max(count,3),pitch=settings.cardW+settings.gap;
        const chord=pitch/(2*Math.sin(Math.PI/n)),arc=n*pitch/(2*Math.PI);
        s.radius=Math.max(chord+(arc-chord),settings.cardW*.6);buildTiles();
      }
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(let a=-180;a<=180;a+=7.5)for(const cx of [-110,110])for(const cy of [-110,110]){
        const p=rotateX(rotateY([cx,cy,s.radius],a),settings.tilt);p[2]-=s.radius;
        const k=settings.perspective/(settings.perspective-p[2]);
        minX=Math.min(minX,p[0]*k);maxX=Math.max(maxX,p[0]*k);minY=Math.min(minY,p[1]*k);maxY=Math.max(maxY,p[1]*k);
      }
      s.fit=Math.min(1,rect.width*.94/(maxX-minX),(rect.height-44)*.92/(maxY-minY));
      stage.style.perspective=`${settings.perspective}px`;
      stage.style.transform=`translate3d(0,${-((minY+maxY)/2)*s.fit-12}px,0) scale(${s.fit})`;
      render();wake();
    }
    function available(){return s.enabled&&s.entranceReady&&s.visible&&s.ready&&!s.away&&!document.hidden&&!destroyed}
    function paused(){return s.manualPause||s.hover||s.focus||reduced.matches||s.press!==null}
    function stop(){if(raf)cancelAnimationFrame(raf);raf=0;s.last=0}
    function nearest(a){return Math.round(a/s.step)*s.step}
    function publishState(){
      const state=!s.enabled?'idle':!s.ready?'loading':!available()?'idle':!s.introDone?'assembling':paused()?'paused':'playing';
      if(root.dataset.ccState!==state)root.dataset.ccState=state;
      const key=`${s.manualPause}/${reduced.matches}`;
      if(key!==lastPauseKey){lastPauseKey=key;onPauseChange?.(s.manualPause,reduced.matches)}
    }
    function render(){
      const parallax=reduced.matches?0:settings.parallax;
      const swell=1+(reduced.matches?0:.5*.12*Math.min(1,Math.abs(s.velocity)/420));
      const R=s.radius*swell;
      let offset=0;
      if(!s.introDone)offset=-32*s.dir*(1-easeOut(clamp(s.introTime/1500,0,1)));
      camera.style.transform=`translate3d(0,0,${-R}px) rotateX(${settings.tilt+s.pitch*parallax}deg) rotateY(${s.yaw*parallax}deg)`;
      ring.style.transform=`rotateY(${s.angle+offset}deg)`;
      slots.forEach((card,index)=>{
        card.hidden=index>=s.count;if(card.hidden)return;
        const base=index*s.step,reach=Math.abs(wrap(base+s.angle));
        const introRadius=s.introDone?1:1+.6*(1-easeOut(clamp((s.introTime-(reach/180)*420)/1080,0,1)));
        card.style.transform=`rotateY(${base}deg) translateZ(${R*introRadius}px)`;
        const facing=Math.cos(wrap(base+s.angle+offset)*RAD);
        card.style.setProperty('--cc-depth',(.55*Math.pow((1-facing)/2,1.25)).toFixed(3));
      });
      const active=((Math.round(-s.angle/s.step)%items.length)+items.length)%items.length;
      if(active!==s.active&&s.target===null){s.active=active;onChange(active)}
      publishState();
    }
    function frame(now){
      raf=0;if(!available()){s.last=0;return}
      const dt=s.last?Math.min((now-s.last)/1000,.05):1/60;s.last=now;
      if(!s.introDone){s.introTime+=dt*1000;if(s.introTime>=1500)s.introDone=true}
      const cruise=!paused()&&s.introDone&&now>=s.holdUntil?settings.speed*s.dir:0;
      let busy=!s.introDone||s.drag;
      if(!s.introDone||s.drag){s.velocity=s.drag?s.velocity:0}
      else if(s.target!==null){
        let left=dt;
        while(left>0){const h=Math.min(left,1/240);s.velocity+=(118*(s.target-s.angle)-2*Math.sqrt(118)*s.velocity)*h;s.angle+=s.velocity*h;left-=h}
        if(Math.abs(s.target-s.angle)<.004&&Math.abs(s.velocity)<.03){s.angle=s.target;s.velocity=0;s.target=null}
        busy=true;
      }else{
        s.velocity+=(cruise-s.velocity)*(1-Math.exp(-dt/(.18+settings.momentum*1.5)));s.angle+=s.velocity*dt;
        if(cruise===0&&Math.abs(s.velocity)<9&&Math.abs(nearest(s.angle)-s.angle)>.004)s.target=nearest(s.angle);
        busy=busy||cruise!==0||Math.abs(s.velocity)>.01||s.target!==null;
      }
      const aimYaw=s.pointerInside?s.pointerX*9:0,aimPitch=s.pointerInside?-s.pointerY*6:0;
      const easing=1-Math.exp(-dt/.35);s.yaw+=(aimYaw-s.yaw)*easing;s.pitch+=(aimPitch-s.pitch)*easing;
      busy=busy||Math.abs(aimYaw-s.yaw)>.01||Math.abs(aimPitch-s.pitch)>.01||(!paused()&&now<s.holdUntil);
      render();if(busy&&available())raf=requestAnimationFrame(frame);else s.last=0;
    }
    function wake(){publishState();if(!raf&&available())raf=requestAnimationFrame(frame)}
    function focusProject(index,instant=false){
      let best=Infinity,target=0;
      for(let slot=index;slot<s.count;slot+=items.length){
        let a=-slot*s.step;a+=360*Math.round((s.angle-a)/360);
        if(Math.abs(a-s.angle)<best){best=Math.abs(a-s.angle);target=a}
      }
      s.holdUntil=performance.now()+2800;s.introDone=true;
      if(instant||reduced.matches){s.angle=target;s.target=null;s.velocity=0}else s.target=target;
      s.active=index;render();wake();
    }
    function stepBy(delta){
      s.introDone=true;s.holdUntil=performance.now()+2800;
      const target=(s.target??nearest(s.angle))-delta*s.step;
      if(reduced.matches){s.angle=target;s.target=null;s.velocity=0}else s.target=target;
      render();wake();
    }
    listen(root,'pointerdown',event=>{
      if(!s.enabled||event.button!==0)return;
      s.ignoreClickUntil=0;s.press={id:event.pointerId,x:event.clientX,y:event.clientY,angle:s.angle,moved:false,origin:0,samples:[{time:performance.now(),angle:s.angle}]};wake();
    });
    listen(root,'pointermove',event=>{
      if(!s.enabled)return;
      if(event.pointerType==='mouse'&&fine.matches&&!reduced.matches){
        const rect=root.getBoundingClientRect();s.pointerInside=true;
        s.pointerX=clamp((event.clientX-rect.left)/rect.width*2-1,-1,1);s.pointerY=clamp((event.clientY-rect.top)/rect.height*2-1,-1,1);
      }
      const press=s.press;
      if(press&&press.id===event.pointerId){
        const delta=event.clientX-press.x,cross=event.clientY-press.y;
        if(!press.moved){
          if(Math.abs(delta)<5){wake();return}
          if(Math.abs(cross)>Math.abs(delta)*1.2&&event.pointerType!=='mouse'){s.press=null;wake();return}
          press.moved=true;press.origin=delta;s.drag=true;s.target=null;s.velocity=0;s.introDone=true;
          root.closest('.work-section').classList.add('is-dragging');
          try{root.setPointerCapture(event.pointerId)}catch{}
        }
        if(event.cancelable)event.preventDefault();
        s.angle=press.angle+(delta-press.origin)*180/(Math.PI*s.radius*s.fit);
        const now=performance.now();press.samples.push({time:now,angle:s.angle});
        while(press.samples.length>2&&now-press.samples[0].time>110)press.samples.shift();
      }
      wake();
    });
    function release(event){
      const press=s.press;if(!press||press.id!==event.pointerId)return;
      s.press=null;s.drag=false;root.closest('.work-section').classList.remove('is-dragging');
      if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);
      if(!press.moved){wake();return}
      s.ignoreClickUntil=performance.now()+350;
      const first=press.samples[0],last=press.samples.at(-1),span=(last.time-first.time)/1000;
      const velocity=event.type==='pointercancel'||reduced.matches?0:span>.008?clamp((last.angle-first.angle)/span,-1400,1400):0;
      s.velocity=velocity;if(Math.abs(velocity)>60)s.dir=Math.sign(velocity);
      const coasting=!s.manualPause&&!reduced.matches&&!(s.hover&&event.pointerType==='mouse');
      if(!coasting)s.target=nearest(s.angle+velocity*(.18+settings.momentum*1.5)*.55);
      if(reduced.matches){s.angle=s.target??nearest(s.angle);s.target=null}
      render();wake();
    }
    listen(root,'pointerup',release);listen(root,'pointercancel',release);
    listen(root,'lostpointercapture',event=>{if(event.target===root)release(event)});
    listen(root,'pointerenter',event=>{if(event.pointerType==='mouse'&&fine.matches){s.hover=true;wake()}});
    listen(root,'pointerleave',event=>{if(event.pointerType==='mouse'){s.hover=false;s.pointerInside=false;wake()}});
    listen(root,'dragstart',event=>{if(s.enabled)event.preventDefault()});
    listen(root,'click',event=>{
      if(!s.enabled)return;
      if(performance.now()<s.ignoreClickUntil){event.preventDefault();return}
      const card=event.target.closest('[data-cc-index]');if(!card)return;
      const slot=Number(card.dataset.ccIndex),index=slot%items.length;
      // Selection changes before the focus spring finishes. Test the actual
      // clicked copy's position and speed so a quick repeat tap cannot open
      // a project while its image is still travelling towards the front.
      const centered=s.introDone&&Math.abs(wrap(slot*s.step+s.angle))<1&&Math.abs(s.velocity)<8;
      onChange(index,true);
      if(centered){items[index].click();return}
      focusProject(index);
    });
    listen(root,'wheel',event=>{
      if(!s.enabled||event.ctrlKey||Math.abs(event.deltaX)<=Math.abs(event.deltaY))return;
      event.preventDefault();s.introDone=true;s.target=null;
      const units=event.deltaMode===1?16:event.deltaMode===2?root.clientWidth:1;
      const delta=event.deltaX*units*180/(Math.PI*s.radius*s.fit);
      s.angle-=delta;s.velocity=reduced.matches?0:-delta*30;s.holdUntil=performance.now()+1600;
      clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{s.target=nearest(s.angle+s.velocity*.12);if(reduced.matches){s.angle=s.target;s.target=null}wake()},140);
      render();wake();
    },{passive:false});
    listen(document,'visibilitychange',()=>{if(document.hidden)stop();else wake();publishState()});
    listen(reduced,'change',()=>{s.velocity=0;s.yaw=s.pitch=0;if(reduced.matches){s.introDone=true;s.angle=nearest(s.angle);s.target=null}render();wake()});
    listen(fine,'change',()=>{s.hover=false;s.pointerInside=false;wake()});
    listen(window,'pagehide',event=>{s.away=true;stop();if(!event.persisted)destroy()});
    listen(window,'pageshow',()=>{s.away=false;wake()});
    const resize=new ResizeObserver(measure);resize.observe(root);
    const intersection=new IntersectionObserver(([entry])=>{s.visible=entry.isIntersecting;if(s.visible)wake();else stop();publishState()});intersection.observe(root);
    function destroy(){if(destroyed)return;destroyed=true;stop();abort.abort();resize.disconnect();intersection.disconnect();clearTimeout(wheelTimer);clearTimeout(loadTimer)}
    measure();
    const loaded=items.map(item=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(true);image.onerror=()=>resolve(false);image.src=item.querySelector('img').getAttribute('src')}));
    loadTimer=setTimeout(()=>{if(!destroyed){s.ready=true;root.setAttribute('aria-busy','false');root.dataset.ccImages='pending';wake()}},2400);
    Promise.all(loaded).then(result=>{if(destroyed)return;clearTimeout(loadTimer);s.ready=true;root.setAttribute('aria-busy','false');root.dataset.ccImages=result.every(Boolean)?'ready':'partial';wake()});
    return {
      focusProject,stepBy,resize:measure,
      setEntranceReady(value){s.entranceReady=value;root.dataset.entranceHeld=String(!value);if(value)wake();else{stop();publishState()}},
      setEnabled(value){s.enabled=value;s.hover=false;s.pointerInside=false;s.press=null;s.drag=false;s.velocity=0;root.closest('.work-section').classList.remove('is-dragging');if(value){measure();wake()}else{stop();publishState()}},
      setKeyboardFocus(value){s.focus=value;wake()},
      togglePause(){s.manualPause=!s.manualPause;if(!s.manualPause)s.focus=false;wake()},
      destroy
    };
  };
})();
