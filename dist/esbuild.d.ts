import { BuildOptions } from "esbuild";
import { Args } from "./args.js";
export declare const buildOptions: (root: string, args: Args) => Partial<BuildOptions>;
export declare const watchOptions: (root: string, args: Args) => Partial<BuildOptions>;
