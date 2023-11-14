# Variables
BUILD_DIR := dist

# Targets
ci: build lint test

.PHONY: test
test:
	npm test

build:
	rm -rf $(BUILD_DIR)
	npm run build

lint:
	npx prettier . --check
