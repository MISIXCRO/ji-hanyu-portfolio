(() => {
  'use strict';
  const chapters = document.querySelector('.case-chapters');
  if (!chapters) return;
  const back = document.querySelector('.case-heading .back');
  const all = chapters.querySelector('a[href^="index.html"]');
  if (back && all) back.href = all.href;
  const links = [...chapters.querySelectorAll('a[href^="#"]')];
  function mark(id) {
    links.forEach(link => {
      if (link.hash === '#'+id) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }
  links.forEach(link => link.addEventListener('click',()=>mark(link.hash.slice(1))));
  mark('overview');
  const visible = new Set();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry=>entry.isIntersecting?visible.add(entry.target):visible.delete(entry.target));
    const items = [...visible].sort((a,b)=>Math.abs(a.getBoundingClientRect().top-150)-Math.abs(b.getBoundingClientRect().top-150));
    if (items[0]) mark(items[0].id);
  },{rootMargin:'-145px 0px -50% 0px',threshold:0});
  links.forEach(link=>{const target=document.querySelector(link.hash);if(target)observer.observe(target);});
})();
