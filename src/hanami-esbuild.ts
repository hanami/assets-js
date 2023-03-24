#!/usr/bin/env node

import path from 'path';
import esbuild, { BuildOptions } from 'esbuild';
import hanamiEsbuild from './hanami-esbuild-plugin';

const dest = process.cwd();
const outDir = path.join(dest, 'public/assets');
const loader = {};

const entryPoint1 = path.join(dest, 'app/assets/javascripts/index.js');
const entryPoint2 = path.join(dest, 'slices/admin/assets/javascripts/index.js');
const entryPoint3 = path.join(dest, 'slices/metrics/assets/javascripts/app.ts');

const entrypoints: Record<string, string> = {}

// Normalize paths for entrypoints.
;[entryPoint1, entryPoint2, entryPoint3].map((str) => {
  let modifiedPath = str.replace(/(app\/assets\/javascripts\/|slices\/(.*\/)assets\/javascripts\/)/, "$2")
  const relativePath = path.relative(dest, modifiedPath)

  const { dir, name } = path.parse(relativePath)

  if (dir) {
    modifiedPath = dir + path.sep + name
  } else {
    modifiedPath = name
  }
  entrypoints[modifiedPath] = str
})

const config: Partial<BuildOptions> = {
  bundle: true,
  outdir: outDir,
  loader: loader,
  absWorkingDir: dest,
  logLevel: "silent",
  minify: true,
  sourcemap: true,
  entryNames: "[dir]/[name]-[hash]",
  plugins: [hanamiEsbuild()],
}

// FIXME: add `await` to esbuild.build
esbuild.build({
  ...config,
  entryPoints: entrypoints
  // {
  //   "index": entryPoint1 ,
  //   "admin/index": entryPoint2
  // },
});
