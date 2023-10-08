#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const node_process_1 = require("node:process");
const esbuild_1 = __importDefault(require("esbuild"));
const esbuild_options_1 = require("./esbuild-options");
const parseArgs = (args) => {
    const result = {};
    args.slice(2).forEach((arg) => {
        const [key, value] = arg.replace(/^--/, '').split('=');
        result[key] = value;
    });
    return result;
};
const touchManifest = (dest) => {
    const manifestPath = path_1.default.join(dest, "public", "assets.json");
    const manifestDir = path_1.default.dirname(manifestPath);
    fs_extra_1.default.ensureDirSync(manifestDir);
    fs_extra_1.default.writeFileSync(manifestPath, JSON.stringify({}, null, 2));
};
const args = parseArgs(node_process_1.argv);
const watch = args.hasOwnProperty("watch");
const root = process.cwd();
if (watch) {
    touchManifest(root);
    esbuild_1.default.context((0, esbuild_options_1.watchOptions)(root, args)).then((ctx) => {
        // FIXME: add `await` to ctx.watch
        ctx.watch();
    }).catch(err => {
        console.log(err);
        process.exit(1);
    });
}
else {
    // FIXME: add `await` to esbuild.build
    esbuild_1.default.build({
        ...(0, esbuild_options_1.buildOptions)(root, args),
    }).catch(err => {
        console.log(err);
        process.exit(1);
    });
}
