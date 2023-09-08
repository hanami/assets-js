"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaults = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const URL_SEPARATOR = '/';
exports.defaults = {
    root: '',
    publicDir: 'public',
    destDir: path_1.default.join('public', 'assets'),
    manifestPath: path_1.default.join('public', 'assets.json'),
    sriAlgorithms: [],
    hash: true,
};
const hanamiEsbuild = (options = { ...exports.defaults }) => {
    return {
        name: 'hanami-esbuild',
        setup(build) {
            build.initialOptions.metafile = true;
            options.root = options.root || process.cwd();
            const manifest = path_1.default.join(options.root, options.manifestPath);
            const externalDirs = build.initialOptions.external || [];
            build.onEnd(async (result) => {
                const outputs = result.metafile?.outputs;
                const assetsManifest = {};
                const calulateSourceUrl = (str) => {
                    return normalizeUrl(str).replace(/\/assets\//, '').replace(/-[A-Z0-9]{8}/, '');
                };
                const calulateDestinationUrl = (str) => {
                    return normalizeUrl(str).replace(/public/, '');
                };
                const normalizeUrl = (str) => {
                    return str.replace(/[\\]+/, URL_SEPARATOR);
                };
                const calculateSubresourceIntegrity = (algorithm, path) => {
                    const content = fs_extra_1.default.readFileSync(path, 'utf8');
                    const hash = node_crypto_1.default.createHash(algorithm).update(content).digest('base64');
                    return `${algorithm}-${hash}`;
                };
                // Inspired by https://github.com/evanw/esbuild/blob/2f2b90a99d626921d25fe6d7d0ca50bd48caa427/internal/bundler/bundler.go#L1057
                const calculateHash = (hashBytes, hash) => {
                    if (!hash) {
                        return null;
                    }
                    const result = node_crypto_1.default.createHash('sha256').update(hashBytes).digest('hex');
                    return result.slice(0, 8).toUpperCase();
                };
                function extractEsbuildInputs(inputData) {
                    const inputs = {};
                    for (const key in inputData) {
                        const entry = inputData[key];
                        if (entry.inputs) {
                            for (const inputKey in entry.inputs) {
                                inputs[inputKey] = true;
                            }
                        }
                    }
                    return inputs;
                }
                // TODO: profile the current implementation vs blindly copying the asset
                const copyAsset = (srcPath, destPath) => {
                    if (fs_extra_1.default.existsSync(destPath)) {
                        const srcStat = fs_extra_1.default.statSync(srcPath);
                        const destStat = fs_extra_1.default.statSync(destPath);
                        // File already exists and is up-to-date, skip copying
                        if (srcStat.mtimeMs <= destStat.mtimeMs) {
                            return;
                        }
                    }
                    if (!fs_extra_1.default.existsSync(path_1.default.dirname(destPath))) {
                        fs_extra_1.default.mkdirSync(path_1.default.dirname(destPath), { recursive: true });
                    }
                    fs_extra_1.default.copyFileSync(srcPath, destPath);
                    return;
                };
                const processAssetDirectory = (pattern, inputs, options) => {
                    const dirPath = path_1.default.dirname(pattern);
                    const files = fs_extra_1.default.readdirSync(dirPath);
                    const assets = [];
                    files.forEach((file) => {
                        const srcPath = path_1.default.join(dirPath, file);
                        // Skip if the file is already processed by esbuild
                        if (inputs.hasOwnProperty(srcPath)) {
                            return;
                        }
                        const fileHash = calculateHash(fs_extra_1.default.readFileSync(srcPath), options.hash);
                        const fileExtension = path_1.default.extname(srcPath);
                        const baseName = path_1.default.basename(srcPath, fileExtension);
                        const destFileName = [baseName, fileHash].filter(item => item !== null).join("-") + fileExtension;
                        const destPath = path_1.default.join(options.destDir, path_1.default.relative(dirPath, srcPath).replace(file, destFileName));
                        if (fs_extra_1.default.lstatSync(srcPath).isDirectory()) {
                            assets.push(...processAssetDirectory(destPath, inputs, options));
                        }
                        else {
                            copyAsset(srcPath, destPath);
                            assets.push(destPath);
                        }
                    });
                    return assets;
                };
                if (typeof outputs === 'undefined') {
                    return;
                }
                const inputs = extractEsbuildInputs(outputs);
                const copiedAssets = [];
                externalDirs.forEach((pattern) => {
                    copiedAssets.push(...processAssetDirectory(pattern, inputs, options));
                });
                const assetsToProcess = Object.keys(outputs).concat(copiedAssets);
                for (const assetToProcess of assetsToProcess) {
                    if (assetToProcess.endsWith('.map')) {
                        continue;
                    }
                    const destinationUrl = calulateDestinationUrl(assetToProcess);
                    const sourceUrl = calulateSourceUrl(destinationUrl);
                    var asset = { url: destinationUrl };
                    if (options.sriAlgorithms.length > 0) {
                        asset.sri = [];
                        for (const algorithm of options.sriAlgorithms) {
                            const subresourceIntegrity = calculateSubresourceIntegrity(algorithm, assetToProcess);
                            asset.sri.push(subresourceIntegrity);
                        }
                    }
                    assetsManifest[sourceUrl] = asset;
                }
                // Write assets manifest to the destination directory
                await fs_extra_1.default.writeJson(manifest, assetsManifest, { spaces: 2 });
            });
        },
    };
};
exports.default = hanamiEsbuild;
