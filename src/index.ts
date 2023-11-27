#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import esbuild, { BuildContext, BuildResult } from "esbuild";
import { Args, parseArgs } from "./args.js";
import { EsbuildOptions, buildOptions, watchOptions } from "./esbuild.js";
import cloneDeep from "lodash.clonedeep";

interface RunOptions {
  root?: string;
  argv?: string[];
  esbuildOptionsFn?: EsbuildOptionsFn;
}

type EsbuildOptionsFn = (args: Args, esbuildOptions: EsbuildOptions) => EsbuildOptions;

export const run = async function (options?: RunOptions): Promise<BuildContext | void> {
  const { root = process.cwd(), argv = process.argv, esbuildOptionsFn = null } = options || {};

  const args = parseArgs(argv);

  // TODO: make nicer
  let esbuildOptions = args.watch ? watchOptions(root, args) : buildOptions(root, args);
  if (esbuildOptionsFn) {
    esbuildOptions = esbuildOptionsFn(args, esbuildOptions);
  }

  touchManifest(root);

  if (args.watch) {
    const ctx = await esbuild.context(esbuildOptions);
    await ctx.watch().catch(errorHandler);

    return ctx;
  } else {
    await esbuildMultipleBuilds(esbuildOptions);
  }
};

const errorHandler = (err: any): void => {
  console.log(err);
  process.exit(1);
};

const touchManifest = (root: string): void => {
  const manifestPath = path.join(root, "public", "assets.json");
  const manifestDir = path.dirname(manifestPath);

  fs.ensureDirSync(manifestDir);

  fs.writeFileSync(manifestPath, JSON.stringify({}, null, 2));
};

const esbuildMultipleBuilds = async function (
  esbuildOptions: EsbuildOptions,
): Promise<BuildResult<EsbuildOptions> | void> {
  const builds = splitEsbuildOptions(esbuildOptions);

  for (const build of builds) {
    await esbuild.build(build).catch(errorHandler);
  }
};

const splitEsbuildOptions = (esbuildOptions: EsbuildOptions): EsbuildOptions[] => {
  const entryPoints = extractEntryPoints(esbuildOptions);
  const slices = extractSlices(entryPoints);

  const result = slices.map((slice) => {
    const sliceName = extractSliceName(slice);
    const sliceOptions = cloneDeep(esbuildOptions);
    const entryPoints = extractEntryPoints(sliceOptions);
    const external = extractExternal(sliceOptions);

    sliceOptions.entryPoints = entryPoints.filter((entryPoint) => entryPoint.startsWith(slice));
    sliceOptions.external = external.filter((ext) => ext.startsWith(slice));
    if (sliceName) {
      sliceOptions.entryNames = [sliceName, "[dir]", "[name]-[hash]"].join("/");
      sliceOptions.assetNames = [sliceName, "[name]-[hash]"].join("/");
    }

    return sliceOptions;
  });

  return result;
};

const extractEntryPoints = (esbuildOptions: EsbuildOptions): string[] => {
  let entryPoints: string[] = [];

  if (
    esbuildOptions.entryPoints &&
    typeof esbuildOptions.entryPoints === "object" &&
    !Array.isArray(esbuildOptions.entryPoints)
  ) {
    entryPoints = Object.values(esbuildOptions.entryPoints);
  } else if (Array.isArray(esbuildOptions.entryPoints)) {
    // Handle the case where entryPoints is an array
    // Assuming you want to flatten it to a string array
    entryPoints = esbuildOptions.entryPoints.flatMap((ep) =>
      typeof ep === "string" ? ep : [ep.in, ep.out],
    );
  } else if (typeof esbuildOptions.entryPoints === "string") {
    entryPoints = [esbuildOptions.entryPoints];
  }

  return entryPoints;
};

const extractExternal = (esbuildOptions: EsbuildOptions): string[] => {
  let external: string[] = [];

  if (
    esbuildOptions.external &&
    typeof esbuildOptions.external === "object" &&
    !Array.isArray(esbuildOptions.external)
  ) {
    external = Object.values(esbuildOptions.external);
  } else if (Array.isArray(esbuildOptions.external)) {
    // Handle the case where external is an array
    // Assuming you want to flatten it to a string array
    external = esbuildOptions.external.flatMap((ep) => (typeof ep === "string" ? ep : [ep]));
  } else if (typeof esbuildOptions.external === "string") {
    external = [esbuildOptions.external];
  }

  return external;
};

const extractSlices = (entryPoints: string[]): string[] => {
  const result = entryPoints.map((entryPoint) => {
    return extractSliceOrAppName(entryPoint);
  });

  return [...new Set(result)];
};

const extractSliceOrAppName = (entryPoint: string): string => {
  if (entryPoint.startsWith("app")) {
    return "app";
  }

  const sliceName = extractSliceName(entryPoint);
  if (!sliceName) {
    throw new Error("Could not extract slice name from entry point: " + entryPoint);
  }

  return path.join("slices", sliceName);
};

const extractSliceName = (name: string): string | null => {
  const regex = /^slices\/([^\/]+)/;
  const match = name.match(regex);
  return match ? match[1] : null;
};
