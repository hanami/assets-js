export interface Args {
    path: string;
    target: string;
    watch: Boolean;
    sri: string[] | null;
}
export declare const parseArgs: (args: string[]) => Args;
