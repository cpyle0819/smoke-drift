/*!
 * <smoke-drift> — a drifting pipe-smoke background, as a Web Component.
 *
 * Sinuous wisps rise from the bottom of the element, curl and expand as they
 * climb (air entrainment), drift with a shared "wind", and dissipate. Everything
 * — CSS, keyframes, and the SVG turbulence filter — lives in the shadow root, so
 * it never collides with or leaks into the host page. Zero dependencies.
 *
 * Usage:
 *   <script type="module" src="smoke-drift.js"></script>
 *   <smoke-drift></smoke-drift>
 *
 * By default the element is fixed to the viewport, behind content
 * (position: fixed; inset: 0; z-index: -1; pointer-events: none). Override with
 * your own CSS — e.g. `smoke-drift { position: absolute; z-index: 0; }` — to
 * confine it to a positioned container.
 *
 * Attributes (all optional; also available as JS properties):
 *   color         CSS color of the smoke            (default: rgb(232 222 196))
 *   opacity       peak opacity of a wisp, 0–1       (default: 0.5)
 *   wind          horizontal drift in px; +right/−left (default: 300)
 *   spread        start-x jitter as a fraction of width, 0–1 (default: 0.6)
 *   life-min      shortest wisp lifetime, seconds   (default: 18)
 *   life-max      longest wisp lifetime, seconds    (default: 26)
 *   gap-min       shortest empty gap after a wisp, seconds (default: 1)
 *   gap-max       longest empty gap after a wisp, seconds  (default: 10)
 *   paused        boolean attr; presence pauses spawning
 *
 * Respects prefers-reduced-motion (renders nothing when the user opts out).
 */

const DEFAULTS = {
  color: 'rgb(232 222 196)',
  opacity: 0.5,
  wind: 300,
  spread: 0.6,
  lifeMin: 18,
  lifeMax: 26,
  gapMin: 1,
  gapMax: 10,
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Shadow styles. The fast-forward trick (duration ×1/0.75, delay −life/3) makes
// the SHAPE/SIZE tracks open on their 25%-progress frame while POSITION and FADE
// keep the natural 0→100% timeline — so a wisp appears where it appears but skips
// the too-tight intro. Colors come from --smoke-color via color-mix so any CSS
// color works.
const STYLES = `
  :host {
    position: fixed; inset: 0; z-index: -1;
    display: block; pointer-events: none; overflow: hidden;
    contain: strict;
  }
  :host([hidden]) { display: none; }
  .stage { position: absolute; inset: 0; overflow: hidden; }

  .puff {
    position: absolute;
    left: calc(50% - (var(--w) / 2) + var(--jit, 0px));
    bottom: var(--y0, -12vh);
    width: var(--w, 46px); height: var(--h, 200px);
    opacity: 0;
    will-change: translate, scale, opacity;
    animation:
      puff-rise var(--life, 22s) cubic-bezier(.33,.28,.28,1) forwards,
      puff-grow calc(var(--life, 22s) / 0.75) cubic-bezier(.33,.28,.28,1) forwards,
      puff-fade var(--life, 22s) linear forwards;
    animation-delay: 0s, calc(var(--life, 22s) / -3), 0s;
  }
  @keyframes puff-rise {
    0%   { translate: 0 0; }
    100% { translate: var(--wind, 300px) calc(var(--climb, 70vh) * -1); }
  }
  @keyframes puff-grow {
    0%   { scale: 1 .9; }
    100% { scale: var(--grow, 5) calc(var(--grow, 5) * 1.5); }
  }
  @keyframes puff-fade {
    0%   { opacity: 0; }
    14%  { opacity: var(--peak, .5); }
    55%  { opacity: calc(var(--peak, .5) * .7); }
    100% { opacity: 0; }
  }

  .seg {
    position: absolute;
    transform-origin: 50% 80%;
    will-change: translate, rotate, scale;
    filter: url(#puffTex);
    animation:
      overtake calc(var(--life, 22s) / 0.75) ease-out forwards,
      wobble var(--wob, 6s) ease-in-out infinite,
      squash calc(var(--life, 22s) / 0.75) ease-out forwards;
    animation-delay: calc(var(--life, 22s) / -3), 0s, calc(var(--life, 22s) / -3);
  }
  .seg.main {
    left: 0; bottom: 0; width: 100%; height: 100%;
    background: radial-gradient(38% 46% at 50% 72%,
      color-mix(in srgb, var(--smoke-color) 95%, transparent),
      color-mix(in srgb, var(--smoke-color) 42%, transparent) 46%,
      transparent 74%);
    border-radius: 48% 52% 46% 54% / 70% 68% 32% 30%;
  }
  .seg.cloud {
    left: var(--cx, 0%); bottom: var(--cy, 0%);
    width: var(--cw, 60%); height: var(--cw, 60%);
    background: radial-gradient(50% 50% at 50% 50%,
      color-mix(in srgb, var(--smoke-color) 85%, transparent),
      color-mix(in srgb, var(--smoke-color) 35%, transparent) 48%,
      transparent 74%);
    border-radius: 50%;
  }
  @keyframes overtake { to { translate: 0 var(--rise, -40%); } }
  @keyframes wobble {
    0%,100% { rotate: 0deg; }
    25%     { rotate: var(--wa, 5deg); }
    75%     { rotate: calc(-1 * var(--wa, 5deg)); }
  }
  @keyframes squash {
    0%   { scale: var(--s0, 1) var(--s0, 1); }
    100% { scale: var(--sqx, 1.4) var(--sqy, .8); }
  }

  @media (prefers-reduced-motion: reduce) { .stage { display: none; } }
`;

// The turbulence + displacement filter that tears the soft blobs into wisps.
const FILTER_SVG = `
  <svg width="0" height="0" aria-hidden="true" style="position:absolute">
    <defs>
      <filter id="puffTex" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b"/>
        <feTurbulence type="fractalNoise" baseFrequency="0.010 0.020" numOctaves="2" seed="7" result="n"/>
        <feDisplacementMap in="b" in2="n" scale="74" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </defs>
  </svg>
`;

class SmokeDrift extends HTMLElement {
  static observedAttributes = [
    'color', 'opacity', 'wind', 'spread',
    'life-min', 'life-max', 'gap-min', 'gap-max', 'paused',
  ];

  #stage;
  #timer = null;
  #running = false;
  #reduceMotion;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = STYLES;
    root.appendChild(style);
    root.innerHTML += FILTER_SVG;
    this.#stage = document.createElement('div');
    this.#stage.className = 'stage';
    root.appendChild(this.#stage);

    this.#reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  }

  // ---- config, read from attributes with fallbacks ----
  #num(attr, fallback) {
    const v = parseFloat(this.getAttribute(attr));
    return Number.isFinite(v) ? v : fallback;
  }
  get color()   { return this.getAttribute('color') || DEFAULTS.color; }
  set color(v)  { v == null ? this.removeAttribute('color') : this.setAttribute('color', v); }
  get opacity() { return this.#num('opacity', DEFAULTS.opacity); }
  set opacity(v){ this.setAttribute('opacity', v); }
  get wind()    { return this.#num('wind', DEFAULTS.wind); }
  set wind(v)   { this.setAttribute('wind', v); }
  get spread()  { return this.#num('spread', DEFAULTS.spread); }
  set spread(v) { this.setAttribute('spread', v); }
  get lifeMin() { return this.#num('life-min', DEFAULTS.lifeMin); }
  get lifeMax() { return this.#num('life-max', DEFAULTS.lifeMax); }
  get gapMin()  { return this.#num('gap-min', DEFAULTS.gapMin); }
  get gapMax()  { return this.#num('gap-max', DEFAULTS.gapMax); }
  get paused()  { return this.hasAttribute('paused'); }
  set paused(v) { v ? this.setAttribute('paused', '') : this.removeAttribute('paused'); }

  connectedCallback() {
    this.style.setProperty('--smoke-color', this.color);
    this.#reduceMotion?.addEventListener?.('change', this.#onMotionPref);
    this.#start();
  }
  disconnectedCallback() {
    this.#stop();
    this.#reduceMotion?.removeEventListener?.('change', this.#onMotionPref);
  }
  attributeChangedCallback(name) {
    if (name === 'color') this.style.setProperty('--smoke-color', this.color);
    if (name === 'paused') this.paused ? this.#stop() : this.#start();
    // other attrs apply to the NEXT spawned wisp; live wisps finish as-is.
  }

  #onMotionPref = () => { this.#reduceMotion?.matches ? this.#stop() : this.#start(); };

  #start() {
    if (this.#running || this.paused || this.#reduceMotion?.matches) return;
    this.#running = true;
    this.#spawn(); // seed one; each wisp schedules the next when it finishes
  }
  #stop() {
    this.#running = false;
    clearTimeout(this.#timer);
    this.#timer = null;
    this.#stage.replaceChildren();
  }

  // Build and launch one wisp: a main ribbon + 2–3 satellite clouds, grouped.
  #spawn() {
    if (!this.#running) return;
    const puff = document.createElement('div');
    puff.className = 'puff';

    const w = rand(52, 84);   // wider base — a broader wisp from the start
    const h = rand(170, 260);
    const life = rand(this.lifeMin, this.lifeMax);
    const climb = rand(54, 84);                 // vh risen over its life
    const wind = this.wind * rand(0.7, 1.3);    // shared direction, varied strength
    const grow = rand(4.5, 6.5);
    const peak = Math.max(0, Math.min(1, this.opacity)) * rand(0.7, 1);

    puff.style.setProperty('--jit', `${rand(-this.spread, this.spread) * window.innerWidth}px`);
    puff.style.setProperty('--y0', `${rand(-16, -6)}vh`);
    puff.style.setProperty('--w', `${w}px`);
    puff.style.setProperty('--h', `${h}px`);
    puff.style.setProperty('--life', `${life}s`);
    puff.style.setProperty('--climb', `${climb}vh`);
    puff.style.setProperty('--wind', `${wind}px`);
    puff.style.setProperty('--grow', grow);
    puff.style.setProperty('--peak', peak);

    const setSeg = (seg, { rise, wa, wobble, sqx, sqy, s0 }) => {
      seg.style.setProperty('--rise', `${rise}%`);
      seg.style.setProperty('--wa', `${wa}deg`);
      seg.style.setProperty('--wob', `${wobble}s`);
      seg.style.setProperty('--sqx', sqx.toFixed(2));
      seg.style.setProperty('--sqy', sqy.toFixed(2));
      if (s0 != null) seg.style.setProperty('--s0', s0.toFixed(2));
    };

    const main = document.createElement('div');
    main.className = 'seg main';
    setSeg(main, { rise: -70, wa: rand(4, 7), wobble: rand(5, 9), sqx: rand(1.2, 1.5), sqy: rand(0.75, 0.9) });
    puff.append(main);

    const nClouds = pick([2, 3]);
    for (let i = 0; i < nClouds; i++) {
      const cloud = document.createElement('div');
      cloud.className = 'seg cloud';
      cloud.style.setProperty('--cx', `${rand(-18, 58)}%`);
      cloud.style.setProperty('--cy', `${rand(2, 48)}%`);
      cloud.style.setProperty('--cw', `${rand(42, 72)}%`);
      setSeg(cloud, {
        rise: -(52 + rand(0, 20)),
        wa: rand(3, 6),
        wobble: rand(5, 10),
        sqx: rand(1.4, 2.1), sqy: rand(0.55, 0.8),
        s0: rand(0.35, 0.6),
      });
      puff.append(cloud);
    }

    // When the rise finishes the wisp has left / faded: remove it, then wait a
    // random gap of empty sky before the next one. The gap only begins after the
    // animation ends — never overlapping wisps.
    puff.addEventListener('animationend', (e) => {
      if (e.target !== puff || e.animationName !== 'puff-rise') return;
      puff.remove();
      if (!this.#running) return;
      this.#timer = setTimeout(() => this.#spawn(), rand(this.gapMin, this.gapMax) * 1000);
    });

    this.#stage.appendChild(puff);
  }
}

customElements.define('smoke-drift', SmokeDrift);
export { SmokeDrift };
