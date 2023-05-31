# Variables
BUILD_DIR := dist

# Targets
.PHONY: test
test: build
	npm test

build:
	rm -rf $(BUILD_DIR)
	npm run build
	chmod +x $(BUILD_DIR)/hanami-assets.js
