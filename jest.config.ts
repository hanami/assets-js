import type { JestConfigWithTsJest } from "ts-jest"

const config: JestConfigWithTsJest = {
  testEnvironment: "node",
  testMatch: [
    "**/test/**/*.test.ts",
  ],
  // See https://kulshekhar.github.io/ts-jest/docs/guides/esm-support#esm-presets for below
  preset: "ts-jest/presets/default-esm",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest", {
        useESM: true,
      },
    ],
  },
}

export default config
