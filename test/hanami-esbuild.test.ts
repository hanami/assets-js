import fs from 'fs-extra';
import path from 'path';
import esbuild, { BuildOptions } from 'esbuild';
import hanamiEsbuild from '../src/hanami-esbuild';
import { globSync } from 'glob'
import { execSync } from 'child_process';

const originalWorkingDir = process.cwd();

const dest = path.resolve(__dirname, '..', 'tmp');
const outDir = path.join(dest, 'public/assets');
const loader = {};

// Helper function to create a test environment
async function createTestEnvironment() {
  // Create temporary directories
  await fs.ensureDir(path.join(dest, 'app/assets/javascripts'));
  await fs.ensureDir(path.join(dest, 'app/assets/images'));
  await fs.ensureDir(path.join(dest, 'slices/admin/assets/javascripts'));
  await fs.ensureDir(path.join(dest, 'public'));

  process.chdir(dest);
}

// Helper function to clean up the test environment
async function cleanTestEnvironment() {
  process.chdir(originalWorkingDir);
  await fs.remove(dest); // Comment this line to manually inspect precompile results
}

describe('hanamiEsbuild', () => {
  beforeEach(async () => {
    await createTestEnvironment();
  });

  afterEach(async () => {
    await cleanTestEnvironment();
  });

  test('copies assets from app/assets to public/assets and generates a manifest file', async () => {
    const entryPoint1 = path.join(dest, 'app/assets/javascripts/index.js');
    const entryPoint2 = path.join(dest, 'slices/admin/assets/javascripts/index.js');
    await fs.writeFile(entryPoint1, "console.log('Hello, World!');");
    await fs.writeFile(entryPoint2, "console.log('Hello, Admin!');");

    const entrypoints: Record<string, string> = {}

    // Normalize paths for entrypoints.
    ;[entryPoint1, entryPoint2].map((str) => {
      let modifiedPath = str.replace(/(app\/assets\/javascripts\/|slices\/(.*\/)assets\/javascripts\/)/, "$2")
      const relativePath = path.relative(dest, modifiedPath)

      const { dir, name } = path.parse(relativePath)

      if (dir) {
        modifiedPath = dir + path.sep + name
      } else {
        modifiedPath = name
      }
      entrypoints[modifiedPath] = str
    })

    console.log(entrypoints)
    const config: Partial<BuildOptions> = {
      bundle: true,
      outdir: outDir,
      loader: loader,
      logLevel: "silent",
      minify: true,
      sourcemap: true,
      entryNames: "[dir]/[name]-[hash]",
      plugins: [hanamiEsbuild()],
    }

    // TODO: Set esbuild defaults to the plugin
    await esbuild.build({
      ...config,
      entryPoints: entrypoints
      // {
      //   "index": entryPoint1 ,
      //   "admin/index": entryPoint2
      // },
    });

    execSync("tree .", {stdio: "inherit"})

    // FIXME: this path should take into account the file hashing in the file name
    const appAsset = globSync(path.join('public/assets/index-*.js'))[0]
    const appAssetExists = await fs.pathExists(appAsset);
    expect(appAssetExists).toBe(true);

    // FIXME: this path should take into account the file hashing in the file name
    const sliceAsset = globSync(path.join('public/assets/admin/index-*.js'))[0];
    const sliceAssetExists = await fs.pathExists(sliceAsset);
    expect(sliceAssetExists).toBe(true);

    // const manifestExists = await fs.pathExists(path.join(dest, 'public/assets.json'));
    // expect(manifestExists).toBe(true);

    // Read and parse the manifest file
    // const manifestContent = await fs.readFile(path.join(dest, 'public/assets.json'), 'utf-8');
    // const manifest = JSON.parse(manifestContent);

    // // Check if the manifest contains the correct file paths
    // expect(manifest).toEqual({
    // });
  });
});
