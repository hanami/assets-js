#!/usr/bin/env node

import path from 'path';
import { globSync } from 'glob'
import esbuild, { BuildOptions } from 'esbuild';
import hanamiEsbuild from './hanami-esbuild-plugin';

const args = process.argv.slice(2)
const watch = args.includes("--watch")

const dest = process.cwd();
const outDir = path.join(dest, 'public', 'assets');
const loader = {};

const entryPointExtensions = "*.{js,ts,mjs,mts}";
const entryPoints = globSync([
  path.join("app", "assets", "javascripts", entryPointExtensions),
  path.join("slices", "*", "assets", "javascripts", entryPointExtensions),
]);
// FIXME: make cross platform
const entryPointsMatcher = /(app\/assets\/javascripts\/|slices\/(.*\/)assets\/javascripts\/)/

const mapEntryPoints = (entryPoints: string[]): Record<string, string> => {
  const result: Record<string, string> = {};

  entryPoints.forEach((entryPoint) => {
    let modifiedPath = entryPoint.replace(entryPointsMatcher, "$2")
    const relativePath = path.relative(dest, modifiedPath)

    const { dir, name } = path.parse(relativePath)

    if (dir) {
      modifiedPath = path.join(dir, name)
    } else {
      modifiedPath = name
    }

    result[modifiedPath] = entryPoint
  });

  return result;
}

const mappedEntryPoints = mapEntryPoints(entryPoints);

const buildOptions: Partial<BuildOptions> = {
  bundle: true,
  outdir: outDir,
  loader: loader,
  absWorkingDir: dest,
  logLevel: "silent",
  entryPoints: mappedEntryPoints,
}

if (watch) {
  const watchBuildOptions: Partial<BuildOptions> = {
    ...buildOptions,
    minify: false,
    sourcemap: false,
    entryNames: "[dir]/[name]",
    plugins: [], 
  }

  esbuild.context(watchBuildOptions).then((ctx) => {
    // FIXME: add `await` to ctx.watch
    ctx.watch();
  }).catch(err => {
    console.log(err);
    process.exit(1);
  });
} else {

  const precompileBuildOptions: Partial<BuildOptions> = {
    ...buildOptions,
    minify: true,
    sourcemap: true,
    entryNames: "[dir]/[name]-[hash]",
    plugins: [hanamiEsbuild()],
  }

  // FIXME: add `await` to esbuild.build
  esbuild.build(precompileBuildOptions).catch(err => {
    console.log(err);
    process.exit(1);
  });
}
