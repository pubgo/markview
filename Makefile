PKG = github.com/kooksee/markview
COMMIT = $(shell git rev-parse --short HEAD)

BUILD_LDFLAGS = "-s -w -X $(PKG)/version.Revision=$(COMMIT)"
MARP = pnpm dlx @marp-team/marp-cli
SLIDES_FILE ?= docs/slides/tech-talk-template.md
SLIDES_THEME ?= docs/slides/theme-markview.css
SLIDES_PDF ?= docs/slides/tech-talk-template.pdf
SLIDES_PPTX ?= docs/slides/tech-talk-template.pptx

default: test

ci: depsdev generate test

slides-preview:
	$(MARP) $(SLIDES_FILE) --theme-set $(SLIDES_THEME) --preview

slides-pdf:
	$(MARP) $(SLIDES_FILE) --theme-set $(SLIDES_THEME) --pdf -o $(SLIDES_PDF)

slides-pptx:
	$(MARP) $(SLIDES_FILE) --theme-set $(SLIDES_THEME) --pptx -o $(SLIDES_PPTX)

generate:
	go generate ./internal/static/

test:
	cd frontend && sh scripts/pnpm-install-safe.sh && pnpm run test:coverage
	go test ./... -coverprofile=coverage.out -covermode=count -count=1

build: generate
	go build -ldflags=$(BUILD_LDFLAGS) -trimpath -o markview .

install: generate
	go install -ldflags=$(BUILD_LDFLAGS) -trimpath .

dev: build
	./markview -p 16275 --foreground $(ARGS)

screenshot: build
	cd frontend && pnpm run screenshots

lint:
	cd frontend && sh scripts/pnpm-install-safe.sh && pnpm run lint
	golangci-lint run ./...
	go vet -vettool=`which gostyle` -gostyle.config=$(PWD)/.gostyle.yml ./...

fmt:
	cd frontend && sh scripts/pnpm-install-safe.sh && pnpm run fmt

fmt-check:
	cd frontend && sh scripts/pnpm-install-safe.sh && pnpm run fmt:check

depsdev:
	go install github.com/Songmu/gocredits/cmd/gocredits@latest
	go install github.com/k1LoW/gostyle@latest

credits: depsdev generate
	go mod download
	gocredits -w .
	cd frontend && MARKVIEW_BUILD_CREDITS=1 pnpm run build
	printf "\n================================================================\n\n" >> CREDITS
	cat frontend/CREDITS_FRONTEND >> CREDITS

prerelease_for_tagpr: credits
	git add CHANGELOG.md CREDITS go.mod go.sum

.PHONY: default ci generate test build dev screenshot lint fmt fmt-check depsdev credits prerelease_for_tagpr slides-preview slides-pdf slides-pptx
