(() => {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const dialog = document.querySelector('.lightbox');
  const stage = dialog.querySelector('.lightbox-stage');
  const image = stage.querySelector('img');
  const caption = dialog.querySelector('#lightbox-caption');
  const zoom = dialog.querySelector('[data-zoom]');
  const position = dialog.querySelector('[data-position]');
  const links = Array.from(document.querySelectorAll('[data-lightbox]'));
  const thumbnails = dialog.querySelector('.lightbox-thumbnails');
  const loading = dialog.querySelector('.lightbox-loading');
  let selected = 0;
  let savedY = 0;
  let opener = null;

  function setZoom(active) {
    stage.classList.toggle('is-zoom', active);
    zoom.textContent = active ? '适应屏幕' : '放大';
    zoom.setAttribute('aria-label', active ? '适应屏幕' : '放大图片');
    zoom.setAttribute('aria-pressed', String(active));
    if (!active) stage.scrollTo(0, 0);
  }

  function centerThumbnail() {
    const button = thumbnails.children[selected];
    if (button && dialog.open) thumbnails.scrollTo({left:button.offsetLeft-thumbnails.offsetLeft-(thumbnails.clientWidth-button.offsetWidth)/2,behavior:RM?'instant':'smooth'});
  }

  image.addEventListener('load', () => {
    dialog.classList.remove('is-loading');
    loading.hidden = true;
  });
  image.addEventListener('error', () => {
    dialog.classList.remove('is-loading');
    loading.textContent = '图片载入失败，可点“原图”重试';
    loading.hidden = false;
  });

  thumbnails.hidden = links.length <= 1;
  links.forEach((link, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', link.dataset.caption);
    button.setAttribute('aria-pressed', 'false');
    const preview = document.createElement('img');
    preview.src = link.dataset.thumbnail || link.querySelector('img')?.src || link.href;
    preview.alt = '';
    preview.loading = 'lazy';
    const number = document.createElement('span');
    number.textContent = String(index + 1).padStart(2, '0');
    button.append(preview, number);
    button.addEventListener('click', () => setImage(index));
    thumbnails.append(button);
  });

  function setImage(index) {
    selected = (index + links.length) % links.length;
    const link = links[selected];
    loading.textContent = '正在载入图片…';
    loading.hidden = false;
    dialog.classList.add('is-loading');
    image.src = link.href;
    image.alt = link.dataset.caption;
    caption.textContent = link.dataset.caption;
    dialog.querySelector('[data-original]').href = link.href;
    position.textContent = `${selected + 1} / ${links.length}`;
    setZoom(false);
    Array.from(thumbnails.children).forEach((button,i) => button.setAttribute('aria-pressed', String(i === selected)));
    centerThumbnail();
    if (image.complete && image.naturalWidth > 0) {
      dialog.classList.remove('is-loading');
      loading.hidden = true;
    }
  }

  function unlock() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    const originalScroll = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, savedY);
    document.documentElement.style.scrollBehavior = originalScroll;
    opener?.focus({ preventScroll: true });
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  if (typeof dialog.showModal === 'function') {
    links.forEach((link, index) => link.addEventListener('click', event => {
      event.preventDefault();
      opener = link;
      savedY = window.scrollY;
      setImage(index);
      dialog.showModal();
      requestAnimationFrame(centerThumbnail);
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedY}px`;
      document.body.style.width = '100%';
      dialog.querySelector('[data-close]').focus();
    }));
    dialog.addEventListener('close', unlock);
    dialog.querySelector('[data-close]').addEventListener('click', close);
    dialog.querySelector('[data-prev]').addEventListener('click', () => setImage(selected - 1));
    dialog.querySelector('[data-next]').addEventListener('click', () => setImage(selected + 1));
    dialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); setImage(selected - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); setImage(selected + 1); }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(true); }
      if (event.key === '0' || event.key === '-') { event.preventDefault(); setZoom(false); }
    });
    function toggleZoom() {
      setZoom(!stage.classList.contains('is-zoom'));
    }
    zoom.addEventListener('click', toggleZoom);
    stage.addEventListener('click', event => {
      if (event.target === image) toggleZoom();
      else if (event.target === stage) close();
    });
  }

  let toastTimer;
  function notify(message) {
    const toast = document.querySelector('.toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
  }
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    const value = button.dataset.copy;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
      else {
        const input = document.createElement('textarea');
        input.value = value;
        input.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.append(input);
        input.select();
        const success = document.execCommand('copy');
        input.remove();
        if (!success) throw new Error('Clipboard unavailable');
      }
      notify('邮箱已复制');
    } catch {
      notify('请长按或选中邮箱复制');
    }
  }));
  // Both motion preferences and pointer capability are declared once for all enhancements.
  document.documentElement.dataset.motion = RM ? 'still' : 'enabled';
  document.documentElement.dataset.pointer = FINE ? 'fine' : 'touch';
})();
