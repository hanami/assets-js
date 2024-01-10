import { Plugin } from "esbuild";
export interface PluginOptions {
    root: string;
    destDir: string;
    sriAlgorithms: Array<string>;
    hash: boolean;
}
export declare const defaults: Pick<PluginOptions, "root" | "sriAlgorithms" | "hash">;
declare const hanamiEsbuild: (options: PluginOptions) => Plugin;
export default hanamiEsbuild;
