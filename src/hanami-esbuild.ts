#!/usr/bin/env node

import path from 'path';
import { globSync } from 'glob'
import { argv } from 'node:process';
import esbuild, { BuildOptions } from 'esbuild';
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

const args = parseArgs(argv);
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

var sriAlgorithms = [] as Array<string>;
if (args['sri']) {
  sriAlgorithms = args['sri'].split(',');
}

const options: HanamiEsbuildPluginOptions = { ...defaults, sriAlgorithms: sriAlgorithms };

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

const config: Partial<BuildOptions> = {
  bundle: true,
  outdir: outDir,
  loader: loader,
  absWorkingDir: dest,
  logLevel: "silent",
  minify: true,
  sourcemap: true,
  entryNames: "[dir]/[name]-[hash]",
  plugins: [hanamiEsbuild(options)],
}

// FIXME: add `await` to esbuild.build
esbuild.build({
  ...config,
  entryPoints: mappedEntryPoints
}).catch(err => {
    console.log(err);
    process.exit(1);
  });
