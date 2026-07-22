# &lt;smoke-drift&gt;

A drifting pipe-smoke background, as a zero-dependency Web Component.

Sinuous wisps rise from the bottom of the element, curl and expand as they climb,
drift on a shared "wind", and dissipate — then a gap of empty sky before the next.
Everything (CSS, keyframes, and the SVG turbulence filter that shapes the wisps)
lives in the component's Shadow DOM, so it never collides with or leaks into the
host page.

## Install

No build step, no dependencies. Copy `smoke-drift.js` into your project, or load
it from a CDN / your own host:

```html
<script type="module" src="smoke-drift.js"></script>
<smoke-drift></smoke-drift>
```

By default the element is `position: fixed; inset: 0; z-index: -1` and
`pointer-events: none` — a full-viewport backdrop behind your content. To confine
it to a container, give that container `position: relative` and override:

```css
smoke-drift { position: absolute; z-index: 0; }
```

## Attributes

All optional; each is also a JS property (camelCase) you can set at runtime.

| Attribute    | Default              | Meaning |
|--------------|----------------------|---------|
| `color`      | `rgb(232 222 196)`   | Any CSS color for the smoke. |
| `opacity`    | `0.5`                | Peak opacity of a wisp (0–1). |
| `wind`       | `300`                | Horizontal drift in px over a wisp's life. Positive = right, negative = left. |
| `spread`     | `0.6`                | Start-x scatter as a fraction of width (0 = dead center, 1 = full width, can start off-screen). |
| `life-min`   | `18`                 | Shortest wisp lifetime, seconds. |
| `life-max`   | `26`                 | Longest wisp lifetime, seconds. |
| `gap-min`    | `1`                  | Shortest empty gap after a wisp finishes, seconds. |
| `gap-max`    | `10`                 | Longest empty gap after a wisp finishes, seconds. |
| `paused`     | *(absent)*           | Boolean attribute; present = stop spawning. |

Spawn cadence is **sequential**: one wisp at a time, and the `gap` timer only
starts once the previous wisp has fully drifted off and faded — so wisps never
overlap and density stays calm.

`color` and `paused` apply live. Other attributes apply to the *next* wisp spawned;
in-flight wisps finish with the settings they were born with.

## Usage in frameworks

It's a standard custom element, so it works anywhere HTML does.

**React** (19+ passes props to custom elements cleanly; on older React set
attributes via a ref):
```jsx
import 'smoke-drift';
<smoke-drift color="#9fd1ff" wind="200" />
```

**Vue** — mark it as a custom element in your build config
(`compilerOptions.isCustomElement = tag => tag === 'smoke-drift'`), then:
```vue
<smoke-drift :color="theme.smoke" wind="250" />
```

**Svelte / Angular / plain HTML** — just use the tag.

## Accessibility

The element is decorative: it's `aria-hidden` by nature (empty, non-interactive)
and renders nothing when the user has `prefers-reduced-motion: reduce` set.

## How it works

Each wisp is one soft "ribbon" plus 2–3 small "cloud" blobs, grouped so they move
together. A `feTurbulence` + `feDisplacementMap` filter tears the soft shapes into
vaporous strands. Three independent transform tracks compose per segment —
`translate` (rise + the lower parts overtaking the upper, i.e. the curl), `rotate`
(a gentle wobble), and `scale` (widening/flattening as it entrains air) — while the
shape/size tracks are time-shifted to open on their mid-animation frame, skipping a
too-tight intro. Splitting position, shape, and fade onto separate animations is
what keeps the motion smooth (no mid-animation easing resets).

## License

MIT.
