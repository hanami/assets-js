import fs from "fs-extra";
import path from "path";
import { globSync } from "glob";
import crypto from "node:crypto";
import * as assets from "../src/hanami-assets";

const originalWorkingDir = process.cwd();
const dest = path.resolve(__dirname, "..", "tmp", crypto.randomUUID());
const watchTimeout = 60000; // ms (60 seconds)

// Helper function to create a test environment
async function createTestEnvironment() {
  // Create temporary directories
  await fs.ensureDir(path.join(dest, "app/assets/js"));
  await fs.ensureDir(path.join(dest, "app/assets/images"));
  await fs.ensureDir(path.join(dest, "slices/admin/assets/js"));
  await fs.ensureDir(path.join(dest, "slices/metrics/assets/js"));
  await fs.ensureDir(path.join(dest, "public"));

  process.chdir(dest);
}

// Helper function to clean up the test environment
async function cleanTestEnvironment() {
  process.chdir(originalWorkingDir);
  await fs.remove(dest); // Comment this line to manually inspect precompile results
}

describe("hanami-assets", () => {
  beforeEach(async () => {
    await createTestEnvironment();
  });

  afterEach(async () => {
    await cleanTestEnvironment();
  });

  test("copies assets from app/assets to public/assets and generates a manifest file", async () => {
    const entryPoint1 = path.join(dest, "app/assets/js/app.js");
    const entryPoint2 = path.join(dest, "slices/admin/assets/js/app.js");
    const entryPoint3 = path.join(dest, "slices/metrics/assets/js/app.ts");
    await fs.writeFile(entryPoint1, "console.log('Hello, World!');");
    await fs.writeFile(entryPoint2, "console.log('Hello, Admin!');");
    await fs.writeFile(entryPoint3, "console.log('Hello, Metrics!');");

    // Compile assets
    await assets.run(dest, []);

    // FIXME: this path should take into account the file hashing in the file name
    const appAsset = globSync(path.join("public/assets/app-*.js"))[0];
    const appAssetExists = await fs.pathExists(appAsset);
    expect(appAssetExists).toBe(true);

    // FIXME: this path should take into account the file hashing in the file name
    const sliceAsset1 = globSync(path.join("public/assets/admin/app-*.js"))[0];
    const sliceAssetExists1 = await fs.pathExists(sliceAsset1);
    expect(sliceAssetExists1).toBe(true);

    // FIXME: this path should take into account the file hashing in the file name
    const sliceAsset2 = globSync(path.join("public/assets/metrics/app-*.js"))[0];
    const sliceAssetExists2 = await fs.pathExists(sliceAsset2);
    expect(sliceAssetExists2).toBe(true);

    const manifestExists = await fs.pathExists(path.join(dest, "public/assets.json"));
    expect(manifestExists).toBe(true);

    // Read and parse the manifest file
    const manifestContent = await fs.readFile(path.join(dest, "public/assets.json"), "utf-8");
    const manifest = JSON.parse(manifestContent);

    // Check if the manifest contains the correct file paths
    expect(manifest).toEqual({
      "admin/app.js": {
        url: "/assets/admin/app-NLRESL5A.js",
      },
      "app.js": {
        url: "/assets/app-JLSTK5SN.js",
      },
      "metrics/app.js": {
        url: "/assets/metrics/app-27Z7ZALS.js",
      },
    });
  });

  test("generates SRI", async () => {
    const entryPoint1 = path.join(dest, "app/assets/js/app.js");
    await fs.writeFile(entryPoint1, "console.log('Hello, World!');");

    // Compile assets
    await assets.run(dest, ["--sri=sha256,sha384,sha512"]);

    // Read and parse the manifest file
    const manifestContent = await fs.readFile(path.join(dest, "public/assets.json"), "utf-8");
    const manifest = JSON.parse(manifestContent);

    // Check if the manifest contains the correct file paths
    expect(manifest).toEqual({
      "app.js": {
        url: "/assets/app-JLSTK5SN.js",
        sri: [
          "sha256-p4j9argOiwyiBIBi7v4H0WUnv6z3kmFjqmManMEJXfo=",
          "sha384-gkA54jmSv7TBjiSzGrfO/uCR5CyUrQSUSUYrnM0lICIaP5ppqcN8PLVE3mNj87sN",
          "sha512-ZCJAQgHAxcBP7xEuQ3W/pZqqI611aX9oEk0QvDG4Etq6bkvxQMWHrHk2npCytWchOTN1yKM7TLj9Vsp1Id0j6g==",
        ],
      },
    });
  });

  test("Full app", async () => {
    fs.copySync(path.join(__dirname, "fixtures", "todo"), dest);

    // Compile assets
    await assets.run(dest, ["--sri=sha384"]);

    // Read and parse the manifest file
    const manifestContent = await fs.readFile(path.join(dest, "public/assets.json"), "utf-8");
    const manifest = JSON.parse(manifestContent);

    // Check if the manifest contains the correct file paths
    expect(manifest).toEqual({
      "app.js": {
        url: "/assets/app-QFCHLRMD.js",
        sri: ["sha384-tn8zwUHIJjEPGmD6vZ2DKmY6LlbNkI86ltpSiBxcCICkETm5g4sMDV0oF2I+8xDz"],
      },
      "background.jpg": {
        url: "/assets/background-UU2XY655.jpg",
        sri: ["sha384-M7QyKTUfzyVWNC4FoMYq0ypu7LDifAYWEtXRT5d6M3Prpau9t5wavW1216HhvCJc"],
      },
      "app.css": {
        url: "/assets/app-REBB4IZN.css",
        sri: ["sha384-ZqNcOOnG1W+Udcquy7qBs4b51X1cq8Bkv0CMEIt5I20+TWmW33pLUHl54ueCnyFD"],
      },
      "login/app.js": {
        url: "/assets/login/app-SV7Q442Q.js",
        sri: ["sha384-fkk3ZtSsrBOPtmKaOSoHC5IKdaphOeG05j0Z3iQPrJdbQAxsAmCkJMNQphDyL8E2"],
      },
      "admin/app.js": {
        url: "/assets/admin/app-XJBJOVJT.js",
        sri: ["sha384-aqVgGQ+qnJfgFqVoOlHBEEQ1eUtNDN5cQu9EdUW7gIGT9VaUN8H2yw5ai+lW+jc9"],
      },
      "font.otf": {
        url: "/assets/font-E1A70B27.otf",
        sri: ["sha384-Lpm/oUsCQkOg41WyENyyB1zjaX/FB522VWlU44JKakwzwBxvu11le0ILkiPsR73K"],
      },
      "logo.png": {
        url: "/assets/logo-C1EF77E4.png",
        sri: ["sha384-7q5x+ZjZrCoWwyV0BTyc8HUPf1xr+n9l77gwxmwywPWSe0PtopZj1T8NTUPFo0FI"],
      },
    });
  });

  test(
    "watch",
    async () => {
      const images = path.join(dest, "app", "assets", "images");
      await fs.ensureDir(images);
      fs.copySync(
        path.join(__dirname, "fixtures", "todo", "app", "assets", "images", "background.jpg"),
        path.join(images, "background.jpg"),
      );

      const entryPoint = path.join(dest, "app", "assets", "js", "app.js");
      await fs.writeFile(entryPoint, "console.log('Hello, World!');");

      const appAsset = path.join(dest, "public", "assets", "app.js");
      const imageAsset = path.join(dest, "public", "assets", "background.jpg");

      // Watch for asset changes
      let ctx = await assets.run(dest, ["--watch"]);

      await fs.writeFile(entryPoint, "console.log('Hello, Watch!');");

      const appAssetExists = (timeout = watchTimeout): Promise<boolean> => {
        return new Promise((resolve, reject) => {
          let elapsedTime = 0;
          const intervalTime = 100;

          const interval = setInterval(() => {
            if (fs.existsSync(appAsset)) {
              clearInterval(interval);
              resolve(true);
            }

            elapsedTime += intervalTime;
            if (elapsedTime >= timeout) {
              clearInterval(interval);
              reject(false);
            }
          }, intervalTime);
        });
      };

      const found = await appAssetExists();
      expect(found).toBe(true);

      expect(fs.existsSync(imageAsset)).toBe(true);

      // Read the asset file
      const assetContent = await fs.readFile(appAsset, "utf-8");

      // Check if the asset has the expected contents
      expect(assetContent).toMatch('console.log("Hello, Watch!");');

      const manifestExists = await fs.pathExists(path.join(dest, "public/assets.json"));
      expect(manifestExists).toBe(true);

      // Read and parse the manifest file
      const manifestContent = await fs.readFile(path.join(dest, "public/assets.json"), "utf-8");
      const manifest = JSON.parse(manifestContent);

      expect(manifest["background.jpg"]).toEqual({
        url: "/assets/background.jpg",
      });

      await ctx!.dispose();
    },
    watchTimeout + 1000,
  );
});
