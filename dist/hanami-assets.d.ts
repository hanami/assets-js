#!/usr/bin/env node
import { BuildOptions, BuildContext } from "esbuild";
import { Args } from "./args.js";
type RunOptionsFunction = (args: Args, options: Partial<BuildOptions>) => Partial<BuildOptions>;
export declare const run: (root: string, argv: string[], optionsFunction?: RunOptionsFunction) => Promise<BuildContext | void>;
export {};
