#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import esbuild, { BuildOptions, BuildContext } from "esbuild";
import { Args, parseArgs } from "./args.js";
import { buildOptions, watchOptions } from "./esbuild.js";

type RunOptionsFunction = (args: Args, options: Partial<BuildOptions>) => Partial<BuildOptions>;

export const run = async function (
  root: string,
  argv: string[],
  optionsFunction?: RunOptionsFunction,
): Promise<BuildContext | void> {
  const args = parseArgs(argv);

  // TODO: make nicer
  let esbuildOptions = args.watch ? watchOptions(root, args) : buildOptions(root, args);
  if (optionsFunction) {
    esbuildOptions = optionsFunction(args, esbuildOptions);
  }

  const errorHandler = (err: any): void => {
    console.log(err);
    process.exit(1);
  };

  if (args.watch) {
    touchManifest(root);

    const ctx = await esbuild.context(esbuildOptions);
    await ctx.watch().catch(errorHandler);

    return ctx;
  } else {
    await esbuild.build(esbuildOptions).catch(errorHandler);
  }
};

const touchManifest = (root: string): void => {
  const manifestPath = path.join(root, "public", "assets.json");
  const manifestDir = path.dirname(manifestPath);

  fs.ensureDirSync(manifestDir);

  fs.writeFileSync(manifestPath, JSON.stringify({}, null, 2));
};
