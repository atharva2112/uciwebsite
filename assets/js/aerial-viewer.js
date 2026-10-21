/* Local perspective interaction for supplied aerial photographs. No map data. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-aerial-viewer]').forEach((viewer) => {
    const stage = viewer.querySelector('.aerial-stage');
    const controls = viewer.querySelector('.aerial-controls');
    const hint = viewer.querySelector('.aerial-hint');
    const zoomOut = viewer.querySelector('[data-aerial-out]');
    const zoomIn = viewer.querySelector('[data-aerial-in]');
    const zoomValue = viewer.querySelector('.aerial-zoom-value');
    const motionButton = viewer.querySelector('[data-aerial-motion]');
    let zoom = 1;
    let x = 0;
    let y = 0;
    let animating = false;
    let visible = true;
    let frame = 0;
    let lastTime = 0;
    let phase = 0;
    let drag = null;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const paint = () => {
      viewer.style.setProperty('--aerial-x', x.toFixed(2) + 'deg');
      viewer.style.setProperty('--aerial-y', y.toFixed(2) + 'deg');
      viewer.style.setProperty('--aerial-zoom', zoom.toFixed(2));
    };
    const cancelFrame = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    };
    const tick = (time) => {
      frame = 0;
      if (!animating || !visible || document.hidden || drag) return;
      if (lastTime) phase += Math.min(time - lastTime, 64) / 8000;
      lastTime = time;
      x = Math.sin(phase) * 2.8;
      y = Math.cos(phase) * 3.8;
      paint();
      frame = requestAnimationFrame(tick);
    };
    const syncAnimation = () => {
      cancelFrame();
      if (animating && visible && !document.hidden && !drag) frame = requestAnimationFrame(tick);
    };
    const setAnimating = (value) => {
      animating = value;
      viewer.classList.toggle('is-animating', value);
      motionButton.setAttribute('aria-pressed', String(value));
      motionButton.textContent = value ? 'Pause' : 'Animate';
      if (!value) { x = 0; y = 0; paint(); }
      syncAnimation();
    };
    const setZoom = (value) => {
      zoom = Math.round(clamp(value, 1, 1.5) * 10) / 10;
      zoomValue.textContent = Math.round(zoom * 100) + '%';
      zoomOut.disabled = zoom === 1;
      zoomIn.disabled = zoom === 1.5;
      paint();
    };
    const reset = () => {
      setAnimating(false);
      setZoom(1);
    };
    controls.hidden = false;
    hint.hidden = false;
    stage.tabIndex = 0;
    stage.setAttribute('aria-describedby', hint.id);
    viewer.classList.add('is-ready');
    setZoom(1);
    zoomOut.addEventListener('click', () => setZoom(zoom - .1));
    zoomIn.addEventListener('click', () => setZoom(zoom + .1));
    viewer.querySelector('[data-aerial-reset]').addEventListener('click', reset);
    motionButton.addEventListener('click', () => setAnimating(!animating));
    stage.addEventListener('keydown', (event) => {
      if (event.key === '+' || event.key === '=') setZoom(zoom + .1);
      else if (event.key === '-') setZoom(zoom - .1);
      else if (event.key === 'Home' || event.key === 'Escape') reset();
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        setAnimating(false);
        if (event.key === 'ArrowLeft') y = -4;
        if (event.key === 'ArrowRight') y = 4;
        if (event.key === 'ArrowUp') x = 3;
        if (event.key === 'ArrowDown') x = -3;
        paint();
      } else return;
      event.preventDefault();
    });
    stage.addEventListener('pointerdown', (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, active: event.pointerType !== 'touch' };
      cancelFrame();
      if (drag.active) {
        stage.setPointerCapture(event.pointerId);
        viewer.classList.add('is-dragging');
      }
    });
    stage.addEventListener('pointermove', (event) => {
      if (reduced.matches && !drag) return;
      if (drag && event.pointerId === drag.id) {
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.active) {
          if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { drag = null; syncAnimation(); return; }
          if (Math.abs(dx) < 10) return;
          drag.active = true;
          stage.setPointerCapture(event.pointerId);
          viewer.classList.add('is-dragging');
        }
        x = clamp(-dy / 15, -4, 4);
        y = clamp(dx / 15, -5, 5);
        paint();
      } else if (!animating && event.pointerType === 'mouse') {
        const rect = stage.getBoundingClientRect();
        x = ((event.clientY - rect.top) / rect.height - .5) * -4;
        y = ((event.clientX - rect.left) / rect.width - .5) * 5;
        paint();
      }
    });
    const endDrag = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      drag = null;
      viewer.classList.remove('is-dragging');
      x = 0; y = 0; paint();
      syncAnimation();
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('lostpointercapture', endDrag);
    stage.addEventListener('pointerleave', () => {
      if (!drag && !animating) { x = 0; y = 0; paint(); }
    });
    document.addEventListener('visibilitychange', syncAnimation);
    reduced.addEventListener('change', () => setAnimating(false));
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        syncAnimation();
      }, { threshold: 0.05 });
      observer.observe(stage);
    }
  });
})();
