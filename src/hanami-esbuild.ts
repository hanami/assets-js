import {
  BuildResult,
  Plugin,
  PluginBuild
} from 'esbuild';
import fs from 'fs-extra';
import path from 'path';

interface HanamiEsbuildOptions {
  root: string;
  publicDir: string;
  destDir: string;
  manifestPath: string;
}

const defaults: Pick<HanamiEsbuildOptions, 'root' | 'publicDir' | 'destDir' | 'manifestPath'> = {
  root: '',
  publicDir: 'public',
  destDir: path.join('public', 'assets'),
  manifestPath: path.join('public', 'assets.json')
};

const hanamiEsbuild = (options: HanamiEsbuildOptions = { ...defaults }): Plugin => {
  return {
    name: 'hananmi-esbuild',

    setup(build: PluginBuild) {
      build.initialOptions.metafile = true;
      options.root = options.root || process.cwd();

      build.onEnd(async (result: BuildResult) => {
        const outputs = result.metafile?.outputs;
        const assetsManifest: Record<string, string> = {};

        if (typeof outputs === 'undefined') {
          return;
        }

        for (const key of Object.keys(outputs)) {
          if (key.endsWith('.map')) {
            continue;
          }

          const destinationPath = key.replace(/public/, '');
          const sourcePath = destinationPath.replace(/(\/|\\)assets(\/|\\)/, '').replace(/-[A-Z0-9]{8}/, '');

          assetsManifest[sourcePath] = destinationPath;
        }

        // Write assets manifest to the destination directory
        await fs.writeJson(options.manifestPath, assetsManifest, { spaces: 2 });
      });
    },
  };
};

export default hanamiEsbuild;
