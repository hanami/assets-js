import { Loader } from "esbuild";
export declare const loader: {
    [ext: string]: Loader;
};
export declare const findEntryPoints: (root: string) => Record<string, string>;
