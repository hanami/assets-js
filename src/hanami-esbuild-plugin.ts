import {
  BuildResult,
  Plugin,
  PluginBuild
} from 'esbuild';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'node:crypto';

const URL_SEPARATOR = '/';

export interface HanamiEsbuildPluginOptions {
  root: string;
  publicDir: string;
  destDir: string;
  manifestPath: string;
  sriAlgorithms: Array<string>;
}

export const defaults: Pick<HanamiEsbuildPluginOptions, 'root' | 'publicDir' | 'destDir' | 'manifestPath' | 'sriAlgorithms'> = {
  root: '',
  publicDir: 'public',
  destDir: path.join('public', 'assets'),
  manifestPath: path.join('public', 'assets.json'),
  sriAlgorithms: [],
};

interface Asset {
  url: string;
  sri?: Array<string>;
}

const hanamiEsbuild = (options: HanamiEsbuildPluginOptions = { ...defaults }): Plugin => {
  return {
    name: 'hananmi-esbuild',

    setup(build: PluginBuild) {
      build.initialOptions.metafile = true;
      options.root = options.root || process.cwd();

      const manifest = path.join(options.root, options.manifestPath);
      const externalDirs = build.initialOptions.external || [];

      build.onEnd(async (result: BuildResult) => {
        const outputs = result.metafile?.outputs;
        const assetsManifest: Record<string, Asset> = {};

        const calulateSourceUrl = (str: string): string => {
          return normalizeUrl(str).replace(/\/assets\//, '').replace(/-[A-Z0-9]{8}/, '');
        }

        const calulateDestinationUrl = (str: string): string => {
          return normalizeUrl(str).replace(/public/, '');
        }

        const normalizeUrl = (str: string): string => {
          return str.replace(/[\\]+/, URL_SEPARATOR);
        }

        const calculateSubresourceIntegrity = (algorithm: string, path: string): string => {
          const content = fs.readFileSync(path, 'utf8');
          const hash = crypto.createHash(algorithm).update(content).digest('base64');

          return `${algorithm}-${hash}`;
        }

        // Inspired by https://github.com/evanw/esbuild/blob/2f2b90a99d626921d25fe6d7d0ca50bd48caa427/internal/bundler/bundler.go#L1057
        const calculateHash = (hashBytes: Uint8Array): string => {
          const hash = crypto.createHash('sha256').update(hashBytes).digest('hex');

          return hash.slice(0, 8).toUpperCase();
        }

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

        const copyAsset = (srcPath: string, destPath: string): boolean => {
          if (fs.existsSync(destPath)) {
            const srcStat = fs.statSync(srcPath);
            const destStat = fs.statSync(destPath);

            if (srcStat.mtimeMs <= destStat.mtimeMs) {
              // File already exists and is up-to-date, skip copying
              return false;
            }
          }

          if (!fs.existsSync(path.dirname(destPath))) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
          }

          fs.copyFileSync(srcPath, destPath);

          return true;
        };

        const processAssetDirectory = (pattern: string, inputs: Record<string, boolean>): string[] => {
          const dirPath = path.dirname(pattern);
          const files = fs.readdirSync(dirPath);
          const assets: string[] = [];

          files.forEach((file) => {
            const srcPath = path.join(dirPath, file);

            // Skip if the file is already processed by esbuild
            if (inputs.hasOwnProperty(srcPath)) {
              return;
            }

            const fileHash = calculateHash(fs.readFileSync(srcPath));
            const fileExtension = path.extname(srcPath);
            const baseName = path.basename(srcPath, fileExtension);
            const destFileName = `${baseName}-${fileHash}${fileExtension}`;
            const destPath = path.join(options.destDir, path.relative(dirPath, srcPath).replace(file, destFileName));

            if (fs.lstatSync(srcPath).isDirectory()) {
              assets.push(...processAssetDirectory(destPath, inputs));
            } else {
              const copied = copyAsset(srcPath, destPath);
              if (copied) {
                assets.push(destPath);
              }
            }
          });

          return assets;
        };

        if (typeof outputs === 'undefined') {
          return;
        }

        const inputs = extractEsbuildInputs(outputs);
        const copiedAssets: string[] = [];
        externalDirs.forEach((pattern) => {
          copiedAssets.push(...processAssetDirectory(pattern, inputs));
        });

        const assetsToProcess = Object.keys(outputs).concat(copiedAssets);

        for (const assetToProcess of assetsToProcess) {
          if (assetToProcess.endsWith('.map')) {
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
