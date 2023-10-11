#!/usr/bin/env node
import { BuildOptions, BuildContext } from "esbuild";
import { Args } from "./args.js";
interface RunOptions {
    root?: string;
    argv?: string[];
    esbuildOptionsFn?: EsbuildOptionsFn;
}
type EsbuildOptionsFn = (args: Args, esbuildOptions: Partial<BuildOptions>) => Partial<BuildOptions>;
export declare const run: (options?: RunOptions) => Promise<BuildContext | void>;
export {};
