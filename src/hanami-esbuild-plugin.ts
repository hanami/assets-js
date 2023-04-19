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

        if (typeof outputs === 'undefined') {
          return;
        }

        for (const key of Object.keys(outputs)) {
          if (key.endsWith('.map')) {
            continue;
          }

          const destinationUrl = calulateDestinationUrl(key);
          const sourceUrl = calulateSourceUrl(destinationUrl);

          var asset: Asset = { url: destinationUrl };

          if (options.sriAlgorithms.length > 0) {
            asset.sri = [];

            for (const algorithm of options.sriAlgorithms) {
              const subresourceIntegrity = calculateSubresourceIntegrity(algorithm, key);
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
