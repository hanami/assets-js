"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findEntryPoints = exports.loader = void 0;
const path_1 = __importDefault(require("path"));
const glob_1 = require("glob");
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
