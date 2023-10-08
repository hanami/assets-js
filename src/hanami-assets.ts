#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { argv } from 'node:process';
import esbuild, { BuildOptions, Loader } from 'esbuild';
import hanamiEsbuild from './hanami-esbuild-plugin';
import { loader, findEntryPoints, externalDirectories } from './esbuild-options';
import { HanamiEsbuildPluginOptions, defaults } from './hanami-esbuild-plugin';

const parseArgs = (args: Array<string>): Record<string, string> => {
  const result: Record<string, string> = {};

  args.slice(2).forEach((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    result[key] = value;
  });

  return result;
}

const touchManifest = (dest: string): void => {
  const manifestPath = path.join(dest, "public", "assets.json");
  const manifestDir = path.dirname(manifestPath);

  fs.ensureDirSync(manifestDir);

  fs.writeFileSync(manifestPath, JSON.stringify({}, null, 2));
}

const args = parseArgs(argv);
const dest = process.cwd();
const watch = args.hasOwnProperty("watch");
const outDir = path.join(dest, 'public', 'assets');
const entryPoints = findEntryPoints(dest)
const externalDirs = externalDirectories();
var sriAlgorithms : Array<string> = [];
if (args['sri']) {
  sriAlgorithms = args['sri'].split(',');
}

if (watch) {
  touchManifest(dest);

  const options: HanamiEsbuildPluginOptions = { ...defaults, hash: false };
  const watchBuildOptions: Partial<BuildOptions> = {
    bundle: true,
    outdir: outDir,
    absWorkingDir: dest,
    loader: loader,
    external: externalDirs,
    logLevel: "info",
    minify: false,
    sourcemap: false,
    entryNames: "[dir]/[name]",
    entryPoints: entryPoints,
    plugins: [hanamiEsbuild(options)],
  }

  esbuild.context(watchBuildOptions).then((ctx) => {
    // FIXME: add `await` to ctx.watch
    ctx.watch();
  }).catch(err => {
    console.log(err);
    process.exit(1);
  });
} else {
  const options: HanamiEsbuildPluginOptions = { ...defaults, sriAlgorithms: sriAlgorithms };
  const config: Partial<BuildOptions> = {
    bundle: true,
    outdir: outDir,
    absWorkingDir: dest,
    loader: loader,
    external: externalDirs,
    logLevel: "silent",
    minify: true,
    sourcemap: true,
    entryNames: "[dir]/[name]-[hash]",
    entryPoints: entryPoints,
    plugins: [hanamiEsbuild(options)],
  }

  // FIXME: add `await` to esbuild.build
  esbuild.build({
    ...config,
  }).catch(err => {
      console.log(err);
      process.exit(1);
    });
}
