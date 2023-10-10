import { Plugin } from "esbuild";
export interface HanamiEsbuildPluginOptions {
    root: string;
    publicDir: string;
    destDir: string;
    manifestPath: string;
    sriAlgorithms: Array<string>;
    hash: boolean;
}
export declare const defaults: Pick<HanamiEsbuildPluginOptions, "root" | "publicDir" | "destDir" | "manifestPath" | "sriAlgorithms" | "hash">;
declare const hanamiEsbuild: (options?: HanamiEsbuildPluginOptions) => Plugin;
export default hanamiEsbuild;
