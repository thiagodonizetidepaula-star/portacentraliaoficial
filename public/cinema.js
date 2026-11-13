const motion = matchMedia('(prefers-reduced-motion: reduce)');
const navigation = document.querySelector('#navegacao');
const menu = document.querySelector('.menu');
function toggleMenu(open) {
  menu.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('open', open);
}
menu.addEventListener('click', () => toggleMenu(menu.getAttribute('aria-expanded') !== 'true'));
navigation.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    toggleMenu(false);
    menu.focus();
  }
});
navigation.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  navigation.querySelector('[aria-current]')?.removeAttribute('aria-current');
  link.setAttribute('aria-current', 'location');
  toggleMenu(false);
  if (getComputedStyle(menu).display !== 'none') {
    const section = document.querySelector(link.hash);
    section.tabIndex = -1;
    section.focus({preventScroll: true});
  }
}));

const tabs = [...document.querySelectorAll('[role=tab]')];
function selectDemo(selected, focus = false) {
  for (const tab of tabs) {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  }
  if (focus) selected.focus({preventScroll: true});
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectDemo(tab));
  tab.addEventListener('keydown', event => {
    const target = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    selectDemo(tabs[target], true);
  });
});
document.querySelectorAll('[data-demo]').forEach(link => link.addEventListener('click', () => {
  selectDemo(document.querySelector('#tab-' + link.dataset.demo), true);
}));
const flow = document.querySelector('#demo-flow');
const run = document.querySelector('#run-flow');
const status = document.querySelector('#flow-status');
run.addEventListener('click', () => {
  if (run.getAttribute('aria-disabled') === 'true') return;
  if (motion.matches) {
    status.textContent = 'Simulação concluída. Os dados foram sincronizados.';
    return;
  }
  run.setAttribute('aria-disabled', 'true');
  flow.classList.add('running');
  status.textContent = 'Simulando evento, processamento e envio.';
  setTimeout(() => {
    flow.classList.remove('running');
    run.removeAttribute('aria-disabled');
    status.textContent = 'Simulação concluída. Os dados foram sincronizados.';
  }, 1300);
});

if (!motion.matches && 'IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('waiting');
      reveal.unobserve(entry.target);
    }
  });
  document.querySelectorAll('.solution,.steps article').forEach(card => {
    card.classList.add('observe', 'waiting');
    reveal.observe(card);
    card.addEventListener('focusin', () => card.classList.remove('waiting'));
    card.addEventListener('pointermove', event => {
      const bounds = card.getBoundingClientRect();
      card.style.setProperty('--x', (event.clientX - bounds.left) + 'px');
      card.style.setProperty('--y', (event.clientY - bounds.top) + 'px');
    }, {passive: true});
  });
  import('./depth.js').catch(() => {});
}

const notebook = document.querySelector('#notebook-view');
if (!motion.matches && 'IntersectionObserver' in window) {
  const loadNotebook = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    loadNotebook.disconnect();
    import('./notebook.js').catch(() => {});
  }, {rootMargin: '160px'});
  loadNotebook.observe(notebook);
}
