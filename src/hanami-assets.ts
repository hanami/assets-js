#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { argv } from 'node:process';
import esbuild from 'esbuild';
import { buildOptions, watchOptions } from './esbuild';

export const parseArgs = (args: Array<string>): Record<string, string> => {
  const result: Record<string, string> = {};

  args.slice(2).forEach((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    result[key] = value;
  });

  return result;
}

export const touchManifest = (root: string): void => {
  const manifestPath = path.join(root, "public", "assets.json");
  const manifestDir = path.dirname(manifestPath);

  fs.ensureDirSync(manifestDir);

  fs.writeFileSync(manifestPath, JSON.stringify({}, null, 2));
}

const args = parseArgs(argv);
const watch = args.hasOwnProperty("watch");
const root = process.cwd();

if (watch) {
  touchManifest(root);

  esbuild.context(watchOptions(root, args)).then((ctx) => {
    // FIXME: add `await` to ctx.watch
    ctx.watch();
  }).catch(err => {
    console.log(err);
    process.exit(1);
  });
} else {
  // FIXME: add `await` to esbuild.build
  esbuild.build({
    ...buildOptions(root, args),
  }).catch(err => {
    console.log(err);
    process.exit(1);
  });
}
