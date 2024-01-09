export interface Args {
  path: string;
  watch: Boolean;
  sri: string[] | null;
}

export const parseArgs = (args: string[]): Args => {
  const result: Record<string, string> = {};

  args.forEach((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    result[key] = value;
  });

  return {
    path: result["path"],
    watch: result.hasOwnProperty("watch"),
    sri: result["sri"]?.split(","),
  };
};
