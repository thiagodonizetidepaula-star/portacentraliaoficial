const canvas = document.querySelector('#depth');
const stage = canvas.parentElement;
const hero = stage.closest('.hero');
const context = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const points = Array.from({length: 38}, () => ({
  x: Math.random(), y: Math.random(), phase: Math.random() * Math.PI * 2
}));
let width, height, visible = false, frame = 0;
let pointerX = 0, pointerY = 0, driftX = 0, driftY = 0;

new ResizeObserver(() => {
  const ratio = Math.min(devicePixelRatio, 1.5);
  width = stage.clientWidth;
  height = stage.clientHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}).observe(stage);

hero.addEventListener('pointermove', event => {
  const bounds = hero.getBoundingClientRect();
  pointerX = (event.clientX - bounds.left) / bounds.width - .5;
  pointerY = (event.clientY - bounds.top) / bounds.height - .5;
}, {passive: true});
function resetPointer() { pointerX = pointerY = 0; }
hero.addEventListener('pointerleave', resetPointer);
hero.addEventListener('pointerup', resetPointer);
hero.addEventListener('pointercancel', resetPointer);

function draw(time) {
  frame = requestAnimationFrame(draw);
  if (!width) return;
  driftX += (pointerX - driftX) * .08;
  driftY += (pointerY - driftY) * .08;
  stage.style.setProperty('--drift-x', (driftX * 28).toFixed(2) + 'px');
  stage.style.setProperty('--drift-y', (driftY * 20).toFixed(2) + 'px');
  context.clearRect(0, 0, width, height);
  const scroll = Math.min(1, scrollY / hero.offsetHeight);
  for (const point of points) {
    const pulse = (Math.sin(time * .0016 + point.phase) + 1) / 2;
    const x = point.x * width + driftX * 34;
    const y = point.y * height + driftY * 24 - scroll * 28;
    context.fillStyle = 'rgba(133,233,255,' + (.15 + pulse * .56) + ')';
    context.beginPath();
    context.arc(x, y, .5 + pulse * 1.4, 0, Math.PI * 2);
    context.fill();
  }
}
function sync() {
  cancelAnimationFrame(frame);
  if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(draw);
  else context.clearRect(0, 0, width || 0, height || 0);
}
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  sync();
}).observe(stage);
document.addEventListener('visibilitychange', sync);
reduced.addEventListener('change', sync);
