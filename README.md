# Halden — Atlanta Motor Gallery

A scroll-driven 3D showroom for three cars: the 1965 Ford Mustang, the 2019 Honda NSX and the 2020 Ferrari Roma.
Built with three.js, GSAP ScrollTrigger and Lenis.

## Run it

```bash
npm install
npm start
```

Open http://localhost:5173. The site has to be served over HTTP; opening `index.html` straight from disk won't load the models.

`dist/` is committed, so any static host can serve the folder as-is: Netlify, Vercel, Cloudflare Pages, S3 or GitHub Pages. Turn on gzip or brotli at the host (most do this by default). The local `serve.mjs` doesn't compress.

## Editing

The site code lives in `js/` and is bundled into `dist/app.js`. **After changing anything in `js/`, rebuild:**

```bash
npm run build
```

| File | What it does |
|---|---|
| `index.html` | All copy and structure: hero, intro, three chapters, line-up, visit/booking |
| `css/style.css` | Visual system and self-hosted fonts (Archivo, Instrument Serif, JetBrains Mono) |
| `js/scene.js` | three.js stage: studio lighting, mirror floor, bloom, progressive car loading, shader warm-up, adaptive resolution |
| `js/main.js` | Scroll director: camera keyframes (`SCRIPT`), chapter steps, hotspots, paint swatches, idle detection, form |
| `build.mjs` | esbuild (WASM) bundle: minified, tree-shaken, one request |
| `models/` | Desktop models (meshopt-compressed, WebP textures) |
| `models/mobile/` | Lighter models for phones and tablets |
| `vendor/three/` | three.js r170 sources the bundle is built from |

### Camera
Each entry in `SCRIPT` (top of `js/main.js`) is a keyframe tied to a page section and a progress value from 0 to 1 through it.
- `theta` is the orbit angle (0 = facing the nose).
- `phi` is camera height.
- `radius` is distance.
- `shiftX` slides the car sideways to make room for text.

Cars swap only while `light` is 0, so every change happens in darkness.

### Debugging
Open the site with `?debug` in the URL, then run `__halden.still('roma', 0.4)` in the console to freeze on any moment. `?debug` also turns on shader error checking.

## Phones

- **Native scrolling.** Smooth-scrolling (Lenis) runs on desktop only. On touch devices it attaches non-passive listeners, which make every swipe wait for the main thread — the surest way to make text stutter while the 3D scene draws.
- **Anti-aliasing instead of raw pixels.** Phones draw straight to the canvas, where MSAA is nearly free on tile-based GPUs, so edges stay clean at a lower pixel density.
- **1.6 MB to first car.** Only the Mustang is on the critical path; the other two download during the preloader and are prepared a slice per frame, pausing whenever a finger is on the screen.
- **Smaller textures** (512 px) via `models/mobile/`. Geometry is identical to desktop: simplifying these bodies visibly creased the Roma's hood and chipped the NSX's panel edges.
- **No reflections, bloom or film grain** on phones.

## How it stays fast

- **Short preloader.** It waits for the first car only, which downloads in parallel with the script (preload hint). The other two download behind it and are ready long before their chapters.
- **No shader-compile freezes.** Shaders compile in parallel (`compileAsync`) for the render target they are actually drawn into. Textures upload ahead of time, and each car is drawn once off-screen before it's revealed. All of this runs in small slices that yield to the browser, so scrolling stays responsive during setup.
- **Cheap frames:**
  - The mirror floor skips floor overlays and dust and has no MSAA of its own.
  - Refractive "transmission" glass is replaced by tinted transparency. The refractive version re-rendered the whole room every frame.
  - Dust animates on the GPU.
- **Draws only when needed.** Rendering stops once the camera settles, and while the visit section covers the canvas.
- **Adaptive resolution.** If frame times slip, pixel density steps down and bloom is the last thing dropped. On a fast device, density steps back up.
- **Lighter phones.** See above.
- **Instant repeat visits.** A service worker (`sw.js`) caches models and fonts. **If you replace a model or a font, bump `VERSION` in `sw.js`** — otherwise returning visitors keep the old file.
- **The preloader doesn't hide the page from the browser.** Its wordmark paints immediately, so the page still counts as painted early.

Measured on this build (headless Edge, AMD RX 5500 XT; phone = 4× CPU slowdown, 4G, 390×844 @2×):

| | Desktop | Phone simulation |
|---|---|---|
| Wordmark painted | ~0.3 s | ~1.1 s |
| First car ready (preloader lifts) | ~1.6 s | ~3.2 s |
| Other two cars ready | ~2 s | 2.3 s / 4.7 s after the reader sets off |
| Bytes before the first car | ~2.1 MB | **1.65 MB** |
| Repeat visit, painted | — | **0.42 s** |
| Average frame rate, scrolling the whole page | ~190 fps | ~85 fps |
| Frames over 34 ms | 2–7 of ~5,000 | ~20 of ~2,300 |

A real phone's GPU is slower than the desktop card used here, so treat the phone column as a CPU-and-network simulation. Adaptive resolution is what protects a weaker device.

Known limitation: preparing each background car includes one unsplittable parse of its geometry (~100–200 ms of main thread). It is scheduled for a pause or a dark beat between chapters. Moving glTF parsing to a Web Worker would remove it entirely.

## Model pipeline

The source models were compressed with [glTF-Transform](https://gltf-transform.dev):
- meshopt geometry compression
- WebP textures, capped at 1024 px (512 px for `models/mobile/`)

The Mustang was simplified (353K → 96K triangles). The NSX and Roma keep full geometry, because simplification visibly faceted their bodywork. Phone models share that geometry and differ only in texture size. The Roma was converted from FBX with FBX2glTF, and its materials are corrected at load time in `tuneRomaMaterial()`.

## Before going live
- The booking form only validates in the browser. Connect it to a real endpoint or CRM in `js/main.js`, in the "Booking form" block.
- The phone number `(404) 555-0142`, the "Westside" location and the Halden name are placeholders.
- Check the licence of each 3D model before public or commercial use.
- Reduced-motion users get no smooth scrolling, dust, parallax or entrance animations.
