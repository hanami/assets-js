export interface Args {
  path: string;
  target: string;
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
    target: result["target"],
    watch: result.hasOwnProperty("watch"),
    sri: result["sri"]?.split(","),
  };
};
