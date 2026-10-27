// Shared behaviour for the case study pages: reveal on scroll, reading progress,
// crisp scaled app screens, annotation pins, step-through flows, before/after slider and count-up numbers.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // reading progress and top bar border
  const top = document.querySelector('.top'), bar = document.querySelector('.progress');
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
    if (top) top.classList.toggle('scrolled', scrollY > 8);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // apps are designed at a fixed width and scaled to fit their frame
  const fit = () => document.querySelectorAll('.scaler').forEach((s) => {
    const app = s.querySelector('.app'); if (!app) return;
    const w = +app.dataset.w || app.offsetWidth;
    // grow past the design height when the content needs it, so nothing is ever cut off
    app.style.width = w + 'px'; app.style.height = 'auto';
    const h = Math.max(+app.dataset.h || 0, app.offsetHeight);
    // a minimum scale keeps dense boards readable on phones; the frame then scrolls sideways instead
    const min = +s.dataset.min || 0, k = Math.max(min, s.clientWidth / w);
    app.style.height = h + 'px';
    app.style.transform = `scale(${k})`; s.style.height = h * k + 'px';
    if (min) {
      s.style.overflowX = k * w > s.clientWidth + 1 ? 'auto' : 'hidden';
      let sz = s.querySelector(':scope > .sizer');
      if (!sz) { sz = document.createElement('div'); sz.className = 'sizer'; sz.style.cssText = 'height:1px;pointer-events:none'; s.appendChild(sz); }
      sz.style.width = k * w + 'px';
    }
    // numbered pins sit on the real elements they describe, so they stay put at any size
    if (s.hasAttribute('data-pins') && s.offsetParent) {
      const box = app.getBoundingClientRect();
      if (!box.width) return;
      app.querySelectorAll('[data-pin]').forEach((t) => {
        const n = t.dataset.pin, r = t.getBoundingClientRect();
        let pin = s.querySelector(`.pin[data-k="${n}"]`);
        if (!pin) { pin = document.createElement('span'); pin.className = 'pin'; pin.dataset.k = n; pin.textContent = n; pin.setAttribute('aria-hidden', 'true'); s.appendChild(pin); }
        const k = box.width / app.offsetWidth;
        pin.style.left = Math.max(14, (r.left - box.left) / k * k - 6) + 'px';
        pin.style.top = Math.max(14, (r.top - box.top) - 6) + 'px';
      });
    }
  });
  addEventListener('resize', fit); fit();
  document.fonts && document.fonts.ready.then(fit);

  // reveal blocks as they enter
  if (!reduced) {
    document.documentElement.classList.add('motion');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.rv, .lanes, [data-count]').forEach((el) => io.observe(el));
  } else document.querySelectorAll('.lanes').forEach((l) => l.classList.add('in'));

  // count numbers up when they appear
  const cio = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return; cio.unobserve(e.target);
    const el = e.target, to = parseFloat(el.dataset.count), from = parseFloat(el.dataset.from || 0), dec = (el.dataset.count.split('.')[1] || '').length;
    if (reduced) { el.textContent = to.toFixed(dec); return; }
    const t0 = performance.now(), dur = 1400;
    const step = (t) => { const k = clamp((t - t0) / dur, 0, 1), e2 = 1 - Math.pow(1 - k, 4); el.textContent = (from + (to - from) * e2).toFixed(dec); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  document.querySelectorAll('[data-count]').forEach((el) => cio.observe(el));

  // hero screen leans toward the pointer and settles as you scroll
  const stage = document.querySelector('.stage'), tilt = stage && stage.querySelector('.tilt');
  if (tilt && !reduced) {
    let mx = 0, my = 0;
    stage.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5; });
    stage.addEventListener('pointerleave', () => { mx = 0; my = 0; });
    (function loop() {
      const r = stage.getBoundingClientRect(), p = clamp(1 - r.top / innerHeight, 0, 1);
      tilt.style.transform = `rotateX(${(1 - p) * 14 - my * 3}deg) rotateY(${mx * 4}deg) translateY(${(1 - p) * 40}px)`;
      requestAnimationFrame(loop);
    })();
  }

  // annotation pins and their notes highlight each other
  document.querySelectorAll('[data-notes]').forEach((group) => {
    const set = (k) => group.querySelectorAll('.pin, .note').forEach((el) => el.classList.toggle('on', k != null && el.dataset.k === k));
    group.addEventListener('pointerover', (e) => { const t = e.target.closest('.pin, .note'); set(t ? t.dataset.k : null); });
    group.addEventListener('pointerleave', () => set(null));
  });

  // step-through flows
  document.querySelectorAll('[data-flow]').forEach((f) => {
    const tabs = [...f.querySelectorAll('.steps button')], panes = [...f.querySelectorAll('.pane')];
    const prev = f.querySelector('[data-prev]'), next = f.querySelector('[data-next]');
    let i = 0;
    const go = (k) => {
      i = clamp(k, 0, tabs.length - 1);
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', j === i); t.tabIndex = j === i ? 0 : -1; });
      panes.forEach((p, j) => p.classList.toggle('on', j === i));
      if (prev) prev.disabled = i === 0; if (next) next.disabled = i === tabs.length - 1;
      tabs[i].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      fit();
    };
    tabs.forEach((t, j) => { t.addEventListener('click', () => go(j)); t.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { go(i + 1); tabs[i].focus(); } if (e.key === 'ArrowLeft') { go(i - 1); tabs[i].focus(); } }); });
    prev && prev.addEventListener('click', () => go(i - 1));
    next && next.addEventListener('click', () => go(i + 1));
    go(0);
  });

  // before / after slider
  document.querySelectorAll('.ba').forEach((b) => {
    const r = b.querySelector('input');
    const set = () => b.style.setProperty('--x', r.value + '%');
    r.addEventListener('input', set); set();
  });
})();

// affinity map: pick a theme to focus it and see what it turned into
document.querySelectorAll('[data-aff]').forEach((a) => {
  const moves = JSON.parse(a.dataset.aff), btns = a.querySelectorAll('.aff-f button'), cols = a.querySelectorAll('.aff-c'), out = a.querySelector('.aff-s p');
  btns.forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.t;
    btns.forEach((x) => x.setAttribute('aria-pressed', x === b));
    a.classList.toggle('f', t !== 'all');
    cols.forEach((c) => c.classList.toggle('on', c.dataset.t === t));
    out.textContent = t === 'all' ? out.dataset.all : moves[+t];
  }));
});
