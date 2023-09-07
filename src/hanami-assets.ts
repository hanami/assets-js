#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob'
import { argv } from 'node:process';
import esbuild, { BuildOptions, Loader } from 'esbuild';
import hanamiEsbuild from './hanami-esbuild-plugin';
import { HanamiEsbuildPluginOptions, defaults } from './hanami-esbuild-plugin';

const parseArgs = (args: Array<string>): Record<string, string> => {
  const result: Record<string, string> = {};

  args.slice(2).forEach((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    result[key] = value;
  });

  return result;
}

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

const externalEsbuildDirectories = (): string[] => {
  const assetDirsPattern = [
    path.join("app", "assets", "*"),
    path.join("slices", "*", "assets", "*"),
  ]

  const excludeDirs = ['javascripts', 'stylesheets'];

  try {
    const dirs = globSync(assetDirsPattern, { nodir: false });
    const filteredDirs = dirs.filter((dir) => {
      const dirName = dir.split(path.sep).pop();
      return !excludeDirs.includes(dirName!);
    });

    return filteredDirs.map((dir) => path.join(dir, "*"));
  } catch (err) {
    console.error('Error listing external directories:', err);
    return [];
  }
};

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
const loader: { [ext: string]: Loader } = {
  '.tsx': 'tsx',
  '.ts': 'ts',
  '.js': 'js',
  '.jsx': 'jsx',
  '.json': 'json',
  '.png': 'file',
  '.jpg': 'file',
  '.jpeg': 'file',
  '.gif': 'file',
  '.svg': 'file',
  '.woff': 'file',
  '.woff2': 'file',
  '.otf': 'file',
  '.eot': 'file',
  '.ttf': 'file',
};

const entryPointExtensions = "app.{js,ts,mjs,mts,tsx,jsx}";
const entryPoints = globSync([
  path.join("app", "assets", "javascripts", "**", entryPointExtensions),
  path.join("slices", "*", "assets", "javascripts", "**", entryPointExtensions),
]);

// FIXME: make cross platform
const entryPointsMatcher = /(app\/assets\/javascripts\/|slices\/(.*\/)assets\/javascripts\/)/
const mappedEntryPoints = mapEntryPoints(entryPoints);
const externalDirs = externalEsbuildDirectories();
var sriAlgorithms = [] as Array<string>;
if (args['sri']) {
  sriAlgorithms = args['sri'].split(',');
}

const options: HanamiEsbuildPluginOptions = { ...defaults, sriAlgorithms: sriAlgorithms };

if (watch) {
  touchManifest(dest);

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
    entryPoints: mappedEntryPoints,
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
    plugins: [hanamiEsbuild(options)],
  }

  // FIXME: add `await` to esbuild.build
  esbuild.build({
    ...config,
    entryPoints: mappedEntryPoints,
  }).catch(err => {
      console.log(err);
      process.exit(1);
    });
}
