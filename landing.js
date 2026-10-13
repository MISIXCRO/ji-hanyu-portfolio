(() => {
  'use strict';
  const hero=document.querySelector('.landing-hero');
  if(!hero)return;
  const header=document.querySelector('.nav');
  const links=[...header.querySelectorAll('a[href*="#"]')];
  let observer;
  function observeHero(){
    observer?.disconnect();
    const height=header.getBoundingClientRect().height;
    header.classList.toggle('is-on-hero',hero.getBoundingClientRect().bottom>height+1);
    observer=new IntersectionObserver(entries=>{
      header.classList.toggle('is-on-hero',entries[0].isIntersecting);
    },{rootMargin:`-${height+1}px 0px 0px 0px`,threshold:0});
    observer.observe(hero);
  }
  observeHero();
  new ResizeObserver(observeHero).observe(header);
  const sections=links.map(link=>document.getElementById(link.hash.slice(1))).filter(Boolean);
  const visible=new Set();
  // Mark the visible section without changing native scrolling or anchor links.
  const sectionObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>entry.isIntersecting?visible.add(entry.target):visible.delete(entry.target));
    const nearest=[...visible].sort((a,b)=>Math.abs(a.getBoundingClientRect().top-100)-Math.abs(b.getBoundingClientRect().top-100))[0];
    links.forEach(link=>{
      if(nearest&&link.hash==='#'+nearest.id)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  },{rootMargin:'-100px 0px -35% 0px'});
  sections.forEach(section=>sectionObserver.observe(section));
})();
