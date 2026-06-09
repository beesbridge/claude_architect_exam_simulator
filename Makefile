# Claude Certified Architect – Foundations · Practice Exam Simulator
# Usage:
#   make server   -> ensure deps are healthy, then start the dev server
#   make install  -> install node dependencies
#   make reset    -> remove node_modules + lockfile and reinstall cleanly
#   make build    -> production build into ./dist
#   make preview  -> serve the production build
#   make clean    -> remove node_modules, lockfile, dist, and vite temp files

.PHONY: server install reset build preview clean

# Start the dev server. If the rollup native binary is missing (a known npm
# optional-dependency bug, common after copying/moving node_modules), do a
# clean reinstall automatically before starting.
server:
	@if [ ! -d node_modules ] || ! ls node_modules/@rollup/rollup-* >/dev/null 2>&1; then \
		echo ">> Dependencies missing or broken - running a clean reinstall..."; \
		$(MAKE) reset; \
	fi
	npm run dev

install:
	npm install

# Fixes the "Cannot find module @rollup/rollup-darwin-arm64" npm bug.
reset:
	rm -rf node_modules package-lock.json vite.config.js.timestamp-*.mjs
	npm install

build:
	@if [ ! -d node_modules ]; then $(MAKE) install; fi
	npm run build

preview: build
	npm run preview

clean:
	rm -rf node_modules package-lock.json dist vite.config.js.timestamp-*.mjs
