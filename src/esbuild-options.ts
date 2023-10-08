import path from "path";
import { globSync } from "glob";
import { Loader } from "esbuild";

export const loader: { [ext: string]: Loader } = {
  '.tsx': 'tsx',
  '.ts': 'ts',
  '.js': 'js',
  '.jsx': 'jsx',
  '.json': 'json',
  '.png': 'file',
  '.jpg': 'file',
  '.jpeg': 'file',
  '.gif': 'file',
  '.svg': 'file',
  '.woff': 'file',
  '.woff2': 'file',
  '.otf': 'file',
  '.eot': 'file',
  '.ttf': 'file',
};

const entryPointExtensions = "app.{js,ts,mjs,mts,tsx,jsx}";
// FIXME: make cross platform
const entryPointsMatcher = /(app\/assets\/js\/|slices\/(.*\/)assets\/js\/)/

export const findEntryPoints = (root: string): Record<string, string> => {
  const result: Record<string, string> = {};

  // TODO: should this be done explicitly within the root?
  const entryPoints = globSync([
    path.join("app", "assets", "js", "**", entryPointExtensions),
    path.join("slices", "*", "assets", "js", "**", entryPointExtensions),
  ]);

  entryPoints.forEach((entryPoint) => {
    let modifiedPath = entryPoint.replace(entryPointsMatcher, "$2")
    const relativePath = path.relative(root, modifiedPath)

    const { dir, name } = path.parse(relativePath)

    if (dir) {
      modifiedPath = path.join(dir, name)
    } else {
      modifiedPath = name
    }

    result[modifiedPath] = entryPoint
  });

  return result;
}

// TODO: feels like this really should be passed a root too, to become the cwd for globSync
export const externalDirectories = (): string[] => {
  const assetDirsPattern = [
    path.join("app", "assets", "*"),
    path.join("slices", "*", "assets", "*"),
  ]

  const excludeDirs = ['js', 'css'];

  try {
    const dirs = globSync(assetDirsPattern, { nodir: false });
    const filteredDirs = dirs.filter((dir) => {
      const dirName = dir.split(path.sep).pop();
      return !excludeDirs.includes(dirName!);
    });

    return filteredDirs.map((dir) => path.join(dir, "*"));
  } catch (err) {
    console.error('Error listing external directories:', err);
    return [];
  }
};


