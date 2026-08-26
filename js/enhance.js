/* ==========================================================================
   CORTEX AUTOMATION — enhance.js
   Camada de enriquecimento: three.js · GSAP + ScrollTrigger · Lenis · Rive · Taxi.js

   Regra de ouro deste ficheiro: NADA aqui é obrigatório.
   O site já está completo e funcional com main.js (zero dependências).
   Cada biblioteca é importada dentro do seu próprio try/catch, de forma
   assíncrona e depois do primeiro render — se uma falhar (CDN em baixo,
   utilizador sem rede, browser antigo), as restantes continuam e o site
   mantém-se perfeitamente utilizável. É isto que permite ter animação
   pesada sem comprometer o "abre em menos de 2 segundos".
   ========================================================================== */

const CDN = {
  three:  'https://esm.sh/three@0.169.0',
  gsap:   'https://esm.sh/gsap@3.12.5',
  st:     'https://esm.sh/gsap@3.12.5/ScrollTrigger',
  lenis:  'https://esm.sh/lenis@1.1.14',
  taxi:   'https://esm.sh/@unseenco/taxi@1.6.0',
  rive:   'https://esm.sh/@rive-app/canvas@2.21.6'
};

/* Interruptores de diagnóstico via URL:
   ?nofx desliga tudo · ?nogsap · ?nothree · ?nolenis · ?notaxi
   Servem para isolar problemas sem tocar no código, e como válvula de
   escape se alguma biblioteca der problemas num browser específico. */
const FLAGS = new URLSearchParams(location.search);
const off = (name) => FLAGS.has('no' + name);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none)').matches;
const isNarrow = matchMedia('(max-width: 900px)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* Importa em segurança: nunca rejeita, devolve null se falhar. */
const grab = (url) => import(/* @vite-ignore */ url).catch((e) => {
  console.info('[cortex] módulo opcional indisponível:', url, e && e.message);
  return null;
});

let lenis = null;
let gsap = null;

/* Ponto de acesso para diagnóstico na consola do browser:
   __cortex.lenis, __cortex.gsap */
window.__cortex = {
  get lenis() { return lenis; },
  get gsap() { return gsap; }
};

/* ══════════════════════════════════════════════════════════════════════════
   1. LENIS — scroll suave
   ══════════════════════════════════════════════════════════════════════════ */
async function initLenis() {
  if (reduced || off('lenis')) return;
  const mod = await grab(CDN.lenis);
  if (!mod) return;

  const Lenis = mod.default || mod.Lenis;
  if (!Lenis) return;

  lenis = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,          // no telemóvel mantém-se o scroll nativo: mais rápido e mais previsível
    touchMultiplier: 1.6,
    wheelMultiplier: 1
  });

  /* Âncoras internas passam a ser tratadas pelo Lenis.
     A posição é calculada aqui e passada como número: o Lenis resolve
     mal alvos que sejam elementos nesta página (fica parado no sítio),
     enquanto com um valor em pixéis funciona sempre. */
  const topoDe = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY);

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    let target = null;
    try { target = document.querySelector(id); } catch (err) { return; }
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(Math.max(0, topoDe(target) - 84), { duration: 1.2 });
  });

  // NOTA: o loop de animação do Lenis é ligado mais tarde, em startLenisLoop().
  // O Lenis tem de ser alimentado por UM só relógio — se receber tanto o
  // requestAnimationFrame (milissegundos) como o gsap.ticker (segundos), os
  // deltas ficam sem sentido e o scrollTo nunca chega ao destino.

}

/* ══════════════════════════════════════════════════════════════════════════
   2. GSAP + ScrollTrigger — animações ligadas ao scroll
   As revelações base já são feitas em main.js; aqui acrescentam-se
   os efeitos que só fazem sentido com scroll contínuo (scrub).
   ══════════════════════════════════════════════════════════════════════════ */
async function initGsap() {
  if (reduced || off('gsap')) return;
  const [g, s] = await Promise.all([grab(CDN.gsap), grab(CDN.st)]);
  if (!g || !s) return;

  gsap = g.gsap || g.default;
  const ScrollTrigger = s.ScrollTrigger || s.default;
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  // O ScrollTrigger tem de saber que quem manda no scroll é o Lenis
  if (lenis) lenis.on('scroll', ScrollTrigger.update);

  // Hero: o bloco de texto sobe e desvanece. Só o .hero__grid — o ticker de
  // números fica de fora, senão apaga-se enquanto ainda está bem visível.
  const heroGrid = $('.hero__grid');
  if (heroGrid) {
    gsap.to(heroGrid, {
      y: -60, opacity: 0.2, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: '65% top', scrub: 0.6 }
    });
  }
  const glow = $('.hero__glow');
  if (glow) {
    gsap.to(glow, {
      y: 180, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.2 }
    });
  }

  /* REGRA IMPORTANTE nas animações com scrub abaixo:
     o elemento animado nunca pode ser o seu próprio trigger.
     O ScrollTrigger calcula start/end a partir da posição do trigger; se
     lhe mexermos no `y`, ele volta a medir, move outra vez, mede outra vez —
     e entra num ciclo que chega a matar o processo de renderização.
     Por isso o trigger é sempre o contentor (.sec-hd) e o alvo o filho (.h2). */
  $$('.sec-hd').forEach((wrapEl) => {
    const title = $('.h2', wrapEl);
    if (!title) return;
    gsap.fromTo(title, { y: 22 }, {
      y: -12, ease: 'none',
      scrollTrigger: { trigger: wrapEl, start: 'top bottom', end: 'bottom top', scrub: 1 }
    });
  });

  // Cartões de escalão entram escalonados. Sem scrub: dispara uma vez e
  // termina, por isso não há risco de realimentação.
  ScrollTrigger.batch('.tier', {
    start: 'top 86%',
    once: true,
    onEnter: (batch) => gsap.fromTo(batch,
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.85, stagger: 0.1, ease: 'power3.out', overwrite: true })
  });

  // Painéis de dados: só opacidade, one-shot. Escalar mexia na caixa do
  // elemento e voltava a alimentar o mesmo ciclo de medições.
  ScrollTrigger.batch('.perf-panel, .calc, .dd', {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.fromTo(batch,
      { opacity: 0.4, y: 18 },
      { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power2.out', overwrite: true })
  });

  // Só depois de fontes e imagens assentarem é que vale a pena recalcular
  addEventListener('load', () => setTimeout(() => ScrollTrigger.refresh(), 260), { once: true });
}

/* ══════════════════════════════════════════════════════════════════════════
   3. THREE.JS — a rede neural do logo, em 3D, por trás do hero
   Só em ecrãs largos: no telemóvel o custo não compensa e a curva 2D chega.
   ══════════════════════════════════════════════════════════════════════════ */
async function initThree() {
  const host = $('#heroThree');
  if (!host || isNarrow || off('three')) return;

  const THREE = await grab(CDN.three);
  if (!THREE) return;

  const W = () => host.clientWidth;
  const H = () => host.clientHeight;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0b0c, 0.135);

  const camera = new THREE.PerspectiveCamera(52, W() / H(), 0.1, 100);
  camera.position.set(0, 0, 7.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(W(), H());
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);

  /* --- Nós distribuídos numa esfera (espiral de Fibonacci) --- */
  const COUNT = 300;
  const R = 2.75;
  const nodes = [];
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    // Ruído leve para não parecer uma grelha perfeita
    const n = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.16;
    nodes.push(new THREE.Vector3(
      Math.cos(theta) * radius * R * n,
      y * R * n,
      Math.sin(theta) * radius * R * n
    ));
  }

  /* --- Pontos --- */
  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(190,255,225,1)');
    grd.addColorStop(0.28, 'rgba(46,224,138,.85)');
    grd.addColorStop(1, 'rgba(46,224,138,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  const pGeo = new THREE.BufferGeometry().setFromPoints(nodes);
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.17,
    map: sprite,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.9
  }));
  group.add(points);

  /* --- Sinapses: liga cada nó aos vizinhos próximos --- */
  const seg = [];
  const MAX_D = 1.15;
  const MAX_SEG = 900;
  outer:
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].distanceTo(nodes[j]) < MAX_D) {
        seg.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z);
        if (seg.length / 6 >= MAX_SEG) break outer;
      }
    }
  }
  const lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  const lines = new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({
    color: 0x2ee08a,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  group.add(lines);

  /* --- Anel exterior, eco do "C" do logo --- */
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.15, 0.008, 8, 180, Math.PI * 1.55),
    new THREE.MeshBasicMaterial({ color: 0xcfd6d3, transparent: true, opacity: 0.16 })
  );
  ring.rotation.set(Math.PI / 2.3, 0, 0.5);
  group.add(ring);

  /* --- Impulsos que percorrem a rede --- */
  const pulseGeo = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 14 }, () => new THREE.Vector3())
  );
  const pulses = new THREE.Points(pulseGeo, new THREE.PointsMaterial({
    size: 0.34, map: sprite, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, color: 0xbeffe1
  }));
  group.add(pulses);

  const paths = Array.from({ length: 14 }, () => ({
    a: Math.floor(Math.random() * nodes.length),
    b: Math.floor(Math.random() * nodes.length),
    t: Math.random(),
    s: 0.004 + Math.random() * 0.008
  }));

  /* --- Interacção --- */
  let mx = 0, my = 0, tx = 0, ty = 0;
  if (!isTouch) {
    addEventListener('pointermove', (e) => {
      tx = (e.clientX / innerWidth - 0.5) * 0.55;
      ty = (e.clientY / innerHeight - 0.5) * 0.4;
    }, { passive: true });
  }

  /* --- Loop --- */
  let raf = null;
  let visible = true;
  const clock = new THREE.Clock();
  const pos = pulseGeo.attributes.position;

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;

    const t = clock.getElapsedTime();
    group.rotation.y = t * 0.055;
    group.rotation.x = Math.sin(t * 0.22) * 0.11;

    mx += (tx - mx) * 0.045;
    my += (ty - my) * 0.045;
    camera.position.x = mx * 2.4;
    camera.position.y = -my * 1.8;
    camera.lookAt(0, 0, 0);

    // Impulsos deslizam de nó para nó
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      p.t += p.s;
      if (p.t >= 1) {
        p.t = 0;
        p.a = p.b;
        p.b = Math.floor(Math.random() * nodes.length);
      }
      const A = nodes[p.a], B = nodes[p.b];
      pos.setXYZ(i, A.x + (B.x - A.x) * p.t, A.y + (B.y - A.y) * p.t, A.z + (B.z - A.z) * p.t);
    }
    pos.needsUpdate = true;

    renderer.render(scene, camera);
  }

  function resize() {
    camera.aspect = W() / H();
    camera.updateProjectionMatrix();
    renderer.setSize(W(), H());
  }
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); }, { passive: true });

  // Só desenha enquanto o hero estiver visível — poupa bateria e CPU
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(host);

  // Pára quando o separador está em segundo plano
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    else if (!raf) frame();
  });

  document.body.classList.add('has-three');
  host.classList.add('is-on');

  if (reduced) { renderer.render(scene, camera); } else { frame(); }
}

/* ══════════════════════════════════════════════════════════════════════════
   4. RIVE — animação vetorial interactiva
   Activa-se sozinho assim que existir o ficheiro assets/hero.riv.
   Como não há nenhum .riv nesta entrega, o bloco sai silenciosamente.
   ══════════════════════════════════════════════════════════════════════════ */
async function initRive() {
  const stage = $('#riveStage');
  const canvas = $('#riveCanvas');
  if (!stage || !canvas) return;

  // Verifica se o ficheiro existe antes de puxar o runtime (~200 KB)
  let ok = false;
  try {
    const res = await fetch('assets/hero.riv', { method: 'HEAD' });
    ok = res.ok;
  } catch (e) { ok = false; }
  if (!ok) return;

  const mod = await grab(CDN.rive);
  if (!mod || !mod.Rive) return;

  const r = new mod.Rive({
    src: 'assets/hero.riv',
    canvas,
    autoplay: true,
    stateMachines: 'State Machine 1',
    onLoad: () => {
      r.resizeDrawingSurfaceToCanvas();
      stage.classList.add('is-on');
    }
  });

  addEventListener('resize', () => r.resizeDrawingSurfaceToCanvas(), { passive: true });
}

/* ══════════════════════════════════════════════════════════════════════════
   5. TAXI.JS — transições entre páginas (índice ↔ privacidade ↔ termos)
   ══════════════════════════════════════════════════════════════════════════ */
async function initTaxi() {
  if (reduced || off('taxi')) return;
  if (!$('[data-taxi]')) return;

  const mod = await grab(CDN.taxi);
  if (!mod) return;

  const Core = mod.Core || mod.default;
  const Transition = mod.Transition;
  const Renderer = mod.Renderer;
  // Sem o Renderer registado, o Taxi rebenta ao construir a cache da página
  // actual e deixa o DOM a meio — daí a verificação ser sobre os três.
  if (!Core || !Transition || !Renderer) return;

  const wipe = $('#pageWipe');

  class Wipe extends Transition {
    onLeave({ done }) {
      if (!wipe) return done();
      wipe.style.transformOrigin = 'bottom';
      wipe.animate(
        [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
        { duration: 460, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' }
      ).onfinish = done;
      $('svg', wipe)?.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 300, delay: 180, fill: 'forwards' }
      );
    }
    onEnter({ done }) {
      window.scrollTo(0, 0);
      if (lenis) lenis.scrollTo(0, { immediate: true });
      if (!wipe) return done();
      wipe.style.transformOrigin = 'top';
      $('svg', wipe)?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      wipe.animate(
        [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }],
        { duration: 520, delay: 120, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' }
      ).onfinish = done;
    }
  }

  let taxi;
  try {
    taxi = new Core({
      links: 'a[href]:not([target]):not([href^="#"]):not([href^="mailto"]):not([href^="tel"]):not([data-taxi-ignore])',
      renderers: { default: Renderer },
      transitions: { default: Wipe }
    });
  } catch (e) {
    console.info('[cortex] Taxi.js não arrancou; navegação normal mantém-se.', e.message);
    return;
  }

  // Depois de cada navegação, volta a montar o que main.js configura
  taxi.on('NAVIGATE_END', () => {
    document.dispatchEvent(new CustomEvent('cortex:remount'));
    if (gsap && window.ScrollTrigger) window.ScrollTrigger.refresh();
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Arranque — em cascata, sem bloquear o render
   ══════════════════════════════════════════════════════════════════════════ */
/* Liga o loop de animação do Lenis a UM único relógio.
   Se o GSAP existir, usa-se o ticker dele (um só rAF em toda a página);
   caso contrário, um requestAnimationFrame próprio. Nunca os dois. */
function startLenisLoop() {
  if (!lenis) return;
  if (gsap) {
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  // Chegar com #ancora no URL (link partilhado) tem de aterrar no sítio certo.
  // Só agora, com o loop a andar, é que o Lenis consegue executar o salto.
  if (location.hash && location.hash.length > 1) {
    let target = null;
    try { target = document.querySelector(location.hash); } catch (err) { target = null; }
    if (target) {
      setTimeout(() => {
        const y = Math.round(target.getBoundingClientRect().top + window.scrollY) - 84;
        lenis.scrollTo(Math.max(0, y), { immediate: true });
      }, 60);
    }
  }
}

function boot() {
  // Ordem intencional: cria o Lenis, tenta o GSAP, e só depois arranca
  // o loop — porque é o GSAP que decide qual relógio vai ser usado.
  initLenis()
    .then(initGsap)
    .then(startLenisLoop)
    .then(() => {
      // 'requestIdleCallback' garante que o 3D nunca disputa a primeira pintura
      const later = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
      later(() => { initThree(); initRive(); initTaxi(); });
    })
    .catch(() => { /* a baseline continua intacta */ });
}

/* Escape hatch: abrir o site com ?nofx desliga toda esta camada e deixa
   apenas a baseline. Útil para diagnosticar e para máquinas fracas. */
if (new URLSearchParams(location.search).has('nofx')) {
  console.info('[cortex] camada de enriquecimento desligada (?nofx)');
} else if (document.readyState === 'complete') {
  boot();
} else {
  addEventListener('load', boot, { once: true });
}
