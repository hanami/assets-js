import path from "path";
import { globSync } from "glob";
import esbuildPlugin from "./esbuild-plugin.js";
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
const assetsDirName = "assets";
const entryPointExtensions = "app.{js,ts,mjs,mts,tsx,jsx}";
const findEntryPoints = (sliceRoot) => {
    const result = {};
    const entryPoints = globSync([
        path.join(sliceRoot, assetsDirName, "js", "**", entryPointExtensions),
    ]);
    entryPoints.forEach((entryPoint) => {
        let entryPointPath = entryPoint.replace(sliceRoot + "/assets/js/", "");
        const { dir, name } = path.parse(entryPointPath);
        if (dir) {
            entryPointPath = path.join(dir, name);
        }
        else {
            entryPointPath = name;
        }
        result[entryPointPath] = entryPoint;
    });
    return result;
};
const findExternalDirectories = (basePath) => {
    const assetDirsPattern = [path.join(basePath, assetsDirName, "*")];
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
const commonPluginOptions = (root, args) => {
    return {
        root: root,
        sourceDir: args.path,
        destDir: args.dest,
        hash: true,
        sriAlgorithms: [],
    };
};
const commonOptions = (root, args, plugin) => {
    return {
        bundle: true,
        outdir: args.dest,
        absWorkingDir: root,
        loader: loader,
        external: findExternalDirectories(path.join(root, args.path)),
        logLevel: "info",
        entryPoints: findEntryPoints(path.join(root, args.path)),
        plugins: [plugin],
    };
};
export const buildOptions = (root, args) => {
    const pluginOptions = {
        ...commonPluginOptions(root, args),
        sriAlgorithms: args.sri || [],
    };
    const plugin = esbuildPlugin(pluginOptions);
    const options = {
        ...commonOptions(root, args, plugin),
        entryNames: "[dir]/[name]-[hash]",
        minify: true,
        sourcemap: true,
    };
    return options;
};
export const watchOptions = (root, args) => {
    const pluginOptions = {
        ...commonPluginOptions(root, args),
        hash: false,
    };
    const plugin = esbuildPlugin(pluginOptions);
    const options = {
        ...commonOptions(root, args, plugin),
        entryNames: "[dir]/[name]",
        minify: false,
        sourcemap: false,
    };
    return options;
};
