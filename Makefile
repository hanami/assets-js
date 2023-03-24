# Variables
BUILD_DIR := dist

# Targets
.PHONY: test
test:
	rm -rf $(BUILD_DIR)
	npm run build
	chmod +x $(BUILD_DIR)/hanami-esbuild.js
	npm test
