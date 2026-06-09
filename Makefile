# Claude Certified Architect – Foundations · Practice Exam Simulator
# Usage:
#   make server   -> run locally (Vite + local SQLite API) on http://localhost:5173
#   make web      -> run only the Vite front-end (no local backend)
#   make install  -> install node dependencies
#   make reset    -> remove node_modules + lockfile and reinstall cleanly
#   make build    -> production build into ./dist (for Vercel)
#   make preview  -> serve the production build
#   make clean    -> remove node_modules, lockfile, dist, vite temp files
#   make clean-db -> delete the local SQLite database

.PHONY: server web install reset build preview clean clean-db

# Local development: front-end + local SQLite-backed API together.
# Reinstalls if deps are missing/broken (incl. the npm rollup optional-dep bug,
# or a stale node_modules that predates the backend dependencies).
server:
	@if [ ! -d node_modules ] \
		|| ! ls node_modules/@rollup/rollup-* >/dev/null 2>&1 \
		|| [ ! -d node_modules/better-sqlite3 ] \
		|| [ ! -d node_modules/concurrently ] \
		|| [ ! -d node_modules/@supabase ]; then \
		echo ">> Dependencies missing or out of date - running a clean reinstall..."; \
		$(MAKE) reset; \
	fi
	npm run dev:local

web:
	@if [ ! -d node_modules ]; then $(MAKE) install; fi
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

clean-db:
	rm -rf server/data
