const canvas = document.querySelector('#depth');
const stage = canvas.parentElement;
const hero = stage.closest('.hero');
const context = canvas.getContext('2d');
if (!context) throw new Error("Canvas 2D unavailable");
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const points = Array.from({length: matchMedia("(max-width: 640px)").matches ? 10 : 24}, () => ({
  x: Math.random(), y: Math.random(), phase: Math.random() * Math.PI * 2
}));
let width, height, visible = false, frame = 0;
let elapsed = 0, previousTime = 0;
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
  if (event.pointerType === "touch") return;
  const bounds = hero.getBoundingClientRect();
  pointerX = (event.clientX - bounds.left) / bounds.width - .5;
  pointerY = (event.clientY - bounds.top) / bounds.height - .5;
}, {passive: true});
function resetPointer() { pointerX = pointerY = 0; }
hero.addEventListener('pointerleave', resetPointer);
hero.addEventListener('pointerup', resetPointer);
hero.addEventListener('pointercancel', resetPointer);

const trace = document.querySelector('.graph-primary');
const secondary = document.querySelector('.graph-secondary');
const tip = document.querySelector('.graph-tip');
const graphX = [261, 276, 285, 297, 311, 324, 338, 350, 367, 381, 397];
const graphY = [184, 177, 182, 162, 172, 156, 165, 146, 153, 135, 137];
const scene = stage.querySelector('.scene');
const layers = [...scene.querySelectorAll('.scene-layer')];
const wirePaths = [...scene.querySelectorAll('.wire')].map(wire => [...wire.children]);
const anchors = [
  [268, 157, 202, 133], [267, 182, 205, 198],
  [397, 152, 475, 134], [394, 182, 455, 200]
];

function updateSignals(time) {
  const t = time / 1000;
  const delay = 2.1;
  wirePaths.forEach((paths, index) => {
    const cycle = Math.max(0, t - delay - index * .16) % 3.4;
    const progress = Math.min(1, cycle / 2.6);
    paths[1].style.strokeDashoffset = String(6 - progress * 106);
    paths[1].style.opacity = t < delay || cycle > 2.65 ? '0' : '1';
    layers[index + 1].style.setProperty('--arrival-glow', String(cycle > 2.4 && cycle < 3.1 ? Math.sin((cycle - 2.4) / .7 * Math.PI) : 0));
  });
  const points = graphX.map((x, index) => {
    const variation = Math.sin(t * 2.2 - index * .77) * 4
      + Math.sin(t * 3.6 - index * 1.34) * 2.4;
    return [x, graphY[index] + variation];
  });
  trace.setAttribute('d', 'M' + points.map(([x, y]) => x + ' ' + y.toFixed(1)).join(' L'));
  secondary.setAttribute('d', 'M' + points.map(([x, y], i) =>
    x + ' ' + (y + 9 + Math.sin(t * 1.8 + i) * 3).toFixed(1)).join(' L'));
  tip.setAttribute('cy', points[9][1].toFixed(1));

  const sceneBounds = scene.getBoundingClientRect();
  const bounds = layers.map(layer => layer.getBoundingClientRect());
  const map = (box, x, y) => [
    ((box.left - sceneBounds.left) + box.width * x / 640) * 640 / sceneBounds.width,
    ((box.top - sceneBounds.top) + box.height * y / 360) * 360 / sceneBounds.height
  ];
  anchors.forEach(([x1, y1, x2, y2], index) => {
    const [x, y] = map(bounds[0], x1, y1);
    const [endX, endY] = map(bounds[index + 1], x2, y2);
    const bend = (endX - x) * .58;
    const path = `M${x} ${y} C${x + bend} ${y + (index % 2 ? -14 : 18)} ${endX - bend} ${endY} ${endX} ${endY}`;
    for (const wire of wirePaths[index]) wire.setAttribute('d', path);
  });
}

function draw(time) {
  frame = requestAnimationFrame(draw);
  if (!width) return;
  driftX += (pointerX - driftX) * .08;
  driftY += (pointerY - driftY) * .08;
  stage.style.setProperty('--drift-x', (driftX * 6).toFixed(2) + 'px');
  stage.style.setProperty('--drift-y', (driftY * 6).toFixed(2) + 'px');
  elapsed += previousTime ? Math.min(50, time - previousTime) : 0;
  previousTime = time;
  updateSignals(elapsed);
  context.clearRect(0, 0, width, height);
  const scroll = Math.min(1, scrollY / hero.offsetHeight);
  for (const point of points) {
    const pulse = (Math.sin(time * .0016 + point.phase) + 1) / 2;
    const x = point.x * width + driftX * 34;
    const y = ((point.y + elapsed * .000007 * (1 + point.phase / 6)) % 1) * height + driftY * 8 - scroll * 12;
    context.fillStyle = 'rgba(133,233,255,' + (.15 + pulse * .56) + ')';
    context.beginPath();
    context.arc(x, y, .5 + pulse * 1.4, 0, Math.PI * 2);
    context.fill();
  }
}
function sync() {
  cancelAnimationFrame(frame);
  previousTime = 0;
  if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(draw);
  else {
    context.clearRect(0, 0, width || 0, height || 0);
    stage.style.removeProperty("--drift-x");
    stage.style.removeProperty("--drift-y");
  }
}
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  sync();
}).observe(stage);
document.addEventListener('visibilitychange', sync);
reduced.addEventListener('change', sync);
