import fs from 'fs-extra';
import path from 'path';
import { globSync } from 'glob'
import { execFileSync, execSync, spawnSync } from 'child_process';
import crypto from 'node:crypto';

const originalWorkingDir = process.cwd();
const binPath = path.join(originalWorkingDir, 'dist', 'hanami-assets.js');

const dest = path.resolve(__dirname, '..', 'tmp', crypto.randomUUID());

// Helper function to create a test environment
async function createTestEnvironment() {
  // Create temporary directories
  await fs.ensureDir(path.join(dest, 'app/assets/javascripts'));
  await fs.ensureDir(path.join(dest, 'app/assets/images'));
  await fs.ensureDir(path.join(dest, 'slices/admin/assets/javascripts'));
  await fs.ensureDir(path.join(dest, 'slices/metrics/assets/javascripts'));
  await fs.ensureDir(path.join(dest, 'public'));

  process.chdir(dest);
}

// Helper function to clean up the test environment
async function cleanTestEnvironment() {
  process.chdir(originalWorkingDir);
  await fs.remove(dest); // Comment this line to manually inspect precompile results
}

describe('hanami-assets', () => {
  beforeEach(async () => {
    await createTestEnvironment();
  });

  afterEach(async () => {
    await cleanTestEnvironment();
  });

  test('copies assets from app/assets to public/assets and generates a manifest file', async () => {
    const entryPoint1 = path.join(dest, 'app/assets/javascripts/app.js');
    const entryPoint2 = path.join(dest, 'slices/admin/assets/javascripts/app.js');
    const entryPoint3 = path.join(dest, 'slices/metrics/assets/javascripts/app.ts');
    await fs.writeFile(entryPoint1, "console.log('Hello, World!');");
    await fs.writeFile(entryPoint2, "console.log('Hello, Admin!');");
    await fs.writeFile(entryPoint3, "console.log('Hello, Metrics!');");

    execSync(binPath, { stdio: "inherit" })

    // FIXME: this path should take into account the file hashing in the file name
    const appAsset = globSync(path.join('public/assets/app-*.js'))[0]
    const appAssetExists = await fs.pathExists(appAsset);
    expect(appAssetExists).toBe(true);

    // FIXME: this path should take into account the file hashing in the file name
    const sliceAsset1 = globSync(path.join('public/assets/admin/app-*.js'))[0];
    const sliceAssetExists1 = await fs.pathExists(sliceAsset1);
    expect(sliceAssetExists1).toBe(true);

    // FIXME: this path should take into account the file hashing in the file name
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
      "admin/app.js": {
        "url": "/assets/admin/app-G3TTFD5I.js"
      },
      "app.js": {
        "url": "/assets/app-SMJS4SYG.js"
      },
      "metrics/app.js": {
        "url": "/assets/metrics/app-62A4ZWTV.js"
      },
    });
  });

  test('generates SRI', async () => {
    const entryPoint1 = path.join(dest, 'app/assets/javascripts/app.js');
    await fs.writeFile(entryPoint1, "console.log('Hello, World!');");

    execFileSync(binPath, ['--sri=sha256,sha384,sha512'], { stdio: "inherit" })

    // Read and parse the manifest file
    const manifestContent = await fs.readFile(path.join(dest, 'public/assets.json'), 'utf-8');
    const manifest = JSON.parse(manifestContent);

    // Check if the manifest contains the correct file paths
    expect(manifest).toEqual({
      "app.js": {
        "url": "/assets/app-SMJS4SYG.js",
        "sri": [
          "sha256-NXy3RVHksHBJVqQXCvl4bXhNrOLPyI6JY6aQwwscD3s=",
          "sha384-QJusYGV1R3duafMvNtieaCc3dWSULtYdTItexlRLPkpSbxdPLOtv7cDIt4xOtpTP",
          "sha512-Yer6vTccJNUWJaKZ54hAmwUSmjqfhFLyR/dXLQz0jlNAOCVw40+bSBBvWZCJOzRm8MYmqzElLdA7z2yeGPpVFg==",
        ]
      },
    });
  });

  test('Full app', async () => {
    fs.copySync(path.join(__dirname, 'fixtures', 'todo'), dest);

    execFileSync(binPath, ['--sri=sha384'], { stdio: "inherit" })

    // Read and parse the manifest file
    const manifestContent = await fs.readFile(path.join(dest, 'public/assets.json'), 'utf-8');
    const manifest = JSON.parse(manifestContent);

    // Check if the manifest contains the correct file paths
    expect(manifest).toEqual({
      "app.js": {
        "url": "/assets/app-F66C5HBN.js",
        "sri": [
          "sha384-HyjZlrfiFrDd3kcjk++Tkbv908eTWAXXMu6Nha8liVSuH9gr+3fG4OrYYBLY/iiw"
        ]
      },
      "background.jpg": {
        "url": "/assets/background-UU2XY655.jpg",
        "sri": [
          "sha384-M7QyKTUfzyVWNC4FoMYq0ypu7LDifAYWEtXRT5d6M3Prpau9t5wavW1216HhvCJc"
        ]
      },
      "app.css": {
        "url": "/assets/app-ISMEPBMJ.css",
        "sri": [
          "sha384-XI8KeiPqBbtxWX3JvD4OIos7cNGNHIPL8/MteaUxGWLS+Yp/nkE1fb4M9Gc2tvN2"
        ]
      },
      "login/app.js": {
        "url": "/assets/login/app-FUSCFK37.js",
        "sri": [
          "sha384-Wj7sxFDKOiC2c2nPfyDRvBHKG0LiwNiQYkoSKHD/COISJbiAlSLNwHhm0FGR8+KB"
        ]
      },
      "admin/app.js": {
        "url": "/assets/admin/app-3ROSYITC.js",
        "sri": [
          "sha384-DoWFNj0ynI1lJUvCY2R1DMBIoF10HoKT08ya5at4/jlGOOgPwWYfu0RF9Sq+Kcne"
        ]
      },
      "font.otf": {
        "url": "/assets/font-E1A70B27.otf",
        "sri": [
          "sha384-Lpm/oUsCQkOg41WyENyyB1zjaX/FB522VWlU44JKakwzwBxvu11le0ILkiPsR73K"
        ]
      },
      "logo.png": {
        "url": "/assets/logo-C1EF77E4.png",
        "sri": [
          "sha384-7q5x+ZjZrCoWwyV0BTyc8HUPf1xr+n9l77gwxmwywPWSe0PtopZj1T8NTUPFo0FI"
        ]
      }
    });
  });

  test("watch", async () => {
    const entryPoint = path.join(dest, "app/assets/javascripts/index.js");
    await fs.writeFile(entryPoint, "console.log('Hello, World!');");

    const appAsset = path.join("public/assets/index.js");

    // const childProcess = spawnSync(binPath, [" --watch"], {cwd: dest});
    // console.log(binPath);
    const result = spawnSync(binPath, ["--watch"], {cwd: dest});
    console.log(result.stdout.toString());
    await fs.writeFile(entryPoint, "console.log('Hello, Watch!');");

    const appAssetExists = await fs.pathExists(appAsset);
    expect(appAssetExists).toBe(true);

    // Read the asset file
    const assetContent = await fs.readFile(appAsset, "utf-8");

    // Check if the asset has the expected contents
    expect(assetContent).toEqual("console.log('Hello, Watch!');");

    // childProcess.kill("SIGHUP");
  });
});
