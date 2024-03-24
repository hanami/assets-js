import fs from "fs-extra";
import path from "path";
import crypto from "node:crypto";
import { globSync } from "glob";
const URL_SEPARATOR = "/";
const assetsDirName = "assets";
const hanamiEsbuild = (options) => {
    return {
        name: "hanami-esbuild",
        setup(build) {
            build.initialOptions.metafile = true;
            const manifestPath = path.join(options.root, options.destDir, "assets.json");
            const referencedFiles = new Set();
            build.onLoad({ filter: /.*/ }, (args) => {
                referencedFiles.add(args.path);
                return null;
            });
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
                function findExternalDirectories(basePath) {
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
                const processAssetDirectory = (pattern, compiledEntryPoints, referencedFiles, options) => {
                    const dirPath = path.dirname(pattern);
                    const files = fs.readdirSync(dirPath, { recursive: true });
                    const assets = [];
                    files.forEach((file) => {
                        const sourcePath = path.join(dirPath, file.toString());
                        // Skip if the file is already processed by esbuild
                        if (compiledEntryPoints.hasOwnProperty(sourcePath)) {
                            return;
                        }
                        // Skip referenced files
                        if (referencedFiles.has(sourcePath)) {
                            return;
                        }
                        // Skip directories and any other non-files
                        if (!fs.statSync(sourcePath).isFile()) {
                            return;
                        }
                        const fileHash = calculateHash(fs.readFileSync(sourcePath), options.hash);
                        const fileExtension = path.extname(sourcePath);
                        const baseName = path.basename(sourcePath, fileExtension);
                        const destFileName = [baseName, fileHash].filter((item) => item !== null).join("-") + fileExtension;
                        const destPath = path.join(options.destDir, path
                            .relative(dirPath, sourcePath)
                            .replace(path.basename(file.toString()), destFileName));
                        if (fs.lstatSync(sourcePath).isDirectory()) {
                            assets.push(...processAssetDirectory(destPath, compiledEntryPoints, referencedFiles, options));
                        }
                        else {
                            copyAsset(sourcePath, destPath);
                            assets.push({ sourcePath: sourcePath, destPath: destPath });
                        }
                    });
                    return assets;
                };
                if (typeof outputs === "undefined") {
                    return;
                }
                const compiledEntryPoints = extractEsbuildCompiledEntrypoints(outputs);
                const copiedAssets = [];
                const externalDirs = findExternalDirectories(path.join(options.root, options.sourceDir));
                externalDirs.forEach((pattern) => {
                    copiedAssets.push(...processAssetDirectory(pattern, compiledEntryPoints, referencedFiles, options));
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
                const fileHashRegexp = /(-[A-Z0-9]{8})(\.\S+)$/;
                for (const compiledEntryPoint in compiledEntryPoints) {
                    // Convert "public/assets/app-2TLUHCQ6.js" to "app.js"
                    let sourceUrl = compiledEntryPoint
                        .replace(options.destDir + "/", "")
                        .replace(fileHashRegexp, "$2");
                    const destinationUrl = calulateDestinationUrl(compiledEntryPoint);
                    assetsManifest[sourceUrl] = prepareAsset(compiledEntryPoint, destinationUrl);
                }
                // Process copied assets
                for (const copiedAsset of copiedAssets) {
                    // TODO: I wonder if we can skip .map files earlier
                    if (copiedAsset.sourcePath.endsWith(".map")) {
                        continue;
                    }
                    const destinationUrl = calulateDestinationUrl(copiedAsset.destPath);
                    // Take the full path of the copied asset and remove everything up to (and including) the "assets/" dir
                    var sourceUrl = copiedAsset.sourcePath.replace(path.join(options.root, options.sourceDir, assetsDirName) + "/", "");
                    // Then remove the first subdir (e.g. "images/"), since we do not include those in the asset paths
                    sourceUrl = sourceUrl.substring(sourceUrl.indexOf("/") + 1);
                    assetsManifest[sourceUrl] = prepareAsset(copiedAsset.destPath, destinationUrl);
                }
                // Write assets manifest to the destination directory
                await fs.writeJson(manifestPath, assetsManifest, { spaces: 2 });
            });
        },
    };
};
export default hanamiEsbuild;
