"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOptions = exports.externalDirectories = exports.findEntryPoints = exports.loader = void 0;
const path_1 = __importDefault(require("path"));
const glob_1 = require("glob");
const hanami_esbuild_plugin_1 = __importStar(require("./hanami-esbuild-plugin"));
exports.loader = {
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
const entryPointsMatcher = /(app\/assets\/js\/|slices\/(.*\/)assets\/js\/)/;
const findEntryPoints = (root) => {
    const result = {};
    // TODO: should this be done explicitly within the root?
    const entryPoints = (0, glob_1.globSync)([
        path_1.default.join("app", "assets", "js", "**", entryPointExtensions),
        path_1.default.join("slices", "*", "assets", "js", "**", entryPointExtensions),
    ]);
    entryPoints.forEach((entryPoint) => {
        let modifiedPath = entryPoint.replace(entryPointsMatcher, "$2");
        const relativePath = path_1.default.relative(root, modifiedPath);
        const { dir, name } = path_1.default.parse(relativePath);
        if (dir) {
            modifiedPath = path_1.default.join(dir, name);
        }
        else {
            modifiedPath = name;
        }
        result[modifiedPath] = entryPoint;
    });
    return result;
};
exports.findEntryPoints = findEntryPoints;
// TODO: feels like this really should be passed a root too, to become the cwd for globSync
const externalDirectories = () => {
    const assetDirsPattern = [
        path_1.default.join("app", "assets", "*"),
        path_1.default.join("slices", "*", "assets", "*"),
    ];
    const excludeDirs = ['js', 'css'];
    try {
        const dirs = (0, glob_1.globSync)(assetDirsPattern, { nodir: false });
        const filteredDirs = dirs.filter((dir) => {
            const dirName = dir.split(path_1.default.sep).pop();
            return !excludeDirs.includes(dirName);
        });
        return filteredDirs.map((dir) => path_1.default.join(dir, "*"));
    }
    catch (err) {
        console.error('Error listing external directories:', err);
        return [];
    }
};
exports.externalDirectories = externalDirectories;
const buildOptions = (root, args) => {
    var sriAlgorithms = [];
    if (args['sri']) {
        sriAlgorithms = args['sri'].split(',');
    }
    const pluginOptions = {
        ...hanami_esbuild_plugin_1.defaults,
        sriAlgorithms: sriAlgorithms
    };
    const plugin = (0, hanami_esbuild_plugin_1.default)(pluginOptions);
    const options = {
        bundle: true,
        outdir: path_1.default.join(root, "public", "assets"),
        absWorkingDir: root,
        loader: exports.loader,
        external: (0, exports.externalDirectories)(),
        logLevel: "silent",
        minify: true,
        sourcemap: true,
        entryNames: "[dir]/[name]-[hash]",
        entryPoints: (0, exports.findEntryPoints)(root),
        plugins: [plugin],
    };
    return options;
};
exports.buildOptions = buildOptions;
