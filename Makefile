# Variables
BUILD_DIR := dist

# Targets
.PHONY: test
test: build
	npm test

publish: build
	NPM_CONFIG_REGISTRY=http://localhost:4873 npm unpublish hanami-esbuild --force
	NPM_CONFIG_REGISTRY=http://localhost:4873 npm publish

build:
	rm -rf $(BUILD_DIR)
	npm run build
	chmod +x $(BUILD_DIR)/hanami-esbuild.js
