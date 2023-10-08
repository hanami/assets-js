import { BuildOptions } from "esbuild";
export declare const buildOptions: (root: string, args: Record<string, string>) => Partial<BuildOptions>;
export declare const watchOptions: (root: string, args: Record<string, string>) => Partial<BuildOptions>;
