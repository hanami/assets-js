#!/usr/bin/env node
export declare const parseArgs: (args: Array<string>) => Record<string, string>;
export declare const touchManifest: (root: string) => void;
export * from "./esbuild.js";
