import fs from "fs-extra";
import path from "path";
import crypto from "node:crypto";
const URL_SEPARATOR = "/";
export const defaults = {
    root: "",
    destDir: path.join("public", "assets"),
    manifestPath: path.join("public", "assets.json"),
    sriAlgorithms: [],
    hash: true,
};
const hanamiEsbuild = (options = { ...defaults }) => {
    return {
        name: "hanami-esbuild",
        setup(build) {
            build.initialOptions.metafile = true;
            options.root = options.root || process.cwd();
            const manifest = path.join(options.root, options.manifestPath);
            const externalDirs = build.initialOptions.external || [];
            build.onEnd(async (result) => {
                const outputs = result.metafile?.outputs;
                const assetsManifest = {};
                const calulateSourceUrl = (str) => {
                    return normalizeUrl(str)
                        .replace(/\/assets\//, "")
                        .replace(/-[A-Z0-9]{8}/, "");
                };
                const calulateDestinationUrl = (str) => {
                    return normalizeUrl(str).replace(/public/, "");
                };
                const normalizeUrl = (str) => {
                    return str.replace(/[\\]+/, URL_SEPARATOR);
                };
                const calculateSubresourceIntegrity = (algorithm, path) => {
                    const content = fs.readFileSync(path, "utf8");
                    const hash = crypto.createHash(algorithm).update(content).digest("base64");
                    return `${algorithm}-${hash}`;
                };
                // Inspired by https://github.com/evanw/esbuild/blob/2f2b90a99d626921d25fe6d7d0ca50bd48caa427/internal/bundler/bundler.go#L1057
                const calculateHash = (hashBytes, hash) => {
                    if (!hash) {
                        return null;
                    }
                    const result = crypto.createHash("sha256").update(hashBytes).digest("hex");
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
                    if (fs.existsSync(destPath)) {
                        const srcStat = fs.statSync(srcPath);
                        const destStat = fs.statSync(destPath);
                        // File already exists and is up-to-date, skip copying
                        if (srcStat.mtimeMs <= destStat.mtimeMs) {
                            return;
                        }
                    }
                    if (!fs.existsSync(path.dirname(destPath))) {
                        fs.mkdirSync(path.dirname(destPath), { recursive: true });
                    }
                    fs.copyFileSync(srcPath, destPath);
                    return;
                };
                const processAssetDirectory = (pattern, inputs, options) => {
                    const dirPath = path.dirname(pattern);
                    const files = fs.readdirSync(dirPath, { recursive: true });
                    const assets = [];
                    files.forEach((file) => {
                        const srcPath = path.join(dirPath, file.toString());
                        // Skip if the file is already processed by esbuild
                        if (inputs.hasOwnProperty(srcPath)) {
                            return;
                        }
                        // Skip directories and any other non-files
                        if (!fs.statSync(srcPath).isFile()) {
                            return;
                        }
                        const fileHash = calculateHash(fs.readFileSync(srcPath), options.hash);
                        const fileExtension = path.extname(srcPath);
                        const baseName = path.basename(srcPath, fileExtension);
                        const destFileName = [baseName, fileHash].filter((item) => item !== null).join("-") + fileExtension;
                        const destPath = path.join(options.destDir, path.relative(dirPath, srcPath).replace(path.basename(file.toString()), destFileName));
                        if (fs.lstatSync(srcPath).isDirectory()) {
                            assets.push(...processAssetDirectory(destPath, inputs, options));
                        }
                        else {
                            copyAsset(srcPath, destPath);
                            assets.push(destPath);
                        }
                    });
                    return assets;
                };
                if (typeof outputs === "undefined") {
                    return;
                }
                const inputs = extractEsbuildInputs(outputs);
                const copiedAssets = [];
                externalDirs.forEach((pattern) => {
                    copiedAssets.push(...processAssetDirectory(pattern, inputs, options));
                });
                const assetsToProcess = Object.keys(outputs).concat(copiedAssets);
                for (const assetToProcess of assetsToProcess) {
                    if (assetToProcess.endsWith(".map")) {
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
                await fs.writeJson(manifest, assetsManifest, { spaces: 2 });
            });
        },
    };
};
export default hanamiEsbuild;
