import {
  BuildResult,
  Plugin,
  PluginBuild
} from 'esbuild';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'node:crypto';

const URL_SEPARATOR = '/';

interface HanamiEsbuildPluginOptions {
  root: string;
  publicDir: string;
  destDir: string;
  manifestPath: string;
  sriAlgorithm: string;
}

const defaults: Pick<HanamiEsbuildPluginOptions, 'root' | 'publicDir' | 'destDir' | 'manifestPath' | 'sriAlgorithm'> = {
  root: '',
  publicDir: 'public',
  destDir: path.join('public', 'assets'),
  manifestPath: path.join('public', 'assets.json'),
  sriAlgorithm: 'sha256',
};

const hanamiEsbuild = (options: HanamiEsbuildPluginOptions = { ...defaults }): Plugin => {
  return {
    name: 'hananmi-esbuild',

    setup(build: PluginBuild) {
      build.initialOptions.metafile = true;
      options.root = options.root || process.cwd();

      const manifest = path.join(options.root, options.manifestPath);

      build.onEnd(async (result: BuildResult) => {
        const outputs = result.metafile?.outputs;
        const assetsManifest: Record<string, Record<string, string>> = {};

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
          const subresourceIntegrity = calculateSubresourceIntegrity(options.sriAlgorithm, key);

          assetsManifest[sourceUrl] = { "url": destinationUrl, "sri": subresourceIntegrity };
        }

        // Write assets manifest to the destination directory
        await fs.writeJson(manifest, assetsManifest, { spaces: 2 });
      });
    },
  };
};

export default hanamiEsbuild;
