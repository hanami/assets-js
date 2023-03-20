import {
  // BuildResult,
  // Metafile,
  Plugin,
  PluginBuild
} from 'esbuild';
import fs from 'fs-extra';
import path from 'path';

interface HanamiEsbuildOptions {
  root: string;
  publicDir: string;
  destDir: string;
}

const defaults: Pick<HanamiEsbuildOptions, 'root' | 'publicDir' | 'destDir'> = {
  root: '',
  publicDir: 'public',
  destDir: path.join('public', 'assets'),
};

const hanamiEsbuild = (options: HanamiEsbuildOptions = { ...defaults }): Plugin => {
  return {
    name: 'hananmi-esbuild',

    setup(build: PluginBuild) {
      build.initialOptions.metafile = true;
      options.root = options.root || process.cwd();

      fs.ensureDir(path.join(options.root, options.destDir));

      // Resolve assets from app/assets to public/assets
      // Example: app/assets/javascripts/index.js -> public/assets/index.js
      build.onResolve({ filter: /app(\/|\\)assets/ }, async (args: any) => {
        // FIXME: review which path is needed and which is not
        // FIXME: review file system path destinations vs mapped URLs
        const relativePath = path.relative(options.root, args.path);
        const resolvedPath = relativePath.replace(/app(\/|\\)assets(\/|\\)javascripts(\/|\\)/, "");
        const destinationPath = path.join(options.root, options.destDir, resolvedPath);

        return { }
      });

      // Resolve assets from slices/*/assets to public/assets/<slice_name>
      // Example: slices/admin/assets/javascripts/index.js -> public/assets/admin/index.js
      build.onResolve({ filter: /slices(\/|\\)(.*)(\/|\\)assets/ }, (args: any) => {
        // FIXME: review which path is needed and which is not
        // FIXME: review file system path destinations vs mapped URLs
        const relativePath = path.relative(options.root, args.path);
        const sliceName = relativePath.split(path.sep)[1];
        const resolvedPath = relativePath.replace(/slices(\/|\\)(.*)(\/|\\)assets(\/|\\)javascripts(\/|\\)/, `${sliceName}${path.sep}`);
        const destinationPath = path.join(options.root, options.destDir, resolvedPath);

        fs.ensureDir(path.join(options.root, options.destDir, sliceName));

        return { }
      });

      // build.onEnd(async () => {
      //   const srcDir = path.join('app', 'assets');
      //   const publicDir = path.join('public');
      //   const destDir = path.join(publicDir, 'assets');
      //   const manifestFile = 'assets.json';

      //   // Ensure the destination directory exists
      //   await fs.ensureDir(destDir);

      //   // Get a list of files from the source directory
      //   const files = await fs.readdir(srcDir);
      //   const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.scss', '.sass', '.less', '.woff', '.woff2', '.eot', '.ttf', '.otf'];

      //   // Copy assets from the source directory to the destination directory
      //   const copiedAssets = files.filter((file: string) => {
      //     const ext = path.extname(file);
      //     return allowedExtensions.includes(ext);
      //   });

      //   // Copy the filtered files
      //   await Promise.all(
      //     copiedAssets.map((asset: string) => {
      //       // const src = path.join(srcDir, asset);
      //       // const dest = path.join(destDir, asset);
      //       // return fs.copy(src, dest);
      //     }),
      //   );

      //   // Generate assets manifest
      //   const assetsManifest: Record<string, string> = {};

      //   for (const assetPath of copiedAssets) {
      //     const newPath = path.join(destDir, assetPath);
      //     assetsManifest[assetPath] = newPath;
      //   }

      //   // Write assets manifest to the destination directory
      //   await fs.writeJson(path.join(publicDir, manifestFile), assetsManifest, { spaces: 2 });

      //   // console.log(`Assets have been copied from '${srcDir}' to '${destDir}'.`);
      //   // console.log(`Assets manifest has been written to '${path.join(publicDir, manifestFile)}'.`);
      // });
    },
  };
};

export default hanamiEsbuild;
