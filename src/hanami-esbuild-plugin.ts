import {
  BuildResult,
  Plugin,
  PluginBuild
} from 'esbuild';
import fs from 'fs-extra';
import path from 'path';

const URL_SEPARATOR = '/';

interface HanamiEsbuildPluginOptions {
  root: string;
  publicDir: string;
  destDir: string;
  manifestPath: string;
}

const defaults: Pick<HanamiEsbuildPluginOptions, 'root' | 'publicDir' | 'destDir' | 'manifestPath'> = {
  root: '',
  publicDir: 'public',
  destDir: path.join('public', 'assets'),
  manifestPath: path.join('public', 'assets.json')
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
        const assetsManifest: Record<string, string> = {};

        const calulateSourcePath = (str: string): string => {
          return normalizePath(str).replace(/\/assets\//, '').replace(/-[A-Z0-9]{8}/, '');
        }

        const calulateDestinationPath = (str: string): string => {
          return normalizePath(str).replace(/public/, '');
        }

        const normalizePath = (str: string): string => {
          return str.replace(/[\\]+/, URL_SEPARATOR);
        }

        if (typeof outputs === 'undefined') {
          return;
        }

        for (const key of Object.keys(outputs)) {
          if (key.endsWith('.map')) {
            continue;
          }

          const destinationPath = calulateDestinationPath(key);
          const sourcePath = calulateSourcePath(destinationPath);

          assetsManifest[sourcePath] = destinationPath;
        }

        // Write assets manifest to the destination directory
        await fs.writeJson(manifest, assetsManifest, { spaces: 2 });
      });
    },
  };
};

export default hanamiEsbuild;
