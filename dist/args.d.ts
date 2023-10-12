export interface Args {
    watch: Boolean;
    sri: string[] | null;
}
export declare const parseArgs: (args: string[]) => Args;
