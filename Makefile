.PHONY: build build-no-cache serve

# Build vocabulary.json using caches (default)
vocabulary-build:
	@echo "Building vocabulary.json (using caches)..."
	python3 scripts/build_vocabulary.py

# Build vocabulary.json without using caches
vocabulary-build-no-cache:
	@echo "Building vocabulary.json (without caches)..."
	python3 scripts/build_vocabulary.py --no-cache

# Run local development server
serve:
	@echo "Starting local server on http://localhost:8000"
	@echo "Press Ctrl+C to stop"
	python3 -m http.server 8000
