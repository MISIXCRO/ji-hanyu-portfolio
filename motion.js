/* Finite editorial timelines. Native WAAPI + IntersectionObserver: no scroll
 * hijacking, continuous JS motion loop, new renderer or runtime dependency. */
(() => {
  'use strict';
  if (!Element.prototype.animate || !window.IntersectionObserver) return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const abort=new AbortController(), groups=[], byRoot=new Map(), animations=new Set();
  const splitCache=new WeakMap();
  const ease='cubic-bezier(.32,0,.18,1)';
  const textPace=.62;
  const mobile=matchMedia('(max-width: 600px)').matches;
  let observer, scrollFrame=0, opening, disposed=false;
  const listen=(target,type,fn,options={})=>target.addEventListener(type,fn,{...options,signal:abort.signal});
  const all=(selector,root=document)=>[...root.querySelectorAll(selector)];
  // Quicker text and shorter waits; image wipes retain their original glide.
  const job=(element,keyframes,delay=0,duration=1200,gate=false,pace=textPace)=>({element,keyframes,delay:delay*textPace,duration:duration*pace,gate});

  function split(heading) {
    if (!heading) return [];
    if (splitCache.has(heading)) return splitCache.get(heading);
    const label=heading.textContent.trim();
    let lines;
    if (heading.matches('.landing-content h1')) lines=[...heading.children];
    else {
      const fragments=[document.createDocumentFragment()];
      [...heading.childNodes].forEach(node=>{
        if (node.nodeName==='BR') fragments.push(document.createDocumentFragment());
        else fragments.at(-1).append(node);
      });
      lines=fragments.map(fragment=>{
        const line=document.createElement('span');line.append(fragment);return line;
      });
      heading.replaceChildren(...lines);
    }
    const types=lines.map(line=>{
      line.classList.add('motion-line');
      const type=document.createElement('span');type.className='motion-type';
      type.append(...line.childNodes);line.append(type);return type;
    });
    // One accessible heading name; the visual line wrappers do not fragment it.
    heading.setAttribute('aria-label',label);
    lines.forEach(line=>line.setAttribute('aria-hidden','true'));
    splitCache.set(heading,types);return types;
  }
  function title(heading,delay=0,hero=false) {
    return split(heading).map((element,i)=>job(element,[
      {transform:`translate3d(0,${hero?118:112}%,0) scaleX(${hero?'.72':'.8'}) rotate(${hero?'2':'1.2'}deg)`},
      {transform:'translate3d(0,0,0) scaleX(1) rotate(0deg)'}
    ],delay+i*(hero?190:145),hero?1850:1450,true));
  }
  function reveal(element,delay=0,distance=58,duration=1250) {
    return element&&job(element,[
      {clipPath:'inset(0 0 100% 0)',transform:`translate3d(0,${mobile?distance*.68:distance}px,0)`},
      {clipPath:'inset(0 0 0% 0)',transform:'translate3d(0,0,0)'}
    ],delay,duration);
  }
  function picture(element,delay=0) {
    return element&&job(element,[
      {clipPath:'inset(0 0 100% 0)',transform:`translate3d(0,${mobile?34:64}px,0) scale(.96)`},
      {clipPath:'inset(0 0 0% 0)',transform:'translate3d(0,0,0) scale(1)'}
    ],delay,1650,false,1);
  }
  function release(group) {
    if (group.released) return;
    group.released=true;
    group.callbacks.splice(0).forEach(fn=>fn());
    group.dependents.forEach(dependent=>{if(dependent.visible)play(dependent)});
  }
  function cleanAnimation(animation) {
    animations.delete(animation);animation.cancel();
  }
  function finish(group) {
    if (group.done) return;
    group.done=true;
    group.animations.forEach(cleanAnimation);
    group.root.dataset.motionState='done';
    group.decoration?.remove();
    observer?.unobserve(group.root);
    release(group);
    if(group===opening)document.documentElement.dataset.openingState='complete';
  }
  function play(group) {
    if (group.started||group.done||disposed) return;
    if (reduced.matches||document.hidden) {finish(group);return}
    if (group.after&&!group.after.released) return;
    group.started=true;group.root.dataset.motionState='running';
    if(group===opening)document.documentElement.dataset.openingState='running';
    group.animations.forEach(animation=>animation.play());
    const gates=group.jobs.flatMap((item,i)=>item.gate?[group.animations[i].finished]:[]);
    if(gates.length)Promise.all(gates).then(()=>release(group)).catch(()=>{});
    Promise.all(group.animations.map(animation=>animation.finished))
      .then(()=>finish(group)).catch(()=>{});
  }
  function register(root,jobs,options={}) {
    if (!root) return null;
    const group={root,jobs:jobs.filter(Boolean),animations:[],callbacks:[],dependents:[],
      after:options.after,visible:false,started:false,done:false,released:false,decoration:options.decoration};
    groups.push(group);byRoot.set(root,group);
    if (group.after)group.after.dependents.push(group);
    root.dataset.motionState='pending';
    if (reduced.matches) {finish(group);return group}
    group.jobs.forEach(item=>{
      const animation=item.element.animate(item.keyframes,{delay:item.delay,duration:item.duration,easing:ease,fill:'both'});
      // Paused first keyframes live only while this script is healthy. Authored
      // CSS stays visible if JS is absent, blocked, or initialization fails.
      animations.add(animation);group.animations.push(animation);
      animation.pause();animation.currentTime=0;
    });
    if(!options.opening)observer.observe(root);
    return group;
  }
  function headingGroup(root,heading,copy=[],after=null) {
    return register(root,[...title(heading),...copy.map((el,i)=>reveal(el,650+i*130,42))],{after});
  }
  function finishPast() {
    scrollFrame=0;
    if(disposed||document.querySelector('dialog[open]'))return;
    if(opening&&!opening.done&&scrollY>32)finish(opening);
    // Fast scrolling / hash jumps may skip an observer's intersecting state.
    const passed=groups.filter(group=>!group.done&&group.root.getClientRects().length&&group.root.getBoundingClientRect().bottom<0);
    passed.forEach(finish);
  }
  function dispose() {
    if(disposed)return;
    groups.forEach(finish);disposed=true;
    observer?.disconnect();abort.abort();cancelAnimationFrame(scrollFrame);
    document.documentElement.classList.remove('motion-enabled');
  }

  try {
    observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        const group=byRoot.get(entry.target);if(!group||group.done)return;
        group.visible=entry.isIntersecting;
        if(entry.isIntersecting)play(group);
        else if(group.started||entry.boundingClientRect.bottom<0)finish(group);
      });
    },{rootMargin:'0px 0px -12% 0px',threshold:0});
    document.documentElement.classList.add('motion-enabled');

    const hero=document.querySelector('.landing-hero');
    const shouldOpen=!location.hash&&scrollY<24&&!reduced.matches&&!document.hidden;
    if(hero) {
      const veil=shouldOpen?document.createElement('div'):null;
      const curtains=[];
      if(veil) {
        veil.className='motion-opening';veil.setAttribute('aria-hidden','true');
        for(let i=0;i<3;i++) {
          const window=document.createElement('div'),panel=document.createElement('div');
          window.className='motion-curtain-window';panel.className='motion-curtain';
          window.append(panel);veil.append(window);
          curtains.push(job(panel,[{transform:'translate3d(0,0,0)'},{transform:'translate3d(0,-102%,0)'}],i*115,1400));
        }
        hero.append(veil);
      }
      opening=register(hero,[...curtains,
        ...title(hero.querySelector('h1'),330,true),
        reveal(hero.querySelector('.landing-kicker'),540,28,1150),
        reveal(hero.querySelector('.landing-description'),1330,45,1300),
        reveal(hero.querySelector('.landing-cta'),1530,35,1150),
        reveal(hero.querySelector('.landing-footer'),1720,25,1050),
        reveal(hero.querySelector('.landing-scroll'),1820,25,1050),
        ...all('.nav>.identity,.nav nav a').map((el,i)=>reveal(el,760+i*75,-25,1000))
      ],{opening:true,decoration:veil});
      if(shouldOpen)play(opening);else {finish(opening);document.documentElement.dataset.openingState=reduced.matches?'still':'skipped'}
    } else {
      const head=document.querySelector('.case-heading');
      if(head) {
        opening=register(head,[...title(head.querySelector('h1'),100,true),
          reveal(head.querySelector('.case-original'),180,28),reveal(head.querySelector('.back'),450,25),
          reveal(head.querySelector('h1+p'),850,35),
          ...all('.nav>.identity,.nav nav a').map((el,i)=>reveal(el,260+i*65,-22,1000))
        ],{opening:true});
        if(shouldOpen)play(opening);else {finish(opening);document.documentElement.dataset.openingState=reduced.matches?'still':'skipped'}
      }
    }

    const work=document.querySelector('#work');
    const works=work&&headingGroup(work,work.querySelector('.work-introduction h2'),[
      work.querySelector('.work-introduction>div>p'),work.querySelector('.work-introduction>p'),
      work.querySelector('.gallery-toolbar'),work.querySelector('.gallery-status'),work.querySelector('.work-meta')]);
    all('.filmstrip>.work').forEach((card,i)=>register(card,[picture(card.querySelector('.work-image'),i*120),
      reveal(card.querySelector('.work-caption'),420+i*120,24)],{after:works}));

    const feature=document.querySelector('#process .section-heading');
    const processHeading=feature&&headingGroup(feature,feature.querySelector('h2'),all(':scope>div',feature));
    const lab=document.querySelector('.fabric-lab');
    if(lab)register(lab,[picture(lab.querySelector('.lab-visual'),100),
      ...all('.lab-content>*',lab).map((el,i)=>reveal(el,380+i*125,38))],{after:processHeading});
    const steps=document.querySelector('.process-line');
    if(steps)register(steps,all(':scope>p',steps).map((el,i)=>reveal(el,i*180,65)),{after:processHeading});

    const about=document.querySelector('#about .section-heading');
    const aboutHeading=about&&headingGroup(about,about.querySelector('h2'),all(':scope>div>*',about));
    const capabilities=document.querySelector('.capabilities');
    if(capabilities)register(capabilities,[...all('dl>div',capabilities).map((el,i)=>reveal(el,i*170,70)),
      reveal(capabilities.querySelector('.support-tools'),600,40)],{after:aboutHeading});
    const education=document.querySelector('.education');
    if(education)register(education,[reveal(education.firstElementChild),
      ...all('.education-facts>p',education).map((el,i)=>reveal(el,180+i*180,64))]);
    const experience=document.querySelector('.experience');
    if(experience)register(experience,[reveal(experience.querySelector('h3')),
      ...all('article',experience).map((el,i)=>reveal(el,180+i*200,62))]);
    const awards=document.querySelector('.awards');
    if(awards)register(awards,[reveal(awards.querySelector('h3')),reveal(awards.querySelector('p'),220)]);
    const contact=document.querySelector('.contact');
    if(contact)register(contact,[...title(contact.querySelector('h2')),
      reveal(contact.querySelector(':scope>div>p'),300,28),reveal(contact.querySelector('.email'),900,45),
      ...all('.contact-links>*',contact).map((el,i)=>reveal(el,1050+i*110,30))]);

    const caseHero=document.querySelector('.case-hero');
    if(caseHero)register(caseHero,[picture(caseHero.querySelector('a'),250)]);
    const brief=document.querySelector('.case-brief');
    if(brief)register(brief,[...title(brief.querySelector('h2')),
      reveal(brief.querySelector(':scope>p'),620,42),
      ...all('dl>div',brief).map((el,i)=>reveal(el,800+i*140,38))]);
    const method=document.querySelector('.case-process');
    if(method)register(method,all(':scope>div',method).map((el,i)=>reveal(el,i*190,85,1500)));
    const drawings=document.querySelector('.gallery-title');
    const drawingsHeading=drawings&&headingGroup(drawings,drawings.querySelector('h2'),all(':scope>p',drawings));
    all('.case-gallery .sheet').forEach((sheet,i)=>register(sheet,[picture(sheet.querySelector('.sheet-open'),(i%2)*130),
      reveal(sheet.querySelector('figcaption'),600+(i%2)*130,28)],{after:drawingsHeading}));
    const next=document.querySelector('.next-project');
    if(next)register(next,[...title(next.querySelector('h2')),
      reveal(next.querySelector('p'),250,28),reveal(next.querySelector(':scope>div>span'),720,30),
      picture(next.querySelector('.next-image'),650)]);

    window.PortfolioMotion={
      whenRevealed(element,callback) {
        const group=byRoot.get(element);
        if(!group||group.released||reduced.matches) {callback();return}
        group.callbacks.push(callback);
      },
      has:element=>byRoot.has(element),
      finish:element=>{const group=byRoot.get(element);if(group)finish(group)}
    };

    listen(window,'scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(finishPast)},{passive:true});
    listen(document,'focusin',event=>{
      // Keyboard users never focus a clipped/translated control.
      groups.forEach(group=>{if(!group.done&&group.root.contains(event.target))finish(group)});
    });
    listen(document,'pointerdown',event=>{
      if(event.target.closest('a,button,.filmstrip')) {
        if(opening&&!opening.done)finish(opening);
        groups.forEach(group=>{if(!group.done&&group.root.contains(event.target))finish(group)});
      }
    },{passive:true});
    listen(window,'hashchange',finishPast);
    listen(reduced,'change',()=>{if(reduced.matches){groups.forEach(finish);document.documentElement.dataset.openingState='still'}});
    listen(document,'visibilitychange',()=>{
      if(document.hidden)groups.filter(group=>group.started&&!group.done).forEach(finish);
    });
    listen(window,'pageshow',event=>{if(event.persisted){groups.forEach(finish);finishPast()}});
    listen(window,'pagehide',event=>{if(event.persisted)groups.forEach(finish);else dispose()});
    finishPast();
  } catch(error) {
    // Enhancement failure must leave a complete, navigable portfolio.
    dispose();window.PortfolioMotion=null;
    document.querySelectorAll('.motion-opening').forEach(element=>element.remove());
    console.warn('Portfolio entrances unavailable; using the composed still.',error);
  }
})();
