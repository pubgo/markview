package static

import "embed"

//go:generate sh -c "cd ../../frontend && sh scripts/pnpm-install-safe.sh && pnpm run build"

//go:embed all:dist
var Frontend embed.FS
