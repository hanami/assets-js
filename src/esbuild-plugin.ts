import { BuildResult, Plugin, PluginBuild } from "esbuild";
import fs from "fs-extra";
import path from "path";
import crypto from "node:crypto";

const URL_SEPARATOR = "/";

export interface PluginOptions {
  root: string;
  publicDir: string;
  destDir: string;
  manifestPath: string;
  sriAlgorithms: Array<string>;
  hash: boolean;
}

export const defaults: Pick<
  PluginOptions,
  "root" | "publicDir" | "destDir" | "manifestPath" | "sriAlgorithms" | "hash"
> = {
  root: "",
  publicDir: "public",
  destDir: path.join("public", "assets"),
  manifestPath: path.join("public", "assets.json"),
  sriAlgorithms: [],
  hash: true,
};

interface Asset {
  url: string;
  sri?: Array<string>;
}

const hanamiEsbuild = (options: PluginOptions = { ...defaults }): Plugin => {
  return {
    name: "hanami-esbuild",

    setup(build: PluginBuild) {
      build.initialOptions.metafile = true;
      options.root = options.root || process.cwd();

      const manifest = path.join(options.root, options.manifestPath);
      const externalDirs = build.initialOptions.external || [];

      build.onEnd(async (result: BuildResult) => {
        const outputs = result.metafile?.outputs;
        const assetsManifest: Record<string, Asset> = {};

        const calulateSourceUrl = (str: string): string => {
          return normalizeUrl(str)
            .replace(/\/assets\//, "")
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

        function extractEsbuildInputs(inputData: Record<string, any>): Record<string, boolean> {
          const inputs: Record<string, boolean> = {};

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
          inputs: Record<string, boolean>,
          options: PluginOptions,
        ): string[] => {
          const dirPath = path.dirname(pattern);
          const files = fs.readdirSync(dirPath, { recursive: true });
          const assets: string[] = [];

          files.forEach((file) => {
            const srcPath = path.join(dirPath, file.toString());
            // Skip if the file is not a file, i.e. a directory
            if (!fs.statSync(srcPath).isFile()) {
              return;
            }

            // Skip if the file is already processed by esbuild
            if (inputs.hasOwnProperty(srcPath)) {
              return;
            }

            const fileHash = calculateHash(fs.readFileSync(srcPath), options.hash);
            const fileExtension = path.extname(srcPath);
            const baseName = path.basename(srcPath, fileExtension);
            const destFileName =
              [baseName, fileHash].filter((item) => item !== null).join("-") + fileExtension;

            const pathMatcher = /(app\/assets\/.+?\/|slices\/(.*\/)assets\/.+?\/)/;
            const destPath = path.join(
              options.destDir,
              srcPath
                .replace(pathMatcher, "$2")
                .replace(path.basename(file.toString()), destFileName),
            );

            if (fs.lstatSync(srcPath).isDirectory()) {
              assets.push(...processAssetDirectory(destPath, inputs, options));
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

        const inputs = extractEsbuildInputs(outputs);
        const copiedAssets: string[] = [];
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

          var asset: Asset = { url: destinationUrl };

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
