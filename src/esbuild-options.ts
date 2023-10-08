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


