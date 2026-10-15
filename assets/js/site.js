/* =============================================================================
   Ultra Corpotech Inc. — site.js
   The motion engine for the site, with no dependencies.

   The inline script in each page's <head> adds .motion only when the visitor
   allows motion (prefers-reduced-motion) and the page is not being captured by
   an automated browser. Without .motion every module renders its final, still
   state, so the page is complete at rest.
   ============================================================================= */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const motion = root.classList.contains('motion');
  const mq = (q) => window.matchMedia(q);
  const finePointer = mq('(hover: hover) and (pointer: fine)').matches;
  window.UCI = { motion };

  /* ---------------------------------------------------------------------------
     Utilities
     ------------------------------------------------------------------------ */
  const $ = (s, c = doc) => c.querySelector(s);
  const $$ = (s, c = doc) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const token = (name) => getComputedStyle(root).getPropertyValue(name).trim();
  const hexToRgb = (hex) => {
    let h = (hex || '#000000').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mixRgb = (a, b, t) => [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
  const safe = (fn) => {
    try {
      fn();
    } catch (err) {
      console.error('[UCI]', err);
    }
  };

  let vw = window.innerWidth;
  let vh = window.innerHeight;

  /* ---------------------------------------------------------------------------
     Ticker: one requestAnimationFrame loop shared by every module
     ------------------------------------------------------------------------ */
  const tasks = new Set();
  let raf = 0;
  let lastT = 0;
  const loop = (now) => {
    const dt = Math.min(0.064, (now - lastT) / 1000 || 0.016);
    lastT = now;
    tasks.forEach((fn) => {
      try {
        fn(dt, now);
      } catch (err) {
        tasks.delete(fn);
        console.error('[UCI]', err);
      }
    });
    raf = tasks.size && !doc.hidden ? requestAnimationFrame(loop) : 0;
  };
  const ticker = {
    add(fn) {
      tasks.add(fn);
      if (!raf && !doc.hidden) {
        lastT = performance.now();
        raf = requestAnimationFrame(loop);
      }
    },
    remove(fn) {
      tasks.delete(fn);
    },
  };
  doc.addEventListener('visibilitychange', () => {
    if (!doc.hidden && tasks.size && !raf) {
      lastT = performance.now();
      raf = requestAnimationFrame(loop);
    }
  });

  const onVisible = (el, cb, margin = '0px') => {
    if (!('IntersectionObserver' in window)) {
      cb(true);
      return null;
    }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => cb(e.isIntersecting)), {
      rootMargin: margin,
    });
    io.observe(el);
    return io;
  };

  /* ---------------------------------------------------------------------------
     Theme and layout hooks
     ------------------------------------------------------------------------ */
  const themeHooks = [];
  const fireTheme = () => themeHooks.forEach(safe);
  const darkQuery = mq('(prefers-color-scheme: dark)');
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', fireTheme);
  new MutationObserver(fireTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  const layoutHooks = [];
  let layoutTimer = 0;
  const relayout = () => {
    vw = window.innerWidth;
    vh = window.innerHeight;
    layoutHooks.forEach(safe);
    measureScrub();
    runScrub(true);
    updateProgress(true);
  };
  const scheduleLayout = () => {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(relayout, 120);
  };

  /* ---------------------------------------------------------------------------
     Scroll engine: scrubbers map an element's position to a 0..1 progress
     ------------------------------------------------------------------------ */
  const scroll = { y: window.scrollY, vel: 0, dir: 1 };
  const scrubs = [];
  const uiHooks = [];

  const addScrub = (el, mode, update, opts = {}) => {
    const s = { el, mode, update, opts, top: 0, h: 0, last: -1 };
    scrubs.push(s);
    return s;
  };

  function measureScrub() {
    const y = window.scrollY;
    scrubs.forEach((s) => {
      const r = s.el.getBoundingClientRect();
      s.top = r.top + y;
      s.h = r.height;
    });
  }

  function progressOf(s, y) {
    const { top, h, opts } = s;
    switch (s.mode) {
      case 'pin':
        return clamp((y - top) / Math.max(1, h - vh));
      case 'enter':
        return clamp((y + vh - top) / (vh * (opts.span || 0.8)));
      case 'center': {
        const a = top - vh * (opts.start ?? 0.85);
        const b = top + h - vh * (opts.end ?? 0.45);
        return clamp((y - a) / Math.max(1, b - a));
      }
      default:
        return clamp((y + vh - top) / (vh + h));
    }
  }

  function runScrub(force) {
    const y = window.scrollY;
    for (let i = 0; i < scrubs.length; i++) {
      const s = scrubs[i];
      const p = progressOf(s, y);
      if (force || Math.abs(p - s.last) > 0.0002) {
        s.last = p;
        try {
          s.update(p);
        } catch (err) {
          console.error('[UCI]', err);
        }
      }
    }
  }

  let idleFrames = 0;
  function scrollTask(dt) {
    const y = window.scrollY;
    const dy = y - scroll.y;
    scroll.vel = lerp(scroll.vel, dy / Math.max(dt, 0.008), 0.2);
    if (dy !== 0) {
      scroll.dir = dy > 0 ? 1 : -1;
      scroll.y = y;
      idleFrames = 0;
      runScrub(false);
      updateProgress(false);
      uiHooks.forEach((fn) => fn(y, dy));
    } else if (++idleFrames > 24 && Math.abs(scroll.vel) < 4) {
      scroll.vel = 0;
      ticker.remove(scrollTask);
    }
  }

  /* Scroll gauge: the green foot bar fixed to the bottom of the viewport */
  let progressEl = null;
  let maxScroll = 1;
  function initProgress() {
    if (!motion) return;
    progressEl = doc.createElement('div');
    progressEl.className = 'progress';
    progressEl.setAttribute('aria-hidden', 'true');
    progressEl.appendChild(doc.createElement('i'));
    doc.body.appendChild(progressEl);
  }
  function updateProgress(remeasure) {
    if (!progressEl) return;
    if (remeasure) maxScroll = Math.max(1, root.scrollHeight - vh);
    progressEl.style.setProperty('--progress', clamp(window.scrollY / maxScroll).toFixed(4));
  }

  /* ---------------------------------------------------------------------------
     Text: split into words (masked push-up, or plain for scroll illumination)
     ------------------------------------------------------------------------ */
  function splitText(el, make) {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const parts = child.textContent.split(/([ \t\n\r\f]+)/);
          const frag = doc.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^[ \t\n\r\f]+$/.test(part)) frag.appendChild(doc.createTextNode(' '));
            else frag.appendChild(make(part, i++));
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR' && !child.classList.contains('sr-only')) {
          walk(child);
        }
      });
    };
    walk(el);
    el.style.setProperty('--n', i);
    return i;
  }
  const maskWord = (word, i) => {
    const w = doc.createElement('span');
    w.className = 'w';
    const wi = doc.createElement('span');
    wi.className = 'wi';
    wi.style.setProperty('--i', i);
    wi.textContent = word;
    w.appendChild(wi);
    return w;
  };
  const plainWord = (word, i) => {
    const s = doc.createElement('span');
    s.className = 'ws';
    s.style.setProperty('--i', i);
    s.textContent = word;
    return s;
  };

  function initText() {
    $$('[data-split]').forEach((el) => {
      if (motion) splitText(el, maskWord);
      el.classList.add('is-split');
    });
    $$('[data-stagger]').forEach((g) => Array.from(g.children).forEach((c, i) => c.style.setProperty('--i', i)));
    $$('.std-grid, .glance').forEach((g) => Array.from(g.children).forEach((c, i) => c.style.setProperty('--i', i)));
    $$('[data-words]').forEach((el) => {
      splitText(el, plainWord);
      if (!motion) return;
      el.style.setProperty('--p', 0);
      addScrub(el, 'center', (p) => el.style.setProperty('--p', p.toFixed(4)), { start: 0.9, end: 0.5 });
    });
  }

  /* Scrambled eyebrow labels resolve letter by letter, like a machine readout */
  const GLYPHS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789+/-';
  function initScramble() {
    $$('[data-scramble]').forEach((el) => {
      const text = el.textContent;
      el.dataset.text = text;
      if (!motion) return;
      el.textContent = '';
      const sr = doc.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = text;
      const vis = doc.createElement('span');
      vis.className = 'scr';
      vis.setAttribute('aria-hidden', 'true');
      vis.textContent = text;
      el.append(sr, vis);
    });
  }
  function runScramble(el) {
    if (!motion || el._scrambled) return;
    const vis = $('.scr', el);
    if (!vis) return;
    el._scrambled = true;
    const text = el.dataset.text;
    const len = text.length;
    const dur = 650 + len * 22;
    const start = performance.now();
    let frame = 0;
    const step = (dt, now) => {
      const t = clamp((now - start) / dur);
      if (frame++ % 2 === 0 || t >= 1) {
        const shown = Math.floor(easeOutCubic(t) * len);
        let out = text.slice(0, shown);
        for (let i = shown; i < len; i++) out += /\s/.test(text[i]) ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        vis.textContent = out;
      }
      if (t >= 1) {
        vis.textContent = text;
        ticker.remove(step);
      }
    };
    ticker.add(step);
  }

  /* Odometers: every digit rolls up through a full turn to its value */
  function initOdometers() {
    $$('[data-odometer]').forEach((el) => {
      const text = el.getAttribute('data-odometer') || el.textContent.trim();
      if (!motion) return;
      el.textContent = '';
      const sr = doc.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = text;
      const vis = doc.createElement('span');
      vis.className = 'odo';
      vis.setAttribute('aria-hidden', 'true');
      let d = 0;
      for (const ch of text) {
        if (/\d/.test(ch)) {
          const mask = doc.createElement('span');
          mask.className = 'odo-mask';
          const col = doc.createElement('span');
          col.className = 'odo-col';
          col.style.setProperty('--d', d++);
          col.dataset.digit = ch;
          col.innerHTML = Array.from({ length: 20 }, (_, k) => `<span>${k % 10}</span>`).join('');
          mask.appendChild(col);
          vis.appendChild(mask);
        } else {
          const s = doc.createElement('span');
          s.className = 'odo-static';
          s.textContent = ch;
          vis.appendChild(s);
        }
      }
      el.append(sr, vis);
    });
  }
  function runOdometer(el) {
    $$('.odo-col', el).forEach((col) => {
      col.style.transform = `translate3d(0, ${-(10 + Number(col.dataset.digit))}em, 0)`;
    });
  }

  /* ---------------------------------------------------------------------------
     Reveals
     ------------------------------------------------------------------------ */
  const REVEAL_SEL = '[data-reveal], [data-split], [data-stagger], [data-odometer], [data-in]';
  const revealHooks = [];

  function reveal(el) {
    if (el.classList.contains('is-in')) return;
    el.classList.add('is-in');
    if (el.hasAttribute('data-odometer')) runOdometer(el);
    $$('[data-odometer]', el).forEach((o) => {
      if (!o.classList.contains('is-in')) {
        o.classList.add('is-in');
        runOdometer(o);
      }
    });
    if (el.hasAttribute('data-scramble')) runScramble(el);
    $$('[data-scramble]', el).forEach(runScramble);
    revealHooks.forEach((fn) => fn(el));
  }

  function observeReveals() {
    const els = $$(REVEAL_SEL).filter((el) => !el.closest('[data-hero]'));
    if (!motion || !('IntersectionObserver' in window)) {
      els.forEach(reveal);
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            reveal(e.target);
            io.unobserve(e.target);
          }
        }),
      { rootMargin: '0px 0px -8% 0px' }
    );
    els.forEach((el) => io.observe(el));
  }

  let heroStarted = false;
  const heroHooks = [];
  function heroStart() {
    if (heroStarted) return;
    heroStarted = true;
    $$('[data-hero]').forEach((hero) => {
      hero.classList.add('is-in');
      $$(`${REVEAL_SEL}, .eyebrow`, hero).forEach(reveal);
    });
    heroHooks.forEach(safe);
    observeReveals();
  }

  /* ---------------------------------------------------------------------------
     Entrance: first-visit intro, or the page curtain lifting off a transition
     ------------------------------------------------------------------------ */
  const INTRO_PUSH_MS = 1450;

  function initEntrance() {
    if (!motion) {
      heroStart();
      return;
    }
    if (root.classList.contains('is-intro')) {
      try {
        sessionStorage.setItem('uci:intro', '1');
      } catch (err) {
        /* storage blocked: the intro simply plays again next time */
      }
      setTimeout(heroStart, INTRO_PUSH_MS + 120);
      const intro = $('.intro');
      if (intro) {
        intro.addEventListener('animationend', (e) => {
          if (e.animationName === 'intro-out') root.classList.remove('is-intro');
        });
      }
      setTimeout(() => root.classList.remove('is-intro'), 3200);
      return;
    }
    if (root.classList.contains('is-entering')) {
      try {
        sessionStorage.removeItem('uci:curtain');
      } catch (err) {
        /* ignore */
      }
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-entered')));
      setTimeout(heroStart, 260);
      setTimeout(() => root.classList.remove('is-entering', 'is-entered'), 1150);
      return;
    }
    heroStart();
  }

  /* Page transitions: the green curtain pushes up over the page, then we leave */
  const PAGE_NAMES = {
    '': 'Home',
    'index.html': 'Home',
    'about.html': 'About',
    'capabilities.html': 'Capabilities',
    'industries.html': 'Industries',
    'contact.html': 'Contact',
  };
  let closeMenu = () => {};

  function initTransitions() {
    if (!motion) return;
    doc.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.getAttribute('href'), window.location.href);
      if (url.origin !== window.location.origin) return;
      const file = url.pathname.split('/').pop();
      if (!(file in PAGE_NAMES)) return;
      if (url.pathname === window.location.pathname) return;
      e.preventDefault();
      const label = PAGE_NAMES[file];
      root.style.setProperty('--curtain-label', JSON.stringify(label));
      try {
        sessionStorage.setItem('uci:curtain', label);
      } catch (err) {
        /* ignore */
      }
      closeMenu();
      root.classList.add('is-leaving');
      setTimeout(() => {
        window.location.href = url.href;
      }, 720);
    });
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) root.classList.remove('is-leaving', 'is-entering', 'is-entered');
    });
  }

  /* ---------------------------------------------------------------------------
     Header, nav indicator and mobile menu
     ------------------------------------------------------------------------ */
  function initHeader() {
    const header = $('.site-header');
    if (!header) return;
    const setScrolled = (y) => header.classList.toggle('is-scrolled', y > 8);
    setScrolled(window.scrollY);
    uiHooks.push((y, dy) => {
      setScrolled(y);
      if (root.classList.contains('menu-open')) return;
      if (y > 260 && dy > 3) header.classList.add('is-hidden');
      else if (dy < -3 || y < 140) header.classList.remove('is-hidden');
    });
    header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

    const nav = $('.nav', header);
    const ind = $('.nav-indicator', header);
    if (!nav || !ind) return;
    nav.classList.add('has-indicator');
    const links = $$('.nav-link', nav);
    const current = links.find((l) => l.getAttribute('aria-current') === 'page');
    const moveTo = (l) => {
      if (!l) {
        ind.style.setProperty('--o', 0);
        return;
      }
      ind.style.setProperty('--x', `${l.offsetLeft}px`);
      ind.style.setProperty('--w', `${l.offsetWidth}px`);
      ind.style.setProperty('--o', 1);
    };
    links.forEach((l) => {
      l.addEventListener('mouseenter', () => moveTo(l));
      l.addEventListener('focus', () => moveTo(l));
      l.addEventListener('blur', () => moveTo(current));
    });
    nav.addEventListener('mouseleave', () => moveTo(current));
    layoutHooks.push(() => moveTo(current));
    moveTo(current);
  }

  function initMenu() {
    const btn = $('.menu-toggle');
    const menu = $('#menu');
    if (!btn || !menu) return;
    const label = $('.menu-toggle-label', btn);
    const set = (open) => {
      root.classList.toggle('menu-open', open);
      btn.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? 'Close' : 'Menu';
      ['main', '.site-footer'].forEach((s) => {
        const el = $(s);
        if (el) el.inert = open;
      });
      if (open) $('.site-header').classList.remove('is-hidden');
    };
    btn.addEventListener('click', () => set(!root.classList.contains('menu-open')));
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.classList.contains('menu-open')) {
        set(false);
        btn.focus();
      }
    });
    const wide = mq('(min-width: 1024px)');
    const onWide = (e) => {
      if (e.matches) set(false);
    };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    closeMenu = () => set(false);
  }

  /* ---------------------------------------------------------------------------
     Buttons: rolling labels, magnetic pull and tilt
     ------------------------------------------------------------------------ */
  function setRollLabel(btn, text) {
    const spans = $$('.roll > span', btn);
    if (spans.length) spans.forEach((s) => (s.textContent = text));
    else btn.textContent = text;
  }
  function initButtons() {
    $$('.btn').forEach((btn) => {
      if (btn.children.length) return;
      const text = btn.textContent.trim();
      btn.textContent = '';
      const roll = doc.createElement('span');
      roll.className = 'roll';
      const a = doc.createElement('span');
      a.textContent = text;
      const b = doc.createElement('span');
      b.textContent = text;
      b.setAttribute('aria-hidden', 'true');
      roll.append(a, b);
      btn.appendChild(roll);
    });
  }

  function initMagnetic() {
    if (!motion || !finePointer) return;
    $$('[data-magnetic]').forEach((el) => {
      const pull = Number(el.dataset.magnetic) || 0.3;
      let rect = null;
      el.addEventListener('pointerenter', () => {
        el.style.transform = '';
        rect = el.getBoundingClientRect();
      });
      el.addEventListener('pointermove', (e) => {
        if (!rect) rect = el.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        el.style.transform = `translate3d(${(dx * pull).toFixed(1)}px, ${(dy * pull * 1.2).toFixed(1)}px, 0)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transform = '';
        rect = null;
      });
    });
  }

  function initTilt() {
    if (!motion || !finePointer) return;
    $$('[data-tilt]').forEach((el) => {
      let rect = null;
      el.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
      el.addEventListener('pointerenter', () => {
        rect = el.getBoundingClientRect();
      });
      el.addEventListener('pointermove', (e) => {
        if (!rect) rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transform = '';
        rect = null;
      });
    });
  }

  /* ---------------------------------------------------------------------------
     Cursor: a precision crosshair; its bracket frame locks onto targets
     ------------------------------------------------------------------------ */
  function initCursor() {
    if (!motion || !finePointer) return;
    const c = doc.createElement('div');
    c.className = 'cursor is-hidden';
    c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<span class="cursor-frame"><i></i><i></i><i></i><i></i></span><span class="cursor-cross"></span>';
    doc.body.appendChild(c);
    root.classList.add('has-cursor');
    const frame = c.firstElementChild;
    const cross = c.lastElementChild;
    const TARGET = 'a, button, select, label, summary, .drop, [data-cursor]';
    const TEXT = 'input:not([type="file"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), textarea';
    let mx = -100;
    let my = -100;
    let fx = -100;
    let fy = -100;
    let fw = 36;
    let fh = 36;
    let target = null;
    let shown = false;
    const task = () => {
      let tx;
      let ty;
      let tw;
      let th;
      if (target && target.isConnected) {
        const r = target.getBoundingClientRect();
        const pad = 8;
        tx = r.left - pad;
        ty = r.top - pad;
        tw = r.width + pad * 2;
        th = r.height + pad * 2;
      } else {
        tw = 36;
        th = 36;
        tx = mx - 18;
        ty = my - 18;
      }
      fx = lerp(fx, tx, 0.24);
      fy = lerp(fy, ty, 0.24);
      fw = lerp(fw, tw, 0.24);
      fh = lerp(fh, th, 0.24);
      cross.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      frame.style.transform = `translate3d(${fx.toFixed(1)}px, ${fy.toFixed(1)}px, 0)`;
      frame.style.width = `${fw.toFixed(1)}px`;
      frame.style.height = `${fh.toFixed(1)}px`;
      if (Math.abs(fx - tx) + Math.abs(fy - ty) + Math.abs(fw - tw) + Math.abs(fh - th) < 0.3 && !target) {
        ticker.remove(task);
      }
    };
    doc.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        mx = e.clientX;
        my = e.clientY;
        if (!shown) {
          shown = true;
          fx = mx - 18;
          fy = my - 18;
          c.classList.remove('is-hidden');
        }
        const el = e.target instanceof Element ? e.target : null;
        const overText = !!(el && el.closest(TEXT));
        c.classList.toggle('is-text', overText);
        target = el && !overText ? el.closest(TARGET) : null;
        c.classList.toggle('is-locked', !!target);
        const tone = el && el.closest('[data-tone]');
        c.classList.toggle('on-dark', !!tone && tone.dataset.tone === 'dark');
        c.classList.toggle('on-light', !!tone && tone.dataset.tone === 'light');
        ticker.add(task);
      },
      { passive: true }
    );
    doc.addEventListener('pointerdown', () => c.classList.add('is-down'));
    doc.addEventListener('pointerup', () => c.classList.remove('is-down'));
    doc.documentElement.addEventListener('mouseleave', () => {
      shown = false;
      c.classList.add('is-hidden');
    });
    window.addEventListener('blur', () => {
      shown = false;
      c.classList.add('is-hidden');
    });
  }

  /* ---------------------------------------------------------------------------
     Marquee: speed and skew follow the scroll; direction follows the scroll
     ------------------------------------------------------------------------ */
  function initMarquees() {
    $$('[data-marquee]').forEach((m) => {
      const track = $('.marquee-track', m);
      if (!track || !motion) return;
      const dir = Number(m.dataset.direction) || -1;
      const unitHTML = track.innerHTML;
      let unitW = 0;
      let x = 0;
      let skew = 0;
      let flow = 1;
      const build = () => {
        track.innerHTML = unitHTML;
        unitW = track.scrollWidth;
        const reps = Math.max(2, Math.ceil((vw * 2) / Math.max(1, unitW)) + 1);
        track.innerHTML = unitHTML.repeat(reps);
      };
      build();
      layoutHooks.push(build);
      const task = (dt) => {
        const v = scroll.vel;
        flow = lerp(flow, scroll.dir, 0.04);
        const speed = 70 + Math.min(1400, Math.abs(v)) * 0.55;
        x += dir * flow * speed * dt;
        if (unitW > 0) x = ((x % unitW) - unitW) % unitW;
        skew = lerp(skew, clamp(-v * 0.0045, -10, 10), 0.12);
        track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
        m.style.setProperty('--skew', `${skew.toFixed(2)}deg`);
      };
      onVisible(m, (v) => (v ? ticker.add(task) : ticker.remove(task)), '120px');
    });
  }

  /* ---------------------------------------------------------------------------
     Pinned sequences
     ------------------------------------------------------------------------ */
  /* Shutter: the green foot bar splits open into the cover photograph */
  function initShutter() {
    const sec = $('[data-shutter]');
    if (!sec || !motion) return;
    const wide = mq('(min-width: 720px)');
    const layout = () => sec.classList.toggle('is-pinned', wide.matches);
    layout();
    layoutHooks.push(layout);
    sec.style.setProperty('--o', 0);
    addScrub(sec, 'pin', (p) => {
      if (!sec.classList.contains('is-pinned')) return;
      sec.style.setProperty('--o', easeInOutCubic(clamp(p / 0.62)).toFixed(4));
      sec.style.setProperty('--hold', clamp((p - 0.62) / 0.38).toFixed(4));
    });
    addScrub(
      sec,
      'enter',
      (p) => {
        if (sec.classList.contains('is-pinned')) return;
        sec.style.setProperty('--o', easeInOutCubic(p).toFixed(4));
        sec.style.setProperty('--hold', 0);
      },
      { span: 0.75 }
    );
  }

  /* Stack: each strip sticks, and the next one pushes up over it */
  function initStack() {
    const stack = $('[data-stack]');
    if (!stack || !motion) return;
    const cards = $$('.stack-card', stack);
    stack.classList.add('is-stacking');
    cards.forEach((c, i) => c.style.setProperty('--i', i));
    const tops = [];
    const layout = () => {
      cards.forEach((c, i) => {
        const h = c.offsetHeight;
        const top = Math.min(i * 14, vh - h);
        tops[i] = top;
        c.style.top = `${top}px`;
      });
    };
    layout();
    layoutHooks.push(layout);
    addScrub(stack, 'through', () => {
      const pos = cards.map((c) => c.getBoundingClientRect().top);
      for (let i = 0; i < cards.length - 1; i++) {
        const stick = tops[i] || 0;
        const cover = clamp(1 - (pos[i + 1] - stick) / Math.max(1, vh - stick));
        cards[i].style.setProperty('--cover', cover.toFixed(3));
      }
    });
  }

  /* Drawing to delivery: vertical scroll drives a horizontal run of steps */
  function initHScroll() {
    const sec = $('[data-hscroll]');
    if (!sec || !motion) return;
    const track = $('.process-track', sec);
    const viewport = $('.process-viewport', sec);
    const rail = $('.rail', sec);
    const counter = $('[data-step-current]', sec);
    const steps = $$('.step', sec);
    const wide = mq('(min-width: 900px)');
    let maxX = 0;
    let current = -1;
    const layout = () => {
      const on = wide.matches;
      sec.classList.toggle('is-pinned', on);
      if (!on) {
        sec.style.height = '';
        track.style.removeProperty('--x');
        steps.forEach((s) => s.classList.add('is-active'));
        return;
      }
      maxX = Math.max(0, track.scrollWidth - viewport.clientWidth);
      sec.style.height = `${Math.round(maxX + vh * 1.15)}px`;
      if (rail) sec.style.setProperty('--rail-w', `${rail.offsetWidth}px`);
    };
    layout();
    layoutHooks.push(layout);
    addScrub(sec, 'pin', (p) => {
      if (!sec.classList.contains('is-pinned')) return;
      const e = clamp((p - 0.04) / 0.92);
      track.style.setProperty('--x', (e * maxX).toFixed(1));
      sec.style.setProperty('--p', e.toFixed(4));
      const idx = Math.min(steps.length - 1, Math.round(e * (steps.length - 1)));
      if (idx !== current) {
        current = idx;
        steps.forEach((s, i) => s.classList.toggle('is-active', i <= idx));
        if (counter) counter.textContent = String(idx + 1).padStart(2, '0');
      }
    });
  }

  /* Process chain: a green line runs down the stages and lights each node */
  function initChain() {
    $$('[data-chain]').forEach((chain) => {
      const stages = $$('.chain-stage', chain);
      if (!motion) {
        stages.forEach((s) => s.classList.add('is-lit'));
        return;
      }
      let marks = [];
      const layout = () => {
        const top = chain.getBoundingClientRect().top + window.scrollY;
        const h = Math.max(1, chain.offsetHeight);
        marks = stages.map((s) => (s.getBoundingClientRect().top + window.scrollY - top + 60) / h);
      };
      layout();
      layoutHooks.push(layout);
      chain.style.setProperty('--p', 0);
      addScrub(
        chain,
        'center',
        (p) => {
          chain.style.setProperty('--p', p.toFixed(4));
          stages.forEach((s, i) => s.classList.toggle('is-lit', p >= marks[i]));
        },
        { start: 0.62, end: 0.62 }
      );
    });
  }

  /* Generic: expose a section's scroll progress as --p for CSS to use */
  function initScrubVars() {
    if (!motion) return;
    $$('[data-scrub]').forEach((el) => {
      const mode = el.dataset.scrub || 'through';
      el.style.setProperty('--p', 0);
      addScrub(el, mode, (p) => el.style.setProperty('--p', p.toFixed(4)), {
        span: Number(el.dataset.span) || 0.8,
      });
    });
  }

  /* ---------------------------------------------------------------------------
     Line icons and illustrations: one stroke weight, ink with a green accent
     ------------------------------------------------------------------------ */
  const SVG = (vb, body) =>
    `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" focusable="false" aria-hidden="true">${body}</svg>`;
  const at = (x, y) => `style="transform-origin:${x}px ${y}px"`;
  const f2 = (n) => Number(n.toFixed(2));
  const gearSvg = (cx, cy, r, n, tooth, cls) => {
    let d = '';
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      d += `M${f2(cx + Math.cos(a) * r)} ${f2(cy + Math.sin(a) * r)}L${f2(cx + Math.cos(a) * (r + tooth))} ${f2(cy + Math.sin(a) * (r + tooth))}`;
    }
    return `<g class="${cls}" ${at(cx, cy)}><circle cx="${cx}" cy="${cy}" r="${r}"/><circle cx="${cx}" cy="${cy}" r="${f2(r * 0.36)}"/><path d="${d}" stroke-width="4" stroke-linecap="butt"/></g>`;
  };

  const ICONS = {
    wind: () => {
      const b = 'M32 23C29.6 16 30.2 8.5 32 3.5C33.8 8.5 34.4 16 32 23Z';
      return SVG('0 0 64 64', `<path d="M30.6 27L29.2 60M33.4 27L34.8 60M24 60H40"/><g class="a-spin" ${at(32, 24)}><path d="${b}"/><path d="${b}" transform="rotate(120 32 24)"/><path d="${b}" transform="rotate(240 32 24)"/></g><circle class="ink-fill" cx="32" cy="24" r="2.6" stroke="none"/>`);
    },
    solar: () =>
      SVG('0 0 64 64', `<g class="a-rays" ${at(47, 14)}><circle cx="47" cy="14" r="5"/><path class="acc" d="M47 3.5v3M47 21.5v3M36.5 14h3M54.5 14h3M39.6 6.6l2.1 2.1M52.3 19.3l2.1 2.1M39.6 21.4l2.1-2.1M52.3 8.7l2.1-2.1"/></g><path d="M5 33H39L50 51H16Z"/><path d="M16.3 33L27.3 51M27.6 33L38.6 51M10.5 42H44.5"/><path d="M33 51V60M24 60H42"/>`),
    power: () =>
      SVG('0 0 64 64', `<path d="M32 5L23 60M32 5L41 60M19 60H45"/><path d="M13 15H51M17 26H47"/><path d="M30.4 15L35.4 26M33.6 15L28.6 26M28.6 26L38.2 43M35.4 26L25.8 43M25.8 43L41 60M38.2 43L23 60"/><path class="acc a-dash" d="M13 15Q6 24-2 22M51 15Q58 24 66 22M17 26Q9 34-2 33M47 26Q55 34 66 33"/>`),
    oil: () =>
      SVG('0 0 64 64', `<path d="M4 58H60"/><path d="M29 58L36 31L43 58M31.4 49H40.6"/><g class="a-nod" ${at(36, 30)}><path d="M12 27.5L57 32.5"/><path d="M12 27.5C6.5 27 5 31.5 7.5 37"/><path d="M55 32.3V44"/></g><circle cx="36" cy="30" r="2"/><path d="M7.5 39V58"/><g class="a-spin" ${at(55, 49)}><circle cx="55" cy="49" r="5"/><path d="M55 49L58.5 45.5"/></g><path d="M50 58L55 49L60 58"/>`),
    metro: () =>
      SVG('0 0 64 64', `<g class="a-bob"><path d="M3 21H44C54 21 60 29 60 37V44H3Z"/><path d="M8 27H16V34H8ZM20 27H28V34H20ZM32 27H40V34H32Z"/><path d="M46 26.5C50.5 27 54 30 55.4 34H46Z"/><path class="acc" d="M3 39H60"/><circle cx="13" cy="48" r="3.5"/><circle cx="23" cy="48" r="3.5"/><circle cx="40" cy="48" r="3.5"/><circle cx="50" cy="48" r="3.5"/></g><path d="M0 54.5H64"/><g class="a-ties"><path d="M2 59H8M14 59H20M26 59H32M38 59H44M50 59H56M62 59H68M74 59H80"/></g>`),
    loco: () => {
      const wheel = (x) => `<g class="a-spin-fast" ${at(x, 49)}><circle cx="${x}" cy="49" r="6"/><path d="M${x} 43V55M${x - 6} 49H${x + 6}"/></g>`;
      return SVG('0 0 64 64', `<path d="M4 42V27H42V15H60V42Z"/><path d="M46 19H56V26H46Z"/><path d="M9 32H37M9 36H37"/><path d="M12 27V21H18V27"/><path class="acc" d="M4 42H60"/>${wheel(14)}${wheel(31)}${wheel(50)}<path d="M0 56H64"/>`);
    },
    mining: () => {
      const wheel = (x) => `<g class="a-spin" ${at(x, 48)}><circle cx="${x}" cy="48" r="8"/><circle cx="${x}" cy="48" r="2.5"/><path d="M${x} 41V44M${x} 52V55M${x - 7} 48H${x - 4}M${x + 4} 48H${x + 7}"/></g>`;
      return SVG('0 0 64 64', `<g class="a-bob"><path d="M3 17L41 17L37 35H3Z"/><path class="acc" d="M9 17L13 11L18 14L23 8.5L29 12.5L35 17"/><path d="M41 24H50L58 33V40H36"/><path d="M44 27H49L53.5 32H44Z"/><path d="M3 40H58"/></g>${wheel(16)}${wheel(47)}<path d="M0 58H64"/>`);
    },
    construction: () =>
      SVG('0 0 64 64', `<path d="M7 51H39C43 51 43 59 39 59H7C3 59 3 51 7 51Z"/><circle cx="9" cy="55" r="1.5"/><circle cx="23" cy="55" r="1.5"/><circle cx="37" cy="55" r="1.5"/><path d="M8 51V40H32V51"/><path d="M11 40V29H22L26 40"/><g class="a-swing" ${at(31, 41)}><path d="M31 41L44 19L57 29"/><path class="acc" d="M57 29L59 40H50Z"/><circle cx="44" cy="19" r="1.6"/></g>`),
    industrial: () => SVG('0 0 64 64', gearSvg(24, 37, 13, 10, 5, 'a-spin-slow') + gearSvg(45, 19, 8, 7, 4, 'a-rev')),
    telecom: () =>
      SVG('0 0 64 64', `<path d="M32 21L24 60M32 21L40 60M20 60H44"/><path d="M26.5 48H37.5M28.6 38H35.4M26.5 48L35.4 38M37.5 48L28.6 38M24.8 56L37.5 48M39.2 56L26.5 48"/><circle cx="32" cy="17" r="3"/><path class="acc a-pulse" d="M25 10A10 10 0 0 0 25 24M39 10A10 10 0 0 1 39 24"/><path class="acc a-pulse d1" d="M20.5 5A16 16 0 0 0 20.5 29M43.5 5A16 16 0 0 1 43.5 29"/><path class="acc a-pulse d2" d="M16 0A22 22 0 0 0 16 34M48 0A22 22 0 0 1 48 34"/>`),
    rfq: () =>
      SVG('0 0 64 64', `<path d="M13 5H39L51 17V59H13Z"/><path d="M39 5V17H51"/><path class="a-write" pathLength="30" d="M20 28H44"/><path class="a-write d1" pathLength="30" d="M20 36H44"/><path class="a-write d2" pathLength="30" d="M20 44H36"/><path class="acc" d="M20 52H44M20 49V55M44 49V55"/>`),
    review: () =>
      SVG('0 0 64 64', `<path d="M5 9H49V47H5Z"/><path class="acc" d="M27 13V43M9 28H45" stroke-dasharray="4 3"/><circle cx="27" cy="28" r="8"/><g class="a-scan"><circle cx="41" cy="39" r="10"/><path d="M48.5 46.5L58 56"/></g>`),
    article: () =>
      SVG('0 0 64 64', `<path d="M4 12H60V20H4Z"/><path d="M18 12V16M24 12V15M30 12V16M36 12V15M42 12V16M48 12V15M54 12V16"/><path d="M8 20V46L14 40V20"/><circle cx="22" cy="36" r="8"/><g class="a-jaw"><path d="M48 20V46L42 40V20"/><path d="M42 24H54"/></g><path class="acc a-tick" pathLength="24" d="M24 55L29 60L39 50"/>`),
    production: () => SVG('0 0 64 64', gearSvg(30, 36, 14, 12, 6, 'a-spin-slow') + '<path class="acc a-pulse" d="M50 12L55 5M54 17L62 14M45 8V1"/>'),
    delivery: () => {
      const wheel = (x) => `<g class="a-spin-fast" ${at(x, 46)}><circle cx="${x}" cy="46" r="5"/><path d="M${x} 41V51M${x - 5} 46H${x + 5}"/></g>`;
      return SVG('0 0 64 64', `<g class="a-drive"><path d="M3 18H38V41H3Z"/><path d="M38 25H49L57 34V41H38"/><path d="M42 28H48L52 33H42Z"/>${wheel(13)}${wheel(47)}</g><path d="M0 53H64"/><g class="a-road"><path class="acc" d="M0 58H10M24 58H34M48 58H58M72 58H82M96 58H106M120 58H130"/></g>`);
    },
    truck: () => {
      const wheel = (x) => `<g class="a-spin-fast" ${at(x, 34)}><circle cx="${x}" cy="34" r="5"/><path d="M${x} 29V39M${x - 5} 34H${x + 5}"/></g>`;
      return SVG('0 0 88 40', `<path class="bg-fill" d="M3 6H52V29H3Z"/><path class="bg-fill" d="M52 13H66L76 23V29H52Z"/><path d="M57 16H65L70 22H57Z"/>${wheel(16)}${wheel(36)}${wheel(66)}`);
    },
    quality: () => {
      let d = '';
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * Math.PI * 2 - Math.PI / 2;
        const r = k % 2 ? 19 : 23;
        d += `${k ? 'L' : 'M'}${f2(32 + Math.cos(a) * r)} ${f2(27 + Math.sin(a) * r)}`;
      }
      return SVG('0 0 64 64', `<path d="M23 47L18 62L26 58L30 63L32 50M41 47L46 62L38 58L34 63L32 50"/><path class="bg-fill" d="${d}Z"/><path class="acc a-tick" pathLength="24" d="M23 27L29 33L41 21"/>`);
    },
    gantry: () =>
      SVG('0 0 64 64', `<path d="M6 60V12H58V60M1 60H11M53 60H63"/><path d="M6 19H58" stroke-opacity=".45"/><g class="a-trolley"><path class="a-rope" ${at(32, 18)} d="M32 18V34"/><path class="bg-fill" d="M25 12H39V18H25Z"/><g class="a-hoist"><path class="acc" d="M25 34H39V46H25Z"/></g></g>`),
    cost: () =>
      SVG('0 0 64 64', `<path class="a-converge" d="M6 12C22 12 24 32 40 32M6 32H40M6 52C22 52 24 32 40 32"/><circle class="ink-fill" cx="6" cy="12" r="3" stroke="none"/><circle class="ink-fill" cx="6" cy="32" r="3" stroke="none"/><circle class="ink-fill" cx="6" cy="52" r="3" stroke="none"/><path class="acc" d="M40 32H58M51 25L58 32L51 39"/><path d="M40 25V39M33 32H47"/>`),
    people: () => {
      const p = (x, cls) => `<g class="a-wave ${cls}"><circle cx="${x}" cy="22" r="6"/><path d="M${x - 10} 46C${x - 10} 36 ${x - 6} 32 ${x} 32C${x + 6} 32 ${x + 10} 36 ${x + 10} 46"/></g>`;
      return SVG('0 0 64 64', `${p(14, '')}${p(32, 'd1')}${p(50, 'd2')}<path class="acc" d="M2 52H62"/>`);
    },
  };

  const ARTS = {
    weld: () => {
      let bead = 'M44 158';
      for (let x = 44; x < 276; x += 8) bead += 'q4 -7 8 0';
      const sparks = Array.from({ length: 10 }, (_, i) => {
        const a = -172 + i * 17 + ((i * 37) % 9);
        const l = 24 + ((i * 13) % 26);
        return `<path class="acc a-spark" d="M0 0H9" style="--a:${a}deg;--l:${l}px;--t:-${(i * 0.045).toFixed(3)}s"/>`;
      }).join('');
      return SVG('0 0 320 220', `<path d="M20 160H300V184H20Z"/><path d="M44 72H276V160H44Z"/><path d="M60 88H260" stroke-opacity=".35"/><path class="acc a-bead" pathLength="100" d="${bead}"/><g class="a-torch"><g transform="translate(44 154)"><path class="bg-fill" d="M-3 -8L-40 -66L-26 -75L6 -14Z"/><path d="M-33 -71L-56 -108"/><path d="M-16 -30L-6 -36"/>${sparks}<circle class="acc-fill" r="4" stroke="none"/></g></g>`);
    },
    lathe: (uid) => {
      const id = `lathe-clip-${uid}`;
      let stripes = '';
      for (let y = 46; y <= 174; y += 12) stripes += `M84 ${y}H272`;
      const chips = [0, 1, 2]
        .map((i) => `<path class="acc a-chip" d="M0 -2q-6 -2 -8 4q-1 5 4 6" style="--dx:${-10 - i * 9}px;--t:-${(i * 0.3).toFixed(1)}s"/>`)
        .join('');
      return SVG('0 0 320 220', `<defs><clipPath id="${id}"><rect x="84" y="72" width="188" height="76"/></clipPath></defs><path d="M18 34H66V186H18Z"/><path d="M30 52H54M30 168H54" stroke-opacity=".5"/><path d="M66 58H84V162H66Z"/><path d="M84 72H272M84 148H272"/><ellipse cx="272" cy="110" rx="9" ry="38"/><g clip-path="url(#${id})"><g class="a-stripe"><path d="${stripes}" stroke-opacity=".45"/></g></g><g class="a-feed"><g transform="translate(236 148)"><path class="acc" d="M0 0L-9 18H11Z"/><path class="bg-fill" d="M-15 18H33V54H-15Z"/>${chips}</g></g><path d="M8 200H312"/>`);
    },
    spray: () => {
      const drops = Array.from({ length: 16 }, (_, i) => {
        const dy = -50 + ((i * 41) % 100);
        const dx = 84 + ((i * 17) % 24);
        const r = 1.6 + (i % 3) * 0.9;
        return `<circle class="acc-fill a-mist" r="${r.toFixed(1)}" stroke="none" style="--dx:${dx}px;--dy:${dy}px;--t:-${(i * 0.075).toFixed(3)}s"/>`;
      }).join('');
      return SVG('0 0 320 220', `<path d="M150 16H312"/><path d="M232 16V34M222 34H242"/><path d="M192 34H272V198H192Z"/><rect class="acc-fill a-coat" ${at(232, 35)} x="193" y="35" width="78" height="162" stroke="none" fill-opacity=".38"/><g transform="translate(78 112)"><path d="M-60 -16H8V8H-60Z"/><path d="M8 -8H26V0H8Z"/><path d="M-44 8L-52 50H-34L-28 8"/><path d="M-22 8C-20 18 -26 24 -32 22"/><path d="M-40 -16V-30H-20V-16"/><g transform="translate(26 -4)">${drops}</g></g>`);
    },
    caliper: () => {
      let ticks = '';
      for (let x = 76; x <= 292; x += 9) ticks += `M${x} 56V${(x - 76) % 45 === 0 ? 44 : 50}`;
      return SVG('0 0 320 220', `<path d="M30 56H300V80H30Z"/><path d="${ticks}"/><path d="M44 80V176L66 154V80"/><circle cx="100" cy="122" r="34"/><circle cx="100" cy="122" r="12"/><g class="a-slide"><path class="bg-fill" d="M184 48H232V88H184Z"/><path d="M192 88V154L214 176V88"/><path class="acc" d="M216 62H226M221 57V67"/></g><path class="acc a-check" pathLength="60" d="M236 160L252 176L286 142"/>`);
    },
    truck: () => {
      const wheel = (x) => `<g class="a-spin-fast" ${at(x, 164)}><circle class="bg-fill" cx="${x}" cy="164" r="16"/><circle cx="${x}" cy="164" r="5"/><path d="M${x} 148V155M${x} 173V180M${x - 16} 164H${x - 9}M${x + 9} 164H${x + 16}"/></g>`;
      const speed = [0, 1, 2]
        .map((i) => `<path class="acc a-speed" d="M0 ${84 + i * 22}H${30 - i * 8}" style="--t:-${(i * 0.3).toFixed(1)}s"/>`)
        .join('');
      let road = '';
      for (let x = 0; x <= 384; x += 48) road += `M${x} 198H${x + 24}`;
      return SVG('0 0 320 220', `<g class="a-drive"><g class="a-bob"><path class="bg-fill" d="M44 60H214V150H44Z"/><path d="M86 60V150M128 60V150M170 60V150" stroke-opacity=".5"/><path class="bg-fill" d="M214 84H256L290 120V150H214Z"/><path d="M226 94H252L276 120H226Z"/><path class="acc" d="M44 140H290"/></g>${wheel(84)}${wheel(124)}${wheel(256)}${speed}</g><path d="M0 182H320"/><g class="a-road"><path class="acc" d="${road}"/></g>`);
    },
    windfarm: () => {
      const turbine = (x, base, h, s, d) => {
        const hy = base - h;
        const b = `M${x} ${hy}C${f2(x - s * 0.12)} ${f2(hy - s * 0.35)} ${f2(x - s * 0.06)} ${f2(hy - s * 0.75)} ${x} ${hy - s}C${f2(x + s * 0.1)} ${f2(hy - s * 0.72)} ${f2(x + s * 0.14)} ${f2(hy - s * 0.35)} ${x} ${hy}Z`;
        return `<path d="M${x - 2.5} ${hy + 5}L${x - 5} ${base}M${x + 2.5} ${hy + 5}L${x + 5} ${base}"/><g class="a-blade" style="transform-origin:${x}px ${hy}px;--s:${d}s"><path d="${b}"/><path d="${b}" transform="rotate(120 ${x} ${hy})"/><path d="${b}" transform="rotate(240 ${x} ${hy})"/></g><circle class="ink-fill" cx="${x}" cy="${hy}" r="4" stroke="none"/>`;
      };
      const gusts = [0, 1, 2]
        .map((i) => `<path class="acc a-gust" d="M${-10 + i * 30} ${44 + i * 28}C${60 + i * 20} ${32 + i * 28} ${120 + i * 20} ${56 + i * 28} ${210 + i * 30} ${40 + i * 28}" style="--t:-${(i * 0.8).toFixed(1)}s"/>`)
        .join('');
      return SVG('0 0 320 220', `${gusts}${turbine(90, 212, 120, 66, 4.6)}${turbine(204, 212, 92, 50, 3.6)}${turbine(282, 212, 64, 34, 2.9)}<path d="M0 212H320"/>`);
    },
    train: () => {
      const W = 284;
      const G = 14;
      const wheel = (cx) => `<g class="a-spin-fast" ${at(cx, 104)}><circle cx="${cx}" cy="104" r="9"/><path d="M${cx} 95V113M${cx - 9} 104H${cx + 9}"/></g>`;
      const car = (x, i) => {
        const nose = i === 0;
        const body = nose ? `M${x + W} 22H${x + 56}C${x + 20} 22 ${x} 52 ${x} 80V96H${x + W}Z` : `M${x} 22H${x + W}V96H${x}Z`;
        let win = '';
        for (let wx = x + (nose ? 72 : 22); wx + 30 <= x + W - 14; wx += 46) win += `M${wx} 36H${wx + 30}V58H${wx}Z`;
        const shield = nose ? `<path d="M${x + 12} 60C${x + 18} 42 ${x + 30} 36 ${x + 50} 36V60Z"/>` : '';
        const panto = i === 1 ? `<path d="M${x + 112} 22L${x + 132} 6L${x + 152} 22M${x + 120} 6H${x + 144}"/>` : '';
        return `<path class="bg-fill" d="${body}"/><path d="${win}"/>${shield}<path class="acc" d="M${x + (nose ? 4 : 0)} 74H${x + W}"/>${panto}${[x + 40, x + 74, x + W - 74, x + W - 40].map(wheel).join('')}`;
      };
      const cars = [0, 1, 2].map((i) => car(i * (W + G), i)).join('');
      const couplers = [1, 2].map((i) => `<path d="M${i * (W + G) - G} 84H${i * (W + G)}"/>`).join('');
      return SVG(`0 0 ${3 * W + 2 * G} 114`, cars + couplers);
    },
    beam: () => SVG('0 0 120 96', '<path class="draw-on" pathLength="100" d="M8 8H112V22H67V74H112V88H8V74H53V22H8Z"/>'),
  };

  function initIcons() {
    let uid = 0;
    $$('[data-icon]').forEach((host) => {
      const make = ICONS[host.dataset.icon];
      if (!make) return;
      host.innerHTML = make(++uid);
      host.classList.add('ico-host');
    });
    $$('[data-art]').forEach((host) => {
      const make = ARTS[host.dataset.art];
      if (!make) return;
      host.innerHTML = make(++uid);
      host.classList.add('art-host');
    });
    const hosts = $$('.ico-host, .art-host');
    if (!motion || !('IntersectionObserver' in window)) {
      hosts.forEach((h) => h.classList.add('is-playing'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.target.classList.toggle('is-playing', e.isIntersecting)),
      { rootMargin: '80px' }
    );
    hosts.forEach((h) => io.observe(h));
  }

  /* ---------------------------------------------------------------------------
     Canvas helpers
     ------------------------------------------------------------------------ */
  const fitCanvas = (canvas, box) => {
    const r = (box || canvas).getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    return { w, h, dpr };
  };

  /* Plus field: the cover's plus grid, live. Crosses near the pointer turn,
     grow and go green; a slow diagonal sweep keeps it alive on touch screens. */
  function PlusField(canvas) {
    const host = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let pitch = 48;
    let cols = 0;
    let rows = 0;
    let ox = 0;
    let oy = 0;
    let colors = null;
    const readColors = () => {
      colors = { base: hexToRgb(token('--line')), hot: hexToRgb(token('--green')) };
    };
    const ptr = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, amp: 0, tamp: 0 };
    const ripples = [];
    const t0 = performance.now();
    let running = false;

    const resize = () => {
      ({ w, h, dpr } = fitCanvas(canvas, host));
      pitch = w < 700 ? 40 : 48;
      cols = Math.ceil(w / pitch) + 1;
      rows = Math.ceil(h / pitch) + 1;
      ox = (w - (cols - 1) * pitch) / 2;
      oy = (h - (rows - 1) * pitch) / 2;
      if (!running) draw(0, performance.now());
    };

    function draw(dt, now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const t = (now - t0) / 1000;
      ptr.x = lerp(ptr.x, ptr.tx, 0.16);
      ptr.y = lerp(ptr.y, ptr.ty, 0.16);
      ptr.amp = lerp(ptr.amp, ptr.tamp, 0.06);
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].t += dt;
        if (ripples[i].t > 2.4) ripples.splice(i, 1);
      }
      const R = 220;
      const sweep = motion ? ((t % 10) / 10) * (w * 0.6 + h + 700) - 350 : -1e5;
      const hot = [];
      ctx.beginPath();
      for (let j = 0; j < rows; j++) {
        const y = oy + j * pitch;
        for (let i = 0; i < cols; i++) {
          const x = ox + i * pitch;
          let k = 0;
          if (ptr.amp > 0.01) {
            const d = Math.hypot(x - ptr.x, y - ptr.y);
            if (d < R) k = ptr.amp * (1 - smoothstep(0, R, d));
          }
          const sd = Math.abs(x * 0.6 + y - sweep);
          if (sd < 130) k = Math.max(k, 0.38 * (1 - sd / 130));
          for (let r = 0; r < ripples.length; r++) {
            const rp = ripples[r];
            const dd = Math.abs(Math.hypot(x - rp.x, y - rp.y) - rp.t * 640);
            if (dd < 80) k = Math.max(k, (1 - dd / 80) * (1 - rp.t / 2.4));
          }
          if (k < 0.03) {
            ctx.rect(x - 6, y - 1, 12, 2);
            ctx.rect(x - 1, y - 6, 2, 12);
          } else {
            hot.push(x, y, k);
          }
        }
      }
      ctx.fillStyle = rgba(colors.base);
      ctx.fill();
      for (let n = 0; n < hot.length; n += 3) {
        const k = hot[n + 2];
        const arm = 6 * (1 + k * 0.9);
        ctx.save();
        ctx.translate(hot[n], hot[n + 1]);
        ctx.rotate((k * Math.PI) / 4);
        ctx.fillStyle = rgba(mixRgb(colors.base, colors.hot, Math.min(1, k * 1.5)));
        ctx.fillRect(-arm, -1, arm * 2, 2);
        ctx.fillRect(-1, -arm, 2, arm * 2);
        ctx.restore();
      }
    }

    readColors();
    resize();
    layoutHooks.push(resize);
    themeHooks.push(() => {
      readColors();
      if (!running) draw(0, performance.now());
    });
    if (!motion) return { ripple() {} };

    host.addEventListener(
      'pointermove',
      (e) => {
        const r = canvas.getBoundingClientRect();
        ptr.tx = e.clientX - r.left;
        ptr.ty = e.clientY - r.top;
        if (ptr.amp < 0.02) {
          ptr.x = ptr.tx;
          ptr.y = ptr.ty;
        }
        ptr.tamp = 1;
      },
      { passive: true }
    );
    host.addEventListener('pointerleave', () => {
      ptr.tamp = 0;
    });
    const ripple = (x, y) => ripples.push({ x, y, t: 0 });
    host.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button, input, textarea, select, label')) return;
      const r = canvas.getBoundingClientRect();
      ripple(e.clientX - r.left, e.clientY - r.top);
    });
    onVisible(canvas, (v) => {
      running = v;
      if (v) ticker.add(draw);
      else ticker.remove(draw);
    });
    return {
      ripple(x, y) {
        ripple(x ?? w * 0.32, y ?? h * 0.45);
      },
    };
  }

  /* Gears: two meshing spur gears in 3D wireframe, drawn like a CAD model.
     They assemble on load, follow the pointer and spin faster with the scroll. */
  function Gears(canvas) {
    const ctx = canvas.getContext('2d');
    const makeGear = (N, rp, t) => {
      const m = (2 * rp) / N;
      const ro = rp + m;
      const rr = rp - 1.25 * m;
      const step = (Math.PI * 2) / N;
      const pts = [];
      const tips = [];
      for (let k = 0; k < N; k++) {
        const a = k * step;
        pts.push([rr, a]);
        tips.push(pts.length);
        pts.push([ro, a + 0.16 * step]);
        tips.push(pts.length);
        pts.push([ro, a + 0.46 * step]);
        pts.push([rr, a + 0.62 * step]);
        pts.push([rr, a + 0.81 * step]);
      }
      return { N, t, step, outline: pts.map(([r, a]) => [r * Math.cos(a), r * Math.sin(a)]), tips };
    };
    const circle = (r, n, cx = 0, cy = 0) =>
      Array.from({ length: n }, (_, k) => {
        const a = (k / n) * Math.PI * 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
    const g1 = makeGear(24, 1, 0.26);
    const g2 = makeGear(12, 0.5, 0.26);
    const holes1 = Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      return circle(0.15, 28, 0.6 * Math.cos(a), 0.6 * Math.sin(a));
    });
    const bore1 = circle(0.17, 32);
    const hub1 = circle(0.3, 40);
    const bore2 = circle(0.1, 24);
    const hub2 = circle(0.2, 32);
    const theta = -0.42;
    const c1 = [-0.43, 0.06];
    const c2 = [c1[0] + 1.5 * Math.cos(theta), c1[1] + 1.5 * Math.sin(theta)];
    const phi1 = theta - 0.31 * g1.step;
    const phi2 = theta + Math.PI - 0.81 * g2.step;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let scale = 1;
    let drive = 0;
    let rx = -0.62;
    let ry = 0.5;
    let mx = 0;
    let my = 0;
    let assembled = motion ? 0 : 1;
    let assembleFrom = 0;
    let started = !motion;
    let running = false;
    let colors = null;
    let cxs = 1;
    let sxs = 0;
    let cys = 1;
    let sys = 0;
    const tmp = [0, 0];

    const readColors = () => {
      colors = {
        front: hexToRgb(token('--draw')),
        back: hexToRgb(token('--line-strong')),
        ink: hexToRgb(token('--ink')),
      };
    };
    const project = (x, y, z) => {
      const x1 = x * cys + z * sys;
      const z1 = -x * sys + z * cys;
      const y1 = y * cxs - z1 * sxs;
      const z2 = y * sxs + z1 * cxs;
      const f = 6 / (6 + z2);
      tmp[0] = w * 0.5 + x1 * f * scale;
      tmp[1] = h * 0.5 + y1 * f * scale;
      return tmp;
    };
    const strokePath = (pts, cx, cy, phi, z, color, width, reveal) => {
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      let len = 0;
      let px = 0;
      let py = 0;
      ctx.beginPath();
      for (let i = 0; i <= pts.length; i++) {
        const p = pts[i % pts.length];
        const q = project(cx + p[0] * c - p[1] * s, cy + p[0] * s + p[1] * c, z);
        if (i) {
          ctx.lineTo(q[0], q[1]);
          len += Math.hypot(q[0] - px, q[1] - py);
        } else {
          ctx.moveTo(q[0], q[1]);
        }
        px = q[0];
        py = q[1];
      }
      ctx.setLineDash(reveal < 1 ? [len * reveal, len] : []);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    const drawGear = (g, holes, bore, hub, cx, cy, phi, z0, e) => {
      const half = g.t / 2;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      strokePath(g.outline, cx, cy, phi, z0 - half, rgba(colors.back, 0.32 * e), 1, e);
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let i = 0; i < g.tips.length; i++) {
        const p = g.outline[g.tips[i]];
        const x = cx + p[0] * c - p[1] * s;
        const y = cy + p[0] * s + p[1] * c;
        const a = project(x, y, z0 + half);
        const ax = a[0];
        const ay = a[1];
        const b = project(x, y, z0 - half);
        ctx.moveTo(ax, ay);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.strokeStyle = rgba(colors.back, 0.28 * e);
      ctx.lineWidth = 1;
      ctx.stroke();
      strokePath(g.outline, cx, cy, phi, z0 + half, rgba(colors.front, e), 1.6, e);
      holes.forEach((hp) => strokePath(hp, cx, cy, phi, z0 + half, rgba(colors.front, 0.85 * e), 1.3, e));
      strokePath(bore, cx, cy, phi, z0 + half, rgba(colors.front, e), 1.3, e);
      strokePath(hub, cx, cy, phi, z0 + half, rgba(colors.back, 0.55 * e), 1, e);
      ctx.setLineDash([]);
      const o = project(cx, cy, z0 + half);
      const ox = o[0];
      const oy = o[1];
      ctx.fillStyle = rgba(colors.ink, e);
      ctx.fillRect(ox - 7, oy - 1, 14, 2);
      ctx.fillRect(ox - 1, oy - 7, 2, 14);
    };

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!started) return;
      const e = easeOutCubic(assembled);
      cxs = Math.cos(rx);
      sxs = Math.sin(rx);
      cys = Math.cos(ry);
      sys = Math.sin(ry);
      const spread = (1 - e) * 1.4;
      const a1 = phi1 + drive - (1 - e) * 1.4;
      const a2 = phi2 - (drive * g1.N) / g2.N + (1 - e) * 2.6;
      drawGear(g1, holes1, bore1, hub1, c1[0] - Math.cos(theta) * spread * 0.25, c1[1] - Math.sin(theta) * spread * 0.25, a1, 0, e);
      drawGear(g2, [], bore2, hub2, c2[0] + Math.cos(theta) * spread, c2[1] + Math.sin(theta) * spread, a2, (1 - e) * 1.6, e);
    }

    const task = (dt, now) => {
      if (started && assembled < 1) assembled = clamp((now - assembleFrom) / 1900);
      const boost = clamp(Math.abs(scroll.vel) / 1100, 0, 4);
      drive += dt * (0.3 + boost * 0.85);
      rx = lerp(rx, -0.62 + my * 0.24, 0.05);
      ry = lerp(ry, 0.5 + mx * 0.42, 0.05);
      draw();
    };
    const resize = () => {
      ({ w, h, dpr } = fitCanvas(canvas));
      scale = Math.min(w / 3.25, h / 2.55);
      if (!running) draw();
    };

    readColors();
    resize();
    layoutHooks.push(resize);
    themeHooks.push(() => {
      readColors();
      if (!running) draw();
    });
    if (!motion) return { start() {} };

    window.addEventListener(
      'pointermove',
      (e) => {
        mx = (e.clientX / vw) * 2 - 1;
        my = (e.clientY / vh) * 2 - 1;
      },
      { passive: true }
    );
    onVisible(canvas, (v) => {
      running = v;
      if (v) ticker.add(task);
      else ticker.remove(task);
    });
    return {
      start() {
        if (started) return;
        started = true;
        assembleFrom = performance.now();
      },
    };
  }

  /* Laser cutter: a CNC head cuts parts out of a plate, inside contours first,
     throwing sparks; each finished part lifts away and the next one starts. */
  function LaserCutter(canvas, readout) {
    const ctx = canvas.getContext('2d');
    const PW = 1.25;
    const PH = 1;
    const circ = (cx, cy, r, n = 72) => {
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const a = (k / n) * Math.PI * 2;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      return pts;
    };
    const closed = (pts) => [...pts, pts[0]];
    const SHAPES = [
      () => {
        const holes = Array.from({ length: 6 }, (_, k) => {
          const a = (k / 6) * Math.PI * 2;
          return circ(0.625 + 0.25 * Math.cos(a), 0.5 + 0.25 * Math.sin(a), 0.04, 28);
        });
        return [...holes, circ(0.625, 0.5, 0.11, 48), circ(0.625, 0.5, 0.36, 110)];
      },
      () => [
        circ(0.37, 0.3, 0.045, 28),
        circ(0.37, 0.71, 0.045, 28),
        circ(0.66, 0.71, 0.045, 28),
        circ(0.88, 0.71, 0.045, 28),
        closed([[0.24, 0.16], [0.5, 0.16], [0.5, 0.58], [1.02, 0.58], [1.02, 0.84], [0.24, 0.84]]),
      ],
      () => [
        circ(0.47, 0.62, 0.085, 40),
        circ(0.38, 0.28, 0.03, 20),
        circ(0.86, 0.76, 0.03, 20),
        closed([[0.3, 0.16], [0.3, 0.84], [0.98, 0.84]]),
      ],
    ];
    const lengths = (cuts) =>
      cuts.map((pl) => {
        let L = 0;
        for (let i = 1; i < pl.length; i++) L += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
        return L;
      });
    const pointAt = (pl, d) => {
      let acc = 0;
      for (let i = 1; i < pl.length; i++) {
        const seg = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
        if (acc + seg >= d) {
          const t = seg ? (d - acc) / seg : 0;
          return [lerp(pl[i - 1][0], pl[i][0], t), lerp(pl[i - 1][1], pl[i][1], t)];
        }
        acc += seg;
      }
      return pl[pl.length - 1].slice();
    };

    let shapeIdx = 0;
    let cuts = SHAPES[0]();
    let L = lengths(cuts);
    let cutIdx = 0;
    let dist = 0;
    let phase = motion ? 'rapid' : 'done';
    let phaseT = 0;
    let head = [0.06, 0.08];
    let from = head.slice();
    const sparks = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let colors = null;
    let running = false;
    let frame = 0;
    const SPEED = 0.62;

    const readColors = () => {
      colors = {
        draw: hexToRgb(token('--draw')),
        strong: hexToRgb(token('--line-strong')),
        line: hexToRgb(token('--line')),
        ink: hexToRgb(token('--ink')),
        green: hexToRgb(token('--green')),
        plate: hexToRgb(token('--surface-raised')),
      };
    };
    if (!motion) {
      cutIdx = cuts.length;
      head = cuts[cuts.length - 1][0].slice();
    }

    const update = (dt) => {
      phaseT += dt;
      if (phase === 'rapid') {
        const target = cuts[cutIdx][0];
        const t = clamp(phaseT / 0.32);
        const e = easeInOutCubic(t);
        head = [lerp(from[0], target[0], e), lerp(from[1], target[1], e)];
        if (t >= 1) {
          phase = 'cut';
          phaseT = 0;
          dist = 0;
        }
      } else if (phase === 'cut') {
        dist += SPEED * dt;
        head = pointAt(cuts[cutIdx], dist);
        const n = Math.min(14, Math.round(300 * dt));
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2;
          const v = 0.2 + Math.random() * 1.1;
          sparks.push({ x: head[0], y: head[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.12 + Math.random() * 0.42, max: 0.54, c: Math.random() < 0.55 });
        }
        if (dist >= L[cutIdx]) {
          cutIdx++;
          from = head.slice();
          phaseT = 0;
          phase = cutIdx >= cuts.length ? 'lift' : 'rapid';
        }
      } else if (phase === 'lift') {
        if (phaseT > 1.2) {
          phase = 'clear';
          phaseT = 0;
        }
      } else if (phase === 'clear') {
        if (phaseT > 0.55) {
          shapeIdx = (shapeIdx + 1) % SHAPES.length;
          cuts = SHAPES[shapeIdx]();
          L = lengths(cuts);
          cutIdx = 0;
          dist = 0;
          from = head.slice();
          phase = 'rapid';
          phaseT = 0;
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.94;
        s.vy *= 0.94;
      }
    };

    const render = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const s = Math.min((w - 4) / PW, (h - 4) / PH);
      const ox = (w - PW * s) / 2;
      const oy = (h - PH * s) / 2;
      const X = (x) => ox + x * s;
      const Y = (y) => oy + y * s;
      const trace = (pl, upto) => {
        ctx.beginPath();
        ctx.moveTo(X(pl[0][0]), Y(pl[0][1]));
        let acc = 0;
        for (let i = 1; i < pl.length; i++) {
          const seg = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
          if (upto !== undefined && acc + seg > upto) {
            const t = seg ? (upto - acc) / seg : 0;
            ctx.lineTo(X(lerp(pl[i - 1][0], pl[i][0], t)), Y(lerp(pl[i - 1][1], pl[i][1], t)));
            break;
          }
          ctx.lineTo(X(pl[i][0]), Y(pl[i][1]));
          acc += seg;
        }
      };

      ctx.fillStyle = rgba(colors.plate);
      ctx.fillRect(ox, oy, PW * s, PH * s);
      ctx.strokeStyle = rgba(colors.strong);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ox + 0.75, oy + 0.75, PW * s - 1.5, PH * s - 1.5);
      ctx.fillStyle = rgba(colors.line);
      const step = s / 8;
      for (let gx = step; gx < PW * s - 2; gx += step) {
        for (let gy = step; gy < PH * s - 2; gy += step) {
          ctx.fillRect(ox + gx - 4, oy + gy - 0.75, 8, 1.5);
          ctx.fillRect(ox + gx - 0.75, oy + gy - 4, 1.5, 8);
        }
      }

      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = rgba(colors.strong, 0.4);
      ctx.lineWidth = 1;
      for (let i = cutIdx; i < cuts.length; i++) {
        trace(cuts[i]);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const fade = phase === 'clear' ? 1 - clamp(phaseT / 0.55) : 1;
      ctx.strokeStyle = rgba(colors.draw, fade);
      ctx.lineWidth = 2;
      for (let i = 0; i < Math.min(cutIdx, cuts.length); i++) {
        trace(cuts[i]);
        ctx.stroke();
      }
      if (phase === 'cut') {
        trace(cuts[cutIdx], dist);
        ctx.stroke();
      }

      if (phase === 'lift' || phase === 'clear') {
        const t = phase === 'lift' ? clamp(phaseT / 1.2) : 1;
        const e = easeInOutCubic(t);
        ctx.save();
        ctx.translate(0, -e * s * 0.1);
        ctx.globalAlpha = (1 - e) * 0.95;
        ctx.beginPath();
        cuts.forEach((pl) => {
          ctx.moveTo(X(pl[0][0]), Y(pl[0][1]));
          for (let i = 1; i < pl.length; i++) ctx.lineTo(X(pl[i][0]), Y(pl[i][1]));
          ctx.closePath();
        });
        ctx.fillStyle = rgba(colors.draw, 0.22);
        ctx.fill('evenodd');
        ctx.strokeStyle = rgba(colors.draw);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      ctx.lineWidth = 1.5;
      for (let i = 0; i < sparks.length; i++) {
        const sp = sparks[i];
        ctx.strokeStyle = rgba(sp.c ? colors.green : colors.ink, clamp(sp.life / sp.max));
        ctx.beginPath();
        ctx.moveTo(X(sp.x), Y(sp.y));
        ctx.lineTo(X(sp.x - sp.vx * 0.045), Y(sp.y - sp.vy * 0.045));
        ctx.stroke();
      }

      if (phase !== 'clear' && phase !== 'lift' && phase !== 'done') {
        const hx = X(head[0]);
        const hy = Y(head[1]);
        ctx.fillStyle = rgba(colors.ink);
        ctx.fillRect(hx - 10, hy - 1, 20, 2);
        ctx.fillRect(hx - 1, hy - 10, 2, 20);
        ctx.strokeStyle = rgba(colors.ink);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hx, hy, 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (readout && frame++ % 3 === 0) {
        const xs = (head[0] * 1000).toFixed(1).padStart(6, '0');
        const ys = ((PH - head[1]) * 1000).toFixed(1).padStart(6, '0');
        readout.textContent = `X ${xs}   Y ${ys}`;
      }
    };

    const task = (dt) => {
      update(dt);
      render();
    };
    const resize = () => {
      ({ w, h, dpr } = fitCanvas(canvas));
      if (!running) render();
    };
    readColors();
    resize();
    layoutHooks.push(resize);
    themeHooks.push(() => {
      readColors();
      if (!running) render();
    });
    if (!motion) return;
    onVisible(canvas, (v) => {
      running = v;
      if (v) ticker.add(task);
      else ticker.remove(task);
    });
  }

  /* Dot matrix: one square per machine tool, filled in sequence on reveal */
  function DotMatrix(canvas) {
    const ctx = canvas.getContext('2d');
    const total = Number(canvas.dataset.dots) || 450;
    const ROWS = 10;
    const COLS = Math.ceil(total / ROWS);
    let w = 0;
    let h = 0;
    let dpr = 1;
    let t = motion ? 0 : 1;
    let colors = null;
    const readColors = () => {
      colors = { off: hexToRgb(token('--line')), on: hexToRgb(token('--draw')) };
    };
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const gap = 2;
      const cell = Math.max(2, Math.min((w - (COLS - 1) * gap) / COLS, (h - (ROWS - 1) * gap) / ROWS));
      const lit = easeInOutCubic(t) * total;
      for (let i = 0; i < total; i++) {
        const c = Math.floor(i / ROWS);
        const r = i % ROWS;
        ctx.fillStyle = rgba(i < lit ? colors.on : colors.off);
        ctx.fillRect(c * (cell + gap), r * (cell + gap), cell, cell);
      }
    };
    const resize = () => {
      ({ w, h, dpr } = fitCanvas(canvas));
      draw();
    };
    readColors();
    resize();
    layoutHooks.push(resize);
    themeHooks.push(() => {
      readColors();
      draw();
    });
    if (!motion) return;
    const host = canvas.closest('[data-in]') || canvas;
    revealHooks.push((el) => {
      if (el !== host || t > 0) return;
      const start = performance.now();
      const step = (dt, now) => {
        t = clamp((now - start - 250) / 2000);
        draw();
        if (t >= 1) ticker.remove(step);
      };
      ticker.add(step);
    });
  }

  function initCanvases() {
    const fields = $$('[data-plus-field]').map((c) => PlusField(c));
    const gears = $$('[data-gears]').map((c) => Gears(c));
    $$('[data-laser]').forEach((c) => LaserCutter(c, $('[data-laser-readout]')));
    $$('[data-dots]').forEach((c) => DotMatrix(c));
    heroHooks.push(() => {
      gears.forEach((g) => g.start());
      fields.forEach((f) => f.ripple());
    });
  }

  /* ---------------------------------------------------------------------------
     Request a quote form
     ------------------------------------------------------------------------ */
  const ALERT_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>';

  function burst(el) {
    if (!motion) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < 26; i++) {
      const p = doc.createElement('i');
      p.className = 'plus-burst';
      p.setAttribute('aria-hidden', 'true');
      const a = Math.random() * Math.PI * 2;
      const d = 90 + Math.random() * 240;
      p.style.cssText = `left:${cx}px;top:${cy}px;--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px;--r:${((Math.random() * 360 - 180) | 0)}deg;--s:${(0.5 + Math.random() * 1.1).toFixed(2)};--c:${i % 3 === 0 ? 'var(--charcoal)' : 'var(--green)'}`;
      doc.body.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    }
  }

  function initForm() {
    const form = $('[data-quote-form]');
    if (!form) return;
    const success = $('[data-form-success]');
    const alertBox = $('.form-alert', form);
    const submit = $('button[type="submit"]', form);
    const required = $$('[required]', form);
    const MESSAGES = {
      name: 'Enter your full name.',
      company: 'Enter your company name.',
      email: 'Enter your work email, like name@company.com.',
      details: 'Describe the part, material, quantities and target delivery date.',
    };
    form.noValidate = true;

    const setError = (input, msg) => {
      const field = input.closest('.field');
      let err = $('.field-error', field);
      const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      const errId = `${input.id}-error`;
      if (msg) {
        if (!err) {
          err = doc.createElement('p');
          err.className = 'field-error';
          err.id = errId;
          err.innerHTML = `${ALERT_ICON}<span></span>`;
          field.appendChild(err);
        }
        err.lastElementChild.textContent = msg;
        input.setAttribute('aria-invalid', 'true');
        if (!ids.includes(errId)) input.setAttribute('aria-describedby', [...ids, errId].join(' '));
      } else {
        if (err) err.remove();
        input.removeAttribute('aria-invalid');
        const rest = ids.filter((id) => id !== errId);
        if (rest.length) input.setAttribute('aria-describedby', rest.join(' '));
        else input.removeAttribute('aria-describedby');
      }
    };
    const validate = (input) => {
      const ok = input.checkValidity() && input.value.trim() !== '';
      setError(input, ok ? '' : MESSAGES[input.name] || 'Complete this field.');
      return ok;
    };
    required.forEach((input) => {
      input.addEventListener('blur', () => {
        if (input.value) validate(input);
      });
      input.addEventListener('input', () => {
        if (input.getAttribute('aria-invalid') === 'true') validate(input);
      });
    });

    const drop = $('.drop', form);
    const file = $('input[type="file"]', form);
    const list = $('.drop-files', form);
    const showFiles = () => {
      if (!list) return;
      list.innerHTML = '';
      Array.from(file.files || []).forEach((f) => {
        const li = doc.createElement('li');
        li.textContent = f.name;
        list.appendChild(li);
      });
    };
    if (drop && file) {
      ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, () => drop.classList.add('is-over')));
      ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
      file.addEventListener('change', showFiles);
    }

    const showAlert = (msg) => {
      if (!alertBox) return;
      alertBox.innerHTML = `${ALERT_ICON}<span></span>`;
      alertBox.lastElementChild.textContent = msg;
      alertBox.hidden = !msg;
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAlert('');
      const invalid = required.filter((input) => !validate(input));
      if (invalid.length) {
        invalid[0].focus();
        return;
      }
      submit.disabled = true;
      submit.classList.add('is-sending');
      setRollLabel(submit, 'Sending');
      const endpoint = form.dataset.endpoint;
      try {
        if (endpoint) {
          const res = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        } else {
          await new Promise((r) => setTimeout(r, 1400));
        }
        burst(submit);
        setTimeout(() => {
          form.hidden = true;
          success.hidden = false;
          const heading = $('h2', success);
          if (heading) heading.focus();
        }, 380);
      } catch (err) {
        showAlert('We could not send your request. Check your connection and try again.');
      } finally {
        submit.disabled = false;
        submit.classList.remove('is-sending');
        setRollLabel(submit, 'Send request');
      }
    });

    const again = success && $('[data-form-reset]', success);
    if (again) {
      again.addEventListener('click', () => {
        form.reset();
        showFiles();
        required.forEach((input) => setError(input, ''));
        success.hidden = true;
        form.hidden = false;
        const first = $('input', form);
        if (first) first.focus();
      });
    }
  }

  /* ---------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function init() {
    safe(initIcons);
    safe(initButtons);
    safe(initScramble);
    safe(initOdometers);
    safe(initText);
    safe(initHeader);
    safe(initMenu);
    safe(initTransitions);
    safe(initProgress);
    safe(initMarquees);
    safe(initShutter);
    safe(initStack);
    safe(initHScroll);
    safe(initChain);
    safe(initScrubVars);
    safe(initCanvases);
    safe(initMagnetic);
    safe(initTilt);
    safe(initCursor);
    safe(initForm);

    window.addEventListener('scroll', () => ticker.add(scrollTask), { passive: true });
    window.addEventListener('resize', scheduleLayout);
    window.addEventListener('load', scheduleLayout);
    if ('ResizeObserver' in window) new ResizeObserver(scheduleLayout).observe(doc.body);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(scheduleLayout);

    relayout();
    safe(initEntrance);
    setTimeout(() => {
      if (!heroStarted) heroStart();
    }, 3600);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
