import { BuildResult, Plugin, PluginBuild } from "esbuild";
import fs from "fs-extra";
import path from "path";
import crypto from "node:crypto";

const URL_SEPARATOR = "/";

export interface PluginOptions {
  root: string;
  baseDir: string;
  destDir: string;
  sriAlgorithms: Array<string>;
  hash: boolean;
}

export const defaults: Pick<
  PluginOptions,
  "root" | "sriAlgorithms" | "hash"
> = {
  root: "",
  sriAlgorithms: [],
  hash: true,
};

interface Asset {
  url: string;
  sri?: Array<string>;
}

const hanamiEsbuild = (options: PluginOptions): Plugin => {
  return {
    name: "hanami-esbuild",

    setup(build: PluginBuild) {
      build.initialOptions.metafile = true;
      options.root = options.root || process.cwd(); // TODO: can't this always be passed in?

      const manifestPath = path.join(options.root, options.destDir, "assets.json");
      const externalDirs = build.initialOptions.external || [];

      build.onEnd(async (result: BuildResult) => {
        const outputs = result.metafile?.outputs;
        console.log(outputs)
        const assetsManifest: Record<string, Asset> = {};

        const calulateSourceUrl = (str: string): string => {
          // console.log(str)
          // console.log(options)

          // .replace(/\/assets\//, "")
          console.log(str)
          return normalizeUrl(str)
            .replace(options.baseDir, "")
            .replace(/-[A-Z0-9]{8}/, "");
        };

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
        //   'public/assets/admin/app-ITGLRDE7.js': 'slices/admin/assets/js/app.js'
        // }
        function extractEsbuildCompiledEntrypoints(esbuildOutputs: Record<string, any>): Record<string, string> {
          const entryPoints: Record<string, string> = {};

          for (const key in esbuildOutputs) {
            const output = esbuildOutputs[key];

            if (output.entryPoint) {
              entryPoints[key] = output.entryPoint;
            }
          }

          return entryPoints;
        }

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
          compiledEntryPoints: Record<string, string>,
          options: PluginOptions,
        ): string[] => {
          const dirPath = path.dirname(pattern);
          const files = fs.readdirSync(dirPath, { recursive: true });
          const assets: string[] = [];

          // console.log(inputs)

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
            const destFileName =
              [baseName, fileHash].filter((item) => item !== null).join("-") + fileExtension;
            const destPath = path.join(
              options.destDir,
              path.relative(dirPath, srcPath).replace(path.basename(file.toString()), destFileName),
            );

            if (fs.lstatSync(srcPath).isDirectory()) {
              assets.push(...processAssetDirectory(destPath, compiledEntryPoints, options));
            } else {
              copyAsset(srcPath, destPath);
              assets.push(destPath);
            }
          });

          return assets;
        };

        if (typeof outputs === "undefined") {
          return;
        }

        // console.log(outputs)

        // TODO: change name of `inputs` to something clearer...
        const compiledEntryPoints = extractEsbuildCompiledEntrypoints(outputs);
        const copiedAssets: string[] = [];
        externalDirs.forEach((pattern) => {
          copiedAssets.push(...processAssetDirectory(pattern, compiledEntryPoints, options));
        });


        // Process entrypoints
        // WIP
        for (const compiledEntryPoint in compiledEntryPoints) {
          const destinationUrl = calulateDestinationUrl(compiledEntryPoint);
          const sourceUrl = compiledEntryPoints[compiledEntryPoint].replace(`${options.baseDir}/assets/js/`, "")

          var asset: Asset = { url: destinationUrl };

          if (options.sriAlgorithms.length > 0) {
            asset.sri = [];

            for (const algorithm of options.sriAlgorithms) {
              const subresourceIntegrity = calculateSubresourceIntegrity(algorithm, compiledEntryPoint);
              asset.sri.push(subresourceIntegrity);
            }
          }

          assetsManifest[sourceUrl] = asset;
        }

        // Process copied assets

        // TODO: rename var... these are not being processed, they're being put in the manifest
        // assetsToManifest?
        // const assetsToProcess = Object.keys(outputs).concat(copiedAssets);
        const assetsToProcess = copiedAssets;

        for (const assetToProcess of assetsToProcess) {
          if (assetToProcess.endsWith(".map")) {
            continue;
          }

          console.log(assetToProcess);
          console.log(options)
          const destinationUrl = calulateDestinationUrl(assetToProcess);
          // const sourceUrl = calulateSourceUrl(destinationUrl);
          const sourceUrl = calulateSourceUrl(assetToProcess);

          var asset: Asset = { url: destinationUrl };

          if (options.sriAlgorithms.length > 0) {
            asset.sri = [];

            for (const algorithm of options.sriAlgorithms) {
              const subresourceIntegrity = calculateSubresourceIntegrity(algorithm, assetToProcess);
              asset.sri.push(subresourceIntegrity);
            }
          }

          // console.log(destinationUrl)
          // console.log(sourceUrl)
          // console.log(asset)
          assetsManifest[sourceUrl] = asset;
        }

        // Write assets manifest to the destination directory
        await fs.writeJson(manifestPath, assetsManifest, { spaces: 2 });
      });
    },
  };
};

export default hanamiEsbuild;
