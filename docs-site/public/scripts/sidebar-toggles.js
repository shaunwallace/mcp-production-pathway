// Floating pill that toggles the left sidebar (site nav) and right
// sidebar (page table-of-contents) on the docs-site. Choice persists
// in localStorage. Default state is open — first-time visitors see
// the navigation.
//
// State is also set pre-paint by an inline script in <head> (see the
// `head` block in docs-site/astro.config.mjs) to avoid the sidebars
// flashing visible before the user's stored preference is applied.

(() => {
  const STORAGE = { sidebar: 'docs-sidebar-hidden', toc: 'docs-toc-hidden' };
  const ATTR = { sidebar: 'sidebarHidden', toc: 'tocHidden' };

  const ICON_PANEL_LEFT = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>`;
  const ICON_PANEL_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></svg>`;

  function init() {
    const html = document.documentElement;
    const aside = document.querySelector('.aside');
    if (!aside) return;

    const pill = document.createElement('div');
    pill.className = 'sidebar-toggle-pill';
    pill.setAttribute('role', 'toolbar');
    pill.setAttribute('aria-label', 'Layout toggles');

    const sidebarBtn = makeButton('sidebar', 'Toggle navigation sidebar', ICON_PANEL_LEFT);
    const tocBtn = makeButton('toc', 'Toggle on-this-page sidebar', ICON_PANEL_RIGHT);

    if (!document.querySelector('.toc')) tocBtn.style.display = 'none';

    pill.append(sidebarBtn, divider(), tocBtn);
    document.body.append(pill);

    syncPressed(sidebarBtn, ATTR.sidebar);
    syncPressed(tocBtn, ATTR.toc);

    sidebarBtn.addEventListener('click', () => toggle('sidebar', sidebarBtn));
    tocBtn.addEventListener('click', () => toggle('toc', tocBtn));
  }

  function makeButton(target, label, iconSvg) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sidebar-toggle-pill__btn';
    b.dataset.toggle = target;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = iconSvg;
    return b;
  }

  function divider() {
    const s = document.createElement('span');
    s.className = 'sidebar-toggle-pill__divider';
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  function syncPressed(btn, dsKey) {
    btn.setAttribute('aria-pressed', String(dsKey in document.documentElement.dataset));
  }

  function toggle(target, btn) {
    const html = document.documentElement;
    const dsKey = ATTR[target];
    const lsKey = STORAGE[target];
    const isHidden = dsKey in html.dataset;
    if (isHidden) {
      delete html.dataset[dsKey];
      try { localStorage.removeItem(lsKey); } catch (e) {}
      btn.setAttribute('aria-pressed', 'false');
    } else {
      html.dataset[dsKey] = '';
      try { localStorage.setItem(lsKey, '1'); } catch (e) {}
      btn.setAttribute('aria-pressed', 'true');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
