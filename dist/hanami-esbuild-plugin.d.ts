import { Plugin } from 'esbuild';
export interface HanamiEsbuildPluginOptions {
    root: string;
    publicDir: string;
    destDir: string;
    manifestPath: string;
    sriAlgorithms: Array<string>;
}
export declare const defaults: Pick<HanamiEsbuildPluginOptions, 'root' | 'publicDir' | 'destDir' | 'manifestPath' | 'sriAlgorithms'>;
declare const hanamiEsbuild: (options?: HanamiEsbuildPluginOptions) => Plugin;
export default hanamiEsbuild;
