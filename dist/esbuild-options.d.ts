import { BuildOptions, Loader } from "esbuild";
export declare const loader: {
    [ext: string]: Loader;
};
export declare const findEntryPoints: (root: string) => Record<string, string>;
export declare const externalDirectories: () => string[];
export declare const buildOptions: (root: string, args: Record<string, string>) => Partial<BuildOptions>;
