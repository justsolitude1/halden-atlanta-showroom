// `npm run build` → dist/app.js: one minified, tree-shaken bundle of three.js, GSAP, Lenis and the site code.
// Run it again after editing anything in js/.
import * as esbuild from 'esbuild-wasm';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// The meshopt decoder builds its Web Worker from its own function source, which minified names would break.
// Ship it as a separate, untouched module next to the bundle.
rmSync(here('./dist'), { recursive: true, force: true }); // drop chunks from previous builds
mkdirSync(here('./dist'), { recursive: true });
copyFileSync(here('./vendor/three/addons/libs/meshopt_decoder.module.js'), here('./dist/meshopt_decoder.module.js'));
const keepMeshoptSeparate = {
  name: 'meshopt-external',
  setup(build) {
    build.onResolve({ filter: /meshopt_decoder\.module\.js$/ }, () => ({ path: './meshopt_decoder.module.js', external: true }));
  },
};

const result = await esbuild.build({
  plugins: [keepMeshoptSeparate],
  entryPoints: [here('./js/main.js')],
  outdir: here('./dist'),
  entryNames: 'app',
  chunkNames: 'chunk-[hash]',
  splitting: true, // desktop-only mirror and post-processing land in their own chunk
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2022'],
  legalComments: 'eof',
  metafile: true,
  alias: {
    three: here('./vendor/three/three.module.js'),
    'three/addons': here('./vendor/three/addons'),
  },
});

for (const [file, meta] of Object.entries(result.metafile.outputs)) console.log(`${file.replace(/.*dist/, 'dist')}  ${(meta.bytes / 1024).toFixed(0)} KB`);
