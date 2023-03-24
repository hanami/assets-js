import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob'
import { execSync, spawn } from 'child_process';

const originalWorkingDir = process.cwd();
const binPath = path.join(originalWorkingDir, 'dist', 'hanami-esbuild.js');

const dest = path.resolve(__dirname, '..', 'tmp');

// Helper function to create a test environment
async function createTestEnvironment() {
  // Create temporary directories
  await fs.ensureDir(path.join(dest, 'app/assets/javascripts'));
  await fs.ensureDir(path.join(dest, 'public'));

  process.chdir(dest);
}

// Helper function to clean up the test environment
async function cleanTestEnvironment() {
  process.chdir(originalWorkingDir);
  // await fs.remove(dest); // Comment this line to manually inspect precompile results
}

describe('hanamiEsbuild', () => {
  beforeEach(async () => {
    await createTestEnvironment();
  });

  afterEach(async () => {
    await cleanTestEnvironment();
  });

  xtest('precompile', async () => {
    await fs.ensureDir(path.join(dest, 'app/assets/images'));
    await fs.ensureDir(path.join(dest, 'slices/admin/assets/javascripts'));
    await fs.ensureDir(path.join(dest, 'slices/metrics/assets/javascripts'));

    const entryPoint1 = path.join(dest, 'app/assets/javascripts/index.js');
    const entryPoint2 = path.join(dest, 'slices/admin/assets/javascripts/index.js');
    const entryPoint3 = path.join(dest, 'slices/metrics/assets/javascripts/app.ts');

    await fs.writeFile(entryPoint1, "console.log('Hello, World!');");
    await fs.writeFile(entryPoint2, "console.log('Hello, Admin!');");
    await fs.writeFile(entryPoint3, "console.log('Hello, Metrics!');");

    execSync(binPath, {stdio: "inherit"})

    const appAsset = globSync(path.join('public/assets/index-*.js'))[0]
    const appAssetExists = await fs.pathExists(appAsset);
    expect(appAssetExists).toBe(true);

    const sliceAsset1 = globSync(path.join('public/assets/admin/index-*.js'))[0];
    const sliceAssetExists1 = await fs.pathExists(sliceAsset1);
    expect(sliceAssetExists1).toBe(true);

    const sliceAsset2 = globSync(path.join('public/assets/metrics/app-*.js'))[0];
    const sliceAssetExists2 = await fs.pathExists(sliceAsset2);
    expect(sliceAssetExists2).toBe(true);

    const manifestExists = await fs.pathExists(path.join(dest, 'public/assets.json'));
    expect(manifestExists).toBe(true);

    // Read and parse the manifest file
    const manifestContent = await fs.readFile(path.join(dest, 'public/assets.json'), 'utf-8');
    const manifest = JSON.parse(manifestContent);

    // Check if the manifest contains the correct file paths
    expect(manifest).toEqual({
      "admin/index.js": "/assets/admin/index-YMWJCFAK.js",
      "index.js": "/assets/index-A3EJVGR4.js",
      "metrics/app.js": "/assets/metrics/app-62A4ZWTV.js",
    });
  });

  test('watch', async () => {
    const entryPoint = path.join(dest, 'app/assets/javascripts/index.js');
    await fs.writeFile(entryPoint, "console.log('Hello, World!');");

    const appAsset = path.join('public/assets/index.js');

    const childProcess = spawn(binPath, [' --watch'], {cwd: dest});
    await fs.writeFile(entryPoint, "console.log('Hello, Watch!');");

    const appAssetExists = await fs.pathExists(appAsset);
    expect(appAssetExists).toBe(true);

    // Read the asset file
    const assetContent = await fs.readFile(appAsset, 'utf-8');

    // Check if the asset has the expected contents
    expect(assetContent).toEqual("console.log('Hello, Watch!');");

    childProcess.kill('SIGHUP');
  });
});
