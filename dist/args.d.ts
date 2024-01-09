export interface Args {
    path: string;
    watch: Boolean;
    sri: string[] | null;
}
export declare const parseArgs: (args: string[]) => Args;
