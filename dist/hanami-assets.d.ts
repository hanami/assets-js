#!/usr/bin/env node
import { BuildOptions } from "esbuild";
import { Args } from "./args.js";
type RunOptionsFunction = (args: Args, options: Partial<BuildOptions>) => Partial<BuildOptions>;
export declare const run: (argv: string[], optionsFunction?: RunOptionsFunction) => void;
export {};
