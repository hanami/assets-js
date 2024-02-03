import path from "path";
import { globSync } from "glob";
import { BuildOptions, Loader, Plugin } from "esbuild";
import { Args } from "./args.js";
import esbuildPlugin, { PluginOptions, defaults as pluginDefaults } from "./esbuild-plugin.js";

export interface EsbuildOptions extends Partial<BuildOptions> {
  plugins: Plugin[];
}

const loader: { [ext: string]: Loader } = {
  ".tsx": "tsx",
  ".ts": "ts",
  ".js": "js",
  ".jsx": "jsx",
  ".json": "json",
  ".png": "file",
  ".jpg": "file",
  ".jpeg": "file",
  ".gif": "file",
  ".svg": "file",
  ".woff": "file",
  ".woff2": "file",
  ".otf": "file",
  ".eot": "file",
  ".ttf": "file",
};

const entryPointExtensions = "app.{js,ts,mjs,mts,tsx,jsx}";

const findEntryPoints = (sliceRoot: string): Record<string, string> => {
  const result: Record<string, string> = {};

  const entryPoints = globSync([
    path.join(sliceRoot, "assets", "js", "**", entryPointExtensions),
  ]);

  entryPoints.forEach((entryPoint) => {
    let entryPointPath = entryPoint.replace(sliceRoot + "/assets/js/", "");

    const { dir, name } = path.parse(entryPointPath);

    if (dir) {
      entryPointPath = path.join(dir, name);
    } else {
      entryPointPath = name;
    }

    result[entryPointPath] = entryPoint;
  });

  return result;
};

// TODO: feels like this really should be passed a root too, to become the cwd for globSync
const externalDirectories = (): string[] => {
  const assetDirsPattern = [
    path.join("app", "assets", "*"),
    path.join("slices", "*", "assets", "*"),
  ];

  const excludeDirs = ["js", "css"];

  try {
    const dirs = globSync(assetDirsPattern, { nodir: false });
    const filteredDirs = dirs.filter((dir) => {
      const dirName = dir.split(path.sep).pop();
      return !excludeDirs.includes(dirName!);
    });

    return filteredDirs.map((dir) => path.join(dir, "*"));
  } catch (err) {
    console.error("Error listing external directories:", err);
    return [];
  }
};

// TODO: reuse the logic between these two methods below
export const buildOptions = (root: string, args: Args): EsbuildOptions => {
  const pluginOptions: PluginOptions = {
    ...pluginDefaults,
    sriAlgorithms: args.sri || [],
  };
  const plugin = esbuildPlugin(pluginOptions);

  const options: EsbuildOptions = {
    bundle: true,
    outdir: path.join(root, "public", "assets"),
    absWorkingDir: root,
    loader: loader,
    external: externalDirectories(),
    logLevel: "info",
    minify: true,
    sourcemap: true,
    entryNames: "[dir]/[name]-[hash]",
    entryPoints: findEntryPoints(path.join(root, args.path)),
    plugins: [plugin],
  };

  return options;
};

export const watchOptions = (root: string, args: Args): EsbuildOptions => {
  const pluginOptions: PluginOptions = {
    ...pluginDefaults,
    hash: false,
  };
  const plugin = esbuildPlugin(pluginOptions);

  const options: EsbuildOptions = {
    bundle: true,
    outdir: path.join(root, "public", "assets"),
    absWorkingDir: root,
    loader: loader,
    external: externalDirectories(),
    logLevel: "info",
    minify: false,
    sourcemap: false,
    entryNames: "[dir]/[name]",
    entryPoints: findEntryPoints(path.join(root, args.path)),
    plugins: [plugin],
  };

  return options;
};
