#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const glob_1 = require("glob");
const node_process_1 = require("node:process");
const esbuild_1 = __importDefault(require("esbuild"));
const hanami_esbuild_plugin_1 = __importDefault(require("./hanami-esbuild-plugin"));
const esbuild_options_1 = require("./esbuild-options");
const hanami_esbuild_plugin_2 = require("./hanami-esbuild-plugin");
const parseArgs = (args) => {
    const result = {};
    args.slice(2).forEach((arg) => {
        const [key, value] = arg.replace(/^--/, '').split('=');
        result[key] = value;
    });
    return result;
};
const externalEsbuildDirectories = () => {
    const assetDirsPattern = [
        path_1.default.join("app", "assets", "*"),
        path_1.default.join("slices", "*", "assets", "*"),
    ];
    const excludeDirs = ['js', 'css'];
    try {
        const dirs = (0, glob_1.globSync)(assetDirsPattern, { nodir: false });
        const filteredDirs = dirs.filter((dir) => {
            const dirName = dir.split(path_1.default.sep).pop();
            return !excludeDirs.includes(dirName);
        });
        return filteredDirs.map((dir) => path_1.default.join(dir, "*"));
    }
    catch (err) {
        console.error('Error listing external directories:', err);
        return [];
    }
};
const touchManifest = (dest) => {
    const manifestPath = path_1.default.join(dest, "public", "assets.json");
    const manifestDir = path_1.default.dirname(manifestPath);
    fs_extra_1.default.ensureDirSync(manifestDir);
    fs_extra_1.default.writeFileSync(manifestPath, JSON.stringify({}, null, 2));
};
const args = parseArgs(node_process_1.argv);
const dest = process.cwd();
const watch = args.hasOwnProperty("watch");
const outDir = path_1.default.join(dest, 'public', 'assets');
const entryPoints = (0, esbuild_options_1.findEntryPoints)(dest);
const externalDirs = externalEsbuildDirectories();
var sriAlgorithms = [];
if (args['sri']) {
    sriAlgorithms = args['sri'].split(',');
}
if (watch) {
    touchManifest(dest);
    const options = { ...hanami_esbuild_plugin_2.defaults, hash: false };
    const watchBuildOptions = {
        bundle: true,
        outdir: outDir,
        absWorkingDir: dest,
        loader: esbuild_options_1.loader,
        external: externalDirs,
        logLevel: "info",
        minify: false,
        sourcemap: false,
        entryNames: "[dir]/[name]",
        entryPoints: entryPoints,
        plugins: [(0, hanami_esbuild_plugin_1.default)(options)],
    };
    esbuild_1.default.context(watchBuildOptions).then((ctx) => {
        // FIXME: add `await` to ctx.watch
        ctx.watch();
    }).catch(err => {
        console.log(err);
        process.exit(1);
    });
}
else {
    const options = { ...hanami_esbuild_plugin_2.defaults, sriAlgorithms: sriAlgorithms };
    const config = {
        bundle: true,
        outdir: outDir,
        absWorkingDir: dest,
        loader: esbuild_options_1.loader,
        external: externalDirs,
        logLevel: "silent",
        minify: true,
        sourcemap: true,
        entryNames: "[dir]/[name]-[hash]",
        entryPoints: entryPoints,
        plugins: [(0, hanami_esbuild_plugin_1.default)(options)],
    };
    // FIXME: add `await` to esbuild.build
    esbuild_1.default.build({
        ...config,
    }).catch(err => {
        console.log(err);
        process.exit(1);
    });
}
