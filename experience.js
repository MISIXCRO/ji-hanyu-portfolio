(() => {
  'use strict';
  const RM=matchMedia('(prefers-reduced-motion: reduce)');
  const gallery=document.querySelector('.work-section');
  if(!gallery)return;
  const stage=gallery.querySelector('.filmstrip');
  const cards=[...stage.querySelectorAll('.work')];
  const selectors=[...gallery.querySelectorAll('[data-select-project]')];
  const viewButtons=[...gallery.querySelectorAll('[data-gallery-view]')];
  const status=gallery.querySelector('.gallery-status');
  const immersive=document.querySelector('.gallery-dialog');
  const expand=gallery.querySelector('[data-gallery-expand]');
  const pause=gallery.querySelector('[data-gallery-toggle]');
  const anchor=document.createComment('gallery position');gallery.before(anchor);
  let selected=0,galleryY=0,captionAnimation=null;
  function updateSelection(index,manual=false){
    const previous=selected;selected=(index+cards.length)%cards.length;
    const card=cards[selected];
    cards.forEach((item,i)=>{item.classList.toggle('is-active',i===selected);item.tabIndex=gallery.dataset.view==='space'?-1:0});
    selectors.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===selected)));
    status.firstElementChild.setAttribute('aria-live',manual?'polite':'off');
    gallery.querySelector('.gallery-current-theme').replaceChildren(document.createTextNode(card.dataset.theme+' '),Object.assign(document.createElement('span'),{textContent:card.dataset.year}));
    gallery.querySelector('.gallery-current-title').textContent=card.dataset.title;
    gallery.querySelector('.gallery-current-tools').textContent=card.dataset.tools;
    gallery.querySelector('[data-gallery-position]').textContent=`${String(selected+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;
    gallery.querySelector('.gallery-project-link').href=card.href;
    if(gallery.dataset.view==='space')stage.setAttribute('aria-label',`环形作品画廊，当前${card.dataset.title}。点击图片居中，再次点击进入详情。左右方向键切换，Enter查看项目，空格暂停旋转。`);
    if(previous!==selected&&manual&&!RM.matches){captionAnimation?.cancel();captionAnimation=status.firstElementChild.animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,easing:'ease-out'})}
  }
  const supported=typeof window.createPortfolioCarousel==='function'&&CSS.supports('transform-style','preserve-3d');
  const carousel=supported?window.createPortfolioCarousel({root:stage,items:cards,onChange:updateSelection,onPauseChange:(paused,reduced)=>{
    pause.disabled=reduced;pause.setAttribute('aria-pressed',String(paused));pause.textContent=reduced?'静态浏览':paused?'继续旋转':'暂停旋转';
    pause.setAttribute('aria-label',reduced?'已根据系统偏好停止自动旋转':paused?'继续自动旋转':'暂停自动旋转');
  }}):null;
  if(carousel)gallery.classList.add('has-circular-carousel');
  // Let the editorial headline finish before assembling the cylinder. This
  // gate is optional: a missing motion module keeps the original gallery.
  if(carousel&&window.PortfolioMotion?.has(gallery)){
    carousel.setEntranceReady(false);
    window.PortfolioMotion.whenRevealed(gallery,()=>carousel.setEntranceReady(true));
  }
  function setView(view){
    if(!carousel)view='flat';
    gallery.dataset.view=view;
    viewButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.galleryView===view)));
    cards.forEach(card=>{card.tabIndex=view==='space'?-1:0;card.removeAttribute('aria-hidden')});
    stage.tabIndex=view==='space'?0:-1;
    stage.setAttribute('aria-label',view==='space'?`环形作品画廊，当前${cards[selected].dataset.title}。点击图片居中，再次点击进入详情。左右方向键切换，Enter查看项目，空格暂停旋转。`:'四个精选作品');
    stage.scrollLeft=0;carousel?.setEnabled(view==='space');
  }
  function select(index){
    updateSelection(index,true);carousel?.focusProject(selected);
    if(gallery.dataset.view==='flat'&&stage.scrollWidth>stage.clientWidth)stage.scrollTo({left:cards[selected].offsetLeft-stage.offsetLeft,behavior:RM.matches?'instant':'smooth'});
  }
  selectors.forEach(button=>button.addEventListener('click',()=>select(Number(button.dataset.selectProject))));
  viewButtons.forEach(button=>button.addEventListener('click',()=>setView(button.dataset.galleryView)));
  gallery.querySelector('[data-gallery-prev]').addEventListener('click',()=>{updateSelection(selected-1,true);carousel?.stepBy(-1)});
  gallery.querySelector('[data-gallery-next]').addEventListener('click',()=>{updateSelection(selected+1,true);carousel?.stepBy(1)});
  pause.addEventListener('click',()=>carousel?.togglePause());
  stage.addEventListener('keydown',event=>{
    if(gallery.dataset.view!=='space')return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const delta=event.key==='ArrowRight'?1:-1;updateSelection(selected+delta,true);carousel.stepBy(delta)}
    else if(event.key==='Home'||event.key==='End'){event.preventDefault();select(event.key==='Home'?0:cards.length-1)}
    else if(event.key==='Enter'){event.preventDefault();cards[selected].click()}
    else if(event.key===' '){event.preventDefault();carousel.togglePause()}
  });
  gallery.addEventListener('focusin',event=>{if(event.target.matches(':focus-visible'))carousel?.setKeyboardFocus(true)});
  gallery.addEventListener('pointerdown',()=>carousel?.setKeyboardFocus(false));
  gallery.addEventListener('focusout',()=>queueMicrotask(()=>{if(!gallery.contains(document.activeElement))carousel?.setKeyboardFocus(false)}));
  if(typeof immersive.showModal==='function'){
    expand.addEventListener('click',()=>{
      if(immersive.open){immersive.close();return}
      galleryY=scrollY;immersive.querySelector('[data-gallery-mount]').append(gallery);immersive.showModal();
      document.body.style.position='fixed';document.body.style.top=`-${galleryY}px`;document.body.style.width='100%';
      expand.textContent='退出全屏 ×';expand.focus({preventScroll:true});carousel?.resize();
    });
    immersive.addEventListener('close',()=>{
      anchor.after(gallery);document.body.style.position='';document.body.style.top='';document.body.style.width='';
      window.scrollTo({top:galleryY,behavior:'instant'});expand.textContent='全屏浏览 ↗';carousel?.resize();expand.focus({preventScroll:true});
    });
  }else expand.hidden=true;
  RM.addEventListener('change',()=>{if(RM.matches)setView('flat')});
  gallery.classList.add('is-ready');gallery.querySelector('.gallery-toolbar').hidden=false;status.hidden=false;
  if(!carousel){pause.hidden=true;viewButtons.find(button=>button.dataset.galleryView==='space').disabled=true}
  const requested=new URLSearchParams(location.search).get('project');
  const requestedIndex=cards.findIndex(card=>card.dataset.key===requested);
  updateSelection(requestedIndex<0?0:requestedIndex);
  if(requestedIndex>0)carousel?.focusProject(requestedIndex,true);
  setView(RM.matches?'flat':'space');

  const lab = document.querySelector('.fabric-lab');
  if (lab) {
    const stories = [
      ['张力，如何成为形态？','通过拉伸与不同的固定方式，观察布料的受力与形态。将真实材料中的变化，带入张拉膜建筑的探索。'],
      ['充气，如何撑起空间？','通过充气与包裹的实验，观察柔软材料如何形成体积，再探索充气结构与空间形态的关系。'],
      ['折叠，如何组织变化？','通过折痕与重复单元的手工搭建，观察材料的展开与收拢，探索建筑形态变化的可能。']
    ];
    lab.classList.add('is-ready');
    lab.querySelectorAll('[data-lab-select]').forEach(button => button.addEventListener('click', () => {
      const index = Number(button.dataset.labSelect);
      lab.style.setProperty('--lab-index',String(index));
      lab.dataset.labIndex = String(index);
      lab.querySelectorAll('[data-lab-select]').forEach(item => item.setAttribute('aria-pressed',String(item===button)));
      lab.querySelector('[data-lab-title]').textContent = stories[index][0];
      lab.querySelector('[data-lab-description]').textContent = stories[index][1];
      lab.querySelector('.lab-count').textContent = `${String(index+1).padStart(2,'0')} / 03`;
    }));
  }
})();
