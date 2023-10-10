#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import esbuild from 'esbuild';
import { parseArgs } from "./args.js";
import { buildOptions, watchOptions } from './esbuild.js';
const touchManifest = (root) => {
    const manifestPath = path.join(root, "public", "assets.json");
    const manifestDir = path.dirname(manifestPath);
    fs.ensureDirSync(manifestDir);
    fs.writeFileSync(manifestPath, JSON.stringify({}, null, 2));
};
const root = process.cwd();
export const run = function (argv, optionsFunction) {
    const args = parseArgs(argv);
    // TODO: make nicer
    let esbuildOptions = args.watch ? watchOptions(root, args) : buildOptions(root, args);
    if (optionsFunction) {
        esbuildOptions = optionsFunction(args, esbuildOptions);
    }
    const errorHandler = (err) => {
        console.log(err);
        process.exit(1);
    };
    if (args.watch) {
        touchManifest(root);
        esbuild.context(esbuildOptions).then((ctx) => {
            ctx.watch();
        }).catch(errorHandler);
    }
    else {
        esbuild.build(esbuildOptions).catch(errorHandler);
    }
};
