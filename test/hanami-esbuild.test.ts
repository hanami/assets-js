import fs from 'fs-extra';
import path from 'path';
import esbuild from 'esbuild';
import hanamiEsbuild from '../src/hanami-esbuild';

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

    // TODO: Set esbuild defaults to the plugin
    await esbuild.build({
      entryPoints: [entryPoint1, entryPoint2],
      bundle: true,
      outdir: outDir,
      loader: loader,
      logLevel: "silent",
      minify: true,
      sourcemap: true,
      entryNames: "[name]-[hash]",
      plugins: [hanamiEsbuild()],
    });

    // FIXME: this path should take into account the file hashing in the file name
    const appAssetExists = await fs.pathExists(path.join(dest, 'public/assets/index.js'));
    expect(appAssetExists).toBe(true);

    // FIXME: this path should take into account the file hashing in the file name
    const sliceAssetExists = await fs.pathExists(path.join(dest, 'public/assets/admin/index.js'));
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
