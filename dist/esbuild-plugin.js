import fs from "fs-extra";
import path from "path";
import crypto from "node:crypto";
const URL_SEPARATOR = "/";
export const defaults = {
    sriAlgorithms: [],
    hash: true,
};
const assetsDirName = "assets";
const hanamiEsbuild = (options) => {
    return {
        name: "hanami-esbuild",
        setup(build) {
            build.initialOptions.metafile = true;
            const manifestPath = path.join(options.root, options.destDir, "assets.json");
            const externalDirs = build.initialOptions.external || [];
            build.onEnd(async (result) => {
                const outputs = result.metafile?.outputs;
                const assetsManifest = {};
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
                // Transforms the esbuild metafile outputs into an object containing mappings of outputs
                // generated from entryPoints only.
                //
                // Converts this:
                //
                // {
                //   'public/assets/admin/app-ITGLRDE7.js': {
                //     imports: [],
                //     exports: [],
                //     entryPoint: 'slices/admin/assets/js/app.js',
                //     inputs: { 'slices/admin/assets/js/app.js': [Object] },
                //     bytes: 95
                //   }
                // }
                //
                //  To this:
                //
                // {
                //   'public/assets/admin/app-ITGLRDE7.js': true
                // }
                function extractEsbuildCompiledEntrypoints(esbuildOutputs) {
                    const entryPoints = {};
                    for (const key in esbuildOutputs) {
                        if (!key.endsWith(".map")) {
                            entryPoints[key] = true;
                        }
                    }
                    return entryPoints;
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
                const processAssetDirectory = (pattern, compiledEntryPoints, options) => {
                    const dirPath = path.dirname(pattern);
                    const files = fs.readdirSync(dirPath, { recursive: true });
                    const assets = [];
                    files.forEach((file) => {
                        const srcPath = path.join(dirPath, file.toString());
                        // Skip if the file is already processed by esbuild
                        if (compiledEntryPoints.hasOwnProperty(srcPath)) {
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
                            assets.push(...processAssetDirectory(destPath, compiledEntryPoints, options));
                        }
                        else {
                            copyAsset(srcPath, destPath);
                            assets.push([srcPath, destPath]);
                        }
                    });
                    return assets;
                };
                if (typeof outputs === "undefined") {
                    return;
                }
                const compiledEntryPoints = extractEsbuildCompiledEntrypoints(outputs);
                // TODO: use a more explicit type than this. an array of records with named properties?
                const copiedAssets = [];
                externalDirs.forEach((pattern) => {
                    copiedAssets.push(...processAssetDirectory(pattern, compiledEntryPoints, options));
                });
                function prepareAsset(assetPath, destinationUrl) {
                    var asset = { url: destinationUrl };
                    if (options.sriAlgorithms.length > 0) {
                        asset.sri = [];
                        for (const algorithm of options.sriAlgorithms) {
                            const subresourceIntegrity = calculateSubresourceIntegrity(algorithm, path.join(options.root, assetPath));
                            asset.sri.push(subresourceIntegrity);
                        }
                    }
                    return asset;
                }
                // Process entrypoints
                for (const compiledEntryPoint in compiledEntryPoints) {
                    // Convert "public/assets/app-2TLUHCQ6.js" to "app.js"
                    let sourceUrl = compiledEntryPoint
                        .replace(options.destDir + "/", "")
                        .replace(/(-[A-Z0-9]{8})(\.\S+)$/, "$2");
                    const destinationUrl = calulateDestinationUrl(compiledEntryPoint);
                    assetsManifest[sourceUrl] = prepareAsset(compiledEntryPoint, destinationUrl);
                }
                // Process copied assets
                for (const copiedAsset of copiedAssets) {
                    // TODO: I wonder if we can skip .map files earlier
                    if (copiedAsset[0].endsWith(".map")) {
                        continue;
                    }
                    const destinationUrl = calulateDestinationUrl(copiedAsset[1]);
                    // Take the full path of the copied asset and remove everything up to (and including) the "assets/" dir
                    var sourceUrl = copiedAsset[0].replace(path.join(options.root, options.sourceDir, assetsDirName) + "/", "");
                    // Then remove the first subdir (e.g. "images/"), since we do not include those in the asset paths
                    sourceUrl = sourceUrl.substring(sourceUrl.indexOf("/") + 1);
                    assetsManifest[sourceUrl] = prepareAsset(copiedAsset[1], destinationUrl);
                }
                // Write assets manifest to the destination directory
                await fs.writeJson(manifestPath, assetsManifest, { spaces: 2 });
            });
        },
    };
};
export default hanamiEsbuild;
