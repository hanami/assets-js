import { BuildResult, Plugin, PluginBuild } from "esbuild";
import fs from "fs-extra";
import path from "path";
import crypto from "node:crypto";
import { globSync } from "glob";

const URL_SEPARATOR = "/";

export interface PluginOptions {
  root: string;
  sourceDir: string;
  destDir: string;
  sriAlgorithms: Array<string>;
  hash: boolean;
}

interface Asset {
  url: string;
  sri?: Array<string>;
}

interface CopiedAsset {
  sourcePath: string;
  destPath: string;
}

const assetsDirName = "assets";

const hanamiEsbuild = (options: PluginOptions): Plugin => {
  return {
    name: "hanami-esbuild",

    setup(build: PluginBuild) {
      build.initialOptions.metafile = true;

      const manifestPath = path.join(options.root, options.destDir, "assets.json");

      // Track files loaded by esbuild so we don't double-process them.
      const referencedFiles = new Set<string>();
      build.onLoad({ filter: /.*/ }, (args) => {
        referencedFiles.add(args.path);
        return null;
      });

      // After build, copy over any non-referenced asset files, and create a manifest.
      build.onEnd(async (result: BuildResult) => {
        const outputs = result.metafile?.outputs;
        const assetsManifest: Record<string, Asset> = {};

        const calulateDestinationUrl = (str: string): string => {
          return normalizeUrl(str).replace(/public/, "");
        };

        const normalizeUrl = (str: string): string => {
          return str.replace(/[\\]+/, URL_SEPARATOR);
        };

        const calculateSubresourceIntegrity = (algorithm: string, path: string): string => {
          const content = fs.readFileSync(path, "utf8");
          const hash = crypto.createHash(algorithm).update(content).digest("base64");

          return `${algorithm}-${hash}`;
        };

        // Inspired by https://github.com/evanw/esbuild/blob/2f2b90a99d626921d25fe6d7d0ca50bd48caa427/internal/bundler/bundler.go#L1057
        const calculateHash = (hashBytes: Uint8Array, hash: boolean): string | null => {
          if (!hash) {
            return null;
          }

          const result = crypto.createHash("sha256").update(hashBytes).digest("hex");

          return result.slice(0, 8).toUpperCase();
        };

        // TODO: profile the current implementation vs blindly copying the asset
        const copyAsset = (srcPath: string, destPath: string): void => {
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

        const processAssetDirectory = (
          pattern: string,
          referencedFiles: Set<String>,
          options: PluginOptions,
        ): CopiedAsset[] => {
          const dirPath = path.dirname(pattern);
          const files = fs.readdirSync(dirPath, { recursive: true });
          const assets: CopiedAsset[] = [];

          files.forEach((file) => {
            const sourcePath = path.join(dirPath, file.toString());

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
            const destFileName =
              [baseName, fileHash].filter((item) => item !== null).join("-") + fileExtension;
            const destPath = path.join(
              options.destDir,
              path
                .relative(dirPath, sourcePath)
                .replace(path.basename(file.toString()), destFileName),
            );

            if (fs.lstatSync(sourcePath).isDirectory()) {
              assets.push(...processAssetDirectory(destPath, referencedFiles, options));
            } else {
              copyAsset(sourcePath, destPath);
              assets.push({ sourcePath: sourcePath, destPath: destPath });
            }
          });

          return assets;
        };

        if (typeof outputs === "undefined") {
          return;
        }

        // Copy extra asset files (in dirs besides js/ and css/) into the destination directory
        const copiedAssets: CopiedAsset[] = [];
        const extraAssetDirs = extraAssetDirectories(path.join(options.root, options.sourceDir));
        extraAssetDirs.forEach((pattern) => {
          copiedAssets.push(...processAssetDirectory(pattern, referencedFiles, options));
        });

        function prepareAsset(assetPath: string, destinationUrl: string): Asset {
          var asset: Asset = { url: destinationUrl };

          if (options.sriAlgorithms.length > 0) {
            asset.sri = [];

            for (const algorithm of options.sriAlgorithms) {
              const subresourceIntegrity = calculateSubresourceIntegrity(
                algorithm,
                path.join(options.root, assetPath),
              );
              asset.sri.push(subresourceIntegrity);
            }
          }

          return asset;
        }

        // Add files already bundled by esbuild into the manifest
        const fileHashRegexp = /(-[A-Z0-9]{8})(\.\S+)$/;
        const sourceAssetsDir = path.join(options.sourceDir, assetsDirName); // TODO make better
        for (const outputFile in outputs) {
          // Ignore esbuild's generated map files
          if (outputFile.endsWith(".map")) {
            continue;
          }

          const outputAttrs = outputs[outputFile];
          const inputFiles = Object.keys(outputAttrs.inputs);

          // Determine the manifest key for the esbuild output file
          let manifestKey: string;
          if (
            !(outputFile.endsWith(".js") || outputFile.endsWith(".css")) &&
            inputFiles.length == 1 &&
            inputFiles[0].startsWith(sourceAssetsDir + path.sep)
          ) {
            // A non-JS/CSS output with a single input will be an asset file that has been been
            // referenced from JS/CSS.
            //
            // In this case, preserve the original input file's path in the manifest key, so it
            // matches any other files copied over from that path via processAssetDirectory.
            //
            // For example, given the input file "app/assets/images/icons/some-icon.png", return a
            // manifest key of "icons/some-icon.png".
            manifestKey = inputFiles[0]
              .substring(sourceAssetsDir.length + 1) // + 1 to account for the sep
              .split(path.sep)
              .slice(1)
              .join(path.sep);
          } else {
            // For all other outputs, determine the manifest key based on the output file name,
            // stripping away the hash suffix added by esbuild.
            //
            // For example, given the output "public/assets/app-2TLUHCQ6.js", return an manifest
            // key of "app.js".
            manifestKey = outputFile
              .replace(options.destDir + path.sep, "")
              .replace(fileHashRegexp, "$2");
          }

          const destinationUrl = calulateDestinationUrl(outputFile);

          assetsManifest[manifestKey] = prepareAsset(outputFile, destinationUrl);
        }

        // Add copied assets into the manifest
        for (const copiedAsset of copiedAssets) {
          // TODO: I wonder if we can skip .map files earlier
          if (copiedAsset.sourcePath.endsWith(".map")) {
            continue;
          }

          const destinationUrl = calulateDestinationUrl(copiedAsset.destPath);

          // Take the full path of the copied asset and remove everything up to (and including) the "assets/" dir
          var sourceUrl = copiedAsset.sourcePath.replace(
            path.join(options.root, options.sourceDir, assetsDirName) + "/",
            "",
          );
          // Then remove the first subdir (e.g. "images/"), since we do not include those in the asset paths
          sourceUrl = sourceUrl.substring(sourceUrl.indexOf("/") + 1);

          assetsManifest[sourceUrl] = prepareAsset(copiedAsset.destPath, destinationUrl);
        }

        // Write assets manifest to the destination directory
        await fs.writeJson(manifestPath, assetsManifest, { spaces: 2 });

        function extraAssetDirectories(basePath: string): string[] {
          const assetDirsPattern = [path.join(basePath, assetsDirName, "*")];
          const excludeDirs = ["js", "css"];

          try {
            const dirs = globSync(assetDirsPattern, { nodir: false });
            const filteredDirs = dirs.filter((dir) => {
              const dirName = dir.split(path.sep).pop();
              return !excludeDirs.includes(dirName!);
            });

            return filteredDirs.map((dir) => path.join(dir, "*"));
          } catch (err) {
            console.error("Error listing external directories:", err);
            return [];
          }
        }
      });
    },
  };
};

export default hanamiEsbuild;
