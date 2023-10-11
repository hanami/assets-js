import { Plugin } from "esbuild";
export interface PluginOptions {
    root: string;
    publicDir: string;
    destDir: string;
    manifestPath: string;
    sriAlgorithms: Array<string>;
    hash: boolean;
}
export declare const defaults: Pick<PluginOptions, "root" | "publicDir" | "destDir" | "manifestPath" | "sriAlgorithms" | "hash">;
declare const hanamiEsbuild: (options?: PluginOptions) => Plugin;
export default hanamiEsbuild;
