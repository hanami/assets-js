import path from "path";
import { globSync } from "glob";
import hanamiEsbuild, { defaults } from "./hanami-esbuild-plugin.js";
const loader = {
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
// FIXME: make cross platform
const entryPointsMatcher = /(app\/assets\/js\/|slices\/(.*\/)assets\/js\/)/;
const findEntryPoints = (root) => {
    const result = {};
    // TODO: should this be done explicitly within the root?
    const entryPoints = globSync([
        path.join("app", "assets", "js", "**", entryPointExtensions),
        path.join("slices", "*", "assets", "js", "**", entryPointExtensions),
    ]);
    entryPoints.forEach((entryPoint) => {
        let modifiedPath = entryPoint.replace(entryPointsMatcher, "$2");
        const relativePath = path.relative(root, modifiedPath);
        const { dir, name } = path.parse(relativePath);
        if (dir) {
            modifiedPath = path.join(dir, name);
        }
        else {
            modifiedPath = name;
        }
        result[modifiedPath] = entryPoint;
    });
    return result;
};
// TODO: feels like this really should be passed a root too, to become the cwd for globSync
const externalDirectories = () => {
    const assetDirsPattern = [
        path.join("app", "assets", "*"),
        path.join("slices", "*", "assets", "*"),
    ];
    const excludeDirs = ["js", "css"];
    try {
        const dirs = globSync(assetDirsPattern, { nodir: false });
        const filteredDirs = dirs.filter((dir) => {
            const dirName = dir.split(path.sep).pop();
            return !excludeDirs.includes(dirName);
        });
        return filteredDirs.map((dir) => path.join(dir, "*"));
    }
    catch (err) {
        console.error("Error listing external directories:", err);
        return [];
    }
};
// TODO: reuse the logic between these two methods below
export const buildOptions = (root, args) => {
    const pluginOptions = {
        ...defaults,
        sriAlgorithms: args.sri || [],
    };
    const plugin = hanamiEsbuild(pluginOptions);
    const options = {
        bundle: true,
        outdir: path.join(root, "public", "assets"),
        absWorkingDir: root,
        loader: loader,
        external: externalDirectories(),
        logLevel: "silent",
        minify: true,
        sourcemap: true,
        entryNames: "[dir]/[name]-[hash]",
        entryPoints: findEntryPoints(root),
        plugins: [plugin],
    };
    return options;
};
export const watchOptions = (root, args) => {
    const pluginOptions = {
        ...defaults,
        hash: false,
    };
    const plugin = hanamiEsbuild(pluginOptions);
    const options = {
        bundle: true,
        outdir: path.join(root, "public", "assets"),
        absWorkingDir: root,
        loader: loader,
        external: externalDirectories(),
        logLevel: "info",
        minify: false,
        sourcemap: false,
        entryNames: "[dir]/[name]",
        entryPoints: findEntryPoints(root),
        plugins: [plugin],
    };
    return options;
};
