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

## How it stays fast

- **No loading screen.** The headline paints immediately in pure CSS. The first car downloads in parallel with the script (preload hint) and fades up out of the dark when it's ready. The other two cars stream in behind it.
- **No shader-compile freezes.** Shaders compile in parallel (`compileAsync`) for the render target they are actually drawn into. Textures upload ahead of time, and each car is drawn once off-screen before it's revealed. All of this runs in small slices that yield to the browser, so scrolling stays responsive during setup.
- **Cheap frames:**
  - The mirror floor skips floor overlays and dust and has no MSAA of its own.
  - Refractive "transmission" glass is replaced by tinted transparency. The refractive version re-rendered the whole room every frame.
  - Dust animates on the GPU.
- **Draws only when needed.** Rendering stops once the camera settles, and while the visit section covers the canvas.
- **Adaptive resolution.** If frame times slip, pixel density steps down and bloom is the last thing dropped. On a fast device, density steps back up.
- **Lighter phones.** Phones get smaller models, no reflections or bloom, and no film grain.

Measured on this build (headless Edge, AMD RX 5500 XT; "phone" = 4× CPU slowdown, 4G, 390×844 @2×):

| | Desktop | Phone simulation |
|---|---|---|
| Headline painted (LCP) | ~0.5–0.9 s | 1.1 s |
| First car ready | 1.6–1.9 s | 3.0 s |
| All three cars ready | 2.0 s | 5.9 s |
| Average frame rate, scrolling the whole page | 178 fps | 82 fps |
| Frames over 34 ms | 1 of 4,999 | 4 of 2,290 |
| Long tasks while scrolling | 0 | 0 |

## Model pipeline

The source models were compressed with [glTF-Transform](https://gltf-transform.dev):
- meshopt geometry compression
- WebP textures, capped at 1024 px (512 px for `models/mobile/`)

The Mustang was simplified (353K → 96K triangles on desktop, 77K on mobile). The NSX and Roma keep full geometry, because simplification visibly faceted their bodywork. The Roma was converted from FBX with FBX2glTF, and its materials are corrected at load time in `tuneRomaMaterial()`.

## Before going live
- The booking form only validates in the browser. Connect it to a real endpoint or CRM in `js/main.js`, in the "Booking form" block.
- The phone number `(404) 555-0142`, the "Westside" location and the Halden name are placeholders.
- Check the licence of each 3D model before public or commercial use.
- Reduced-motion users get no smooth scrolling, dust, parallax or entrance animations.
