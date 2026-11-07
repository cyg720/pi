(() => {
  const app = document.querySelector('#app');
  const root = document.documentElement;
  const storageKey = 'lg-workbench.layout-sizes.v1';
  const sizes = {};
  const specs = {
    sidebar: { selector: '.sidebar', axis: 'x', sign: 1, label: '调整项目栏宽度', variable: '--sidebar-width' },
    conversation: { selector: '.file-viewer', axis: 'x', sign: 1, label: '调整会话与文件区宽度', variable: '--conversation-width' },
    inspector: { selector: '.inspector', axis: 'x', sign: -1, label: '调整资源栏宽度', variable: '--inspector-width' },
    topbar: { selector: '.topbar', axis: 'y', sign: 1, label: '调整顶部栏高度', variable: '--topbar-height' },
    agents: { selector: '.agent-dock', axis: 'y', sign: -1, label: '调整智能体区高度', variable: '--agent-dock-height' },
  };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.version === 1 && saved.sizes && typeof saved.sizes === 'object') {
      for (const key of Object.keys(specs)) {
        const value = saved.sizes[key];
        if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100000) {
          sizes[key] = value;
        }
      }
    }
  } catch {
    // Unavailable storage or invalid saved data must not prevent opening the prototype.
  }
  function saveSizes() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, sizes }));
    } catch {
      // Layout still works in memory when browser storage is unavailable.
    }
  }
  let frame = 0;
  let drag = null;
  let ranges = {};
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function layout() {
    frame = 0;
    const shell = app.querySelector('.shell');
    if (!shell) return;
    if (drag && !drag.handle.isConnected) finish(true);
    const width = shell.getBoundingClientRect().width;
    const height = shell.getBoundingClientRect().height;
    const grid = app.querySelector('.main-grid');
    const split = Boolean(app.querySelector('.with-viewer'));
    const centerMin = split ? 600 : 360;
    const leftMax = Math.max(220, Math.min(420, width - centerMin));
    const leftDefault = width >= 1550 ? 260 : width <= 1200 ? 220 : 244;
    const left = clamp(sizes.sidebar ?? leftDefault, 220, leftMax);
    const available = width - (shell.classList.contains('sidebar-collapsed') ? 60 : left);
    const overlay = available < centerMin + 240;
    grid.classList.toggle('overlay-inspector', overlay);
    const rightMax = Math.max(240, Math.min(480, overlay ? available - 80 : available - centerMin));
    const rightDefault = width >= 1550 ? 330 : width <= 1200 ? 255 : 300;
    const right = clamp(sizes.inspector ?? rightDefault, 240, rightMax);
    const rightVisible = grid.classList.contains('show-inspector') && Boolean(grid.querySelector('.inspector'));
    const center = available - (rightVisible && !overlay ? right : 0);
    const chatMax = Math.max(280, center - 320);
    const chatDefault = Math.max(280, center * .28);
    const topMax = Math.max(44, Math.min(120, height - 360));
    const sidebar = app.querySelector('.sidebar');
    const fixedHeight = [...sidebar.children]
      .filter(el => !el.matches('.project-scroll,.rail-projects,.agent-dock,.resize-handle'))
      .reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);
    const agentMax = Math.max(100, Math.min(340, height - fixedHeight - 120));
    const dock = app.querySelector('.agent-dock-items');
    const agentDefault = dock?.classList.contains('grid') ? 164 : 188;
    ranges = {
      sidebar: [220, leftMax, leftDefault],
      inspector: [240, rightMax, rightDefault],
      conversation: [280, chatMax, chatDefault],
      topbar: [44, topMax, 62],
      agents: [100, agentMax, agentDefault],
    };
    for (const [key, spec] of Object.entries(specs)) {
      const [min, max, initial] = ranges[key];
      const value = Math.round(clamp(sizes[key] ?? initial, min, max));
      root.style.setProperty(spec.variable, `${value}px`);
      const host = app.querySelector(spec.selector);
      if (!host) continue;
      let handle = host.querySelector(`:scope > [data-resize="${key}"]`);
      if (!handle) {
        handle = document.createElement('div');
        handle.dataset.resize = key;
        handle.className = `resize-handle ${spec.axis === 'x' ? 'vertical' : 'horizontal'}`;
        handle.tabIndex = 0;
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', spec.axis === 'x' ? 'vertical' : 'horizontal');
        handle.setAttribute('aria-label', spec.label);
        handle.title = `${spec.label}；双击恢复默认，方向键调整`;
        host.append(handle);
      }
      handle.setAttribute('aria-valuemin', String(Math.round(min)));
      handle.setAttribute('aria-valuemax', String(Math.round(max)));
      handle.setAttribute('aria-valuenow', String(value));
      handle.setAttribute('aria-valuetext', `${value} 像素`);
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(layout);
  }

  function finish(cancelled = false) {
    if (!drag) return;
    const current = drag;
    drag = null;
    if (cancelled) {
      if (current.previous === undefined) delete sizes[current.key];
      else sizes[current.key] = current.previous;
    }
    current.handle.classList.remove('dragging');
    if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
    document.body.classList.remove('resizing');
    root.style.removeProperty('--resize-cursor');
    if (!cancelled) saveSizes();
    schedule();
  }

  app.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-resize]');
    if (!handle || event.button !== 0 || drag) return;
    const key = handle.dataset.resize;
    const spec = specs[key];
    event.preventDefault();
    handle.focus({ preventScroll: true });
    drag = { handle, key, pointerId: event.pointerId, previous: sizes[key],
      origin: spec.axis === 'x' ? event.clientX : event.clientY,
      value: Number(handle.getAttribute('aria-valuenow')) };
    handle.setPointerCapture(event.pointerId);
    handle.classList.add('dragging');
    document.body.classList.add('resizing');
    root.style.setProperty('--resize-cursor', spec.axis === 'x' ? 'col-resize' : 'row-resize');
  });
  app.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const spec = specs[drag.key];
    const position = spec.axis === 'x' ? event.clientX : event.clientY;
    const [min, max] = ranges[drag.key];
    sizes[drag.key] = clamp(drag.value + (position - drag.origin) * spec.sign, min, max);
    schedule();
  });
  app.addEventListener('pointerup', event => { if (drag?.pointerId === event.pointerId) finish(); });
  app.addEventListener('pointercancel', event => { if (drag?.pointerId === event.pointerId) finish(true); });
  app.addEventListener('lostpointercapture', event => { if (drag?.pointerId === event.pointerId) finish(); });
  app.addEventListener('dblclick', event => {
    const handle = event.target.closest('[data-resize]');
    if (!handle) return;
    delete sizes[handle.dataset.resize];
    saveSizes();
    schedule();
  });
  app.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drag) { finish(true); event.preventDefault(); return; }
    const handle = event.target.closest('[data-resize]');
    if (!handle) return;
    const key = handle.dataset.resize;
    const spec = specs[key];
    const [min, max] = ranges[key];
    const backward = spec.axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
    const forward = spec.axis === 'x' ? 'ArrowRight' : 'ArrowDown';
    if (event.key === 'Home') sizes[key] = min;
    else if (event.key === 'End') sizes[key] = max;
    else if (event.key === 'Enter') delete sizes[key];
    else if ([backward, forward].includes(event.key)) {
      sizes[key] = clamp(Number(handle.getAttribute('aria-valuenow')) +
        (event.key === forward ? 1 : -1) * spec.sign * (event.shiftKey ? 32 : 8), min, max);
    } else return;
    event.preventDefault();
    saveSizes();
    schedule();
  });
  window.addEventListener('blur', () => finish());
  window.addEventListener('pagehide', () => finish());
  window.addEventListener('resize', schedule);
  window.addEventListener('workbench-layout', () => {
    if (frame) cancelAnimationFrame(frame);
    layout();
  });
  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  layout();
})();
