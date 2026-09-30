# Changelog

## v0.21.0 - 2026-09-30

演示遥控完整落地：手机扫码即成遥控提词器（看备注、计时、翻页、控制投屏页备注显隐）。

### New Features 🎉
- feat: teleprompter timer and cross-device remote control via server relay (#39)：提词器计时器（暂停/继续/归零）；服务器中继（POST messages + SSE events），`remote=1` 提词器 URL 在局域网任意设备可用
- feat: scan-to-remote QR for the presenter in slides toolbar (#41)：slides 工具栏「手机遥控」按钮弹出二维码（lan-hint 自动解析局域网地址），扫码即开遥控页
- feat: remote toggle for the projector page notes panel (#43)：手机远程开关投屏页备注面板；「手机遥控」会话默认隐藏投屏页备注

### Fix bug 🐛
- fix: extract presenter session via mux PathValue (#40)：会话提取误用 `path.Base` 导致遥控收发不在同一会话（端到端实测发现，附 mux 级回归测试）
- fix: late-joining presenter devices now sync immediately (#42)：中继回放每会话最后一条消息 + 主窗口 5s 心跳重发，手机任意时刻扫码数秒内同步

### Other Changes
- test: add image placeholder fixture to testdata
- docs: slides 超高内容裁剪问题记入 roadmap (#37)

## v0.20.0 - 2026-09-30

性能与导出能力大幅增强：首屏 gzip 从 ~3.79MB 降至 ~456KB（-88%），PlantUML 支持自托管离线渲染，`markview` 命令直接接受目录输入。

### New Features 🎉
- feat: configurable PlantUML server URL for offline rendering (#32)：设置 → 渲染配置自托管 Kroki，修改后图表自动重渲染
- feat: `markview build --group` for single-group static export (#33)
- feat: retryable placeholder for failed images (#34)：图片加载失败显示占位 + 重试按钮（含本地图片）
- feat: slide transition options (fade / slide / none) (#35)：slides 工具栏选择，`prefers-reduced-motion` 自动禁用
- feat: `markview <directory>` opens all .md/.mdx under it (#36)：目录递归展开，跳过 .git/node_modules/vendor

### Performance ⚡
- perf: lazy-load mermaid, graph views, and the PDF stack (#29)：首屏 3.79MB → 2.06MB gzip
- perf: lazy-load shiki (#30)：首屏降至 ~456KB；rolldown 虚拟 helper 归属修正（`codeSplitting.groups`）

### Other Changes
- ci: guard first-screen bundle size at 640KB gzip (#31)：CI 体积守门，`BUNDLE_LIMIT_KB` 可调
- docs: add rolling roadmap with engineering and bundle baselines (#28)；slides 超高内容裁剪问题记入 roadmap (#37)

## v0.19.0 - 2026-09-29

首个由 pubgo/markview 完全自主维护的版本；Go module 迁移为 `github.com/pubgo/markview`，发版方式改为手动推送 `v*` tag 触发 goreleaser。安装请使用 [release 二进制](https://github.com/pubgo/markview/releases)（前端资源为构建期生成并嵌入，不支持 `go install module@version`）。

### New Features 🎉
- feat: unify diagram PNG copy and PDF wait across chart types (#21)：Mermaid / PlantUML / SvgBob 三种图表统一支持悬停复制 PNG，应用内 PDF 导出等待三种图表渲染完成
- feat: add reusable GitHub Pages workflow for other repos (#19)

### Other Changes
- fix: build markview from source in pages-reusable (#20)
- chore: migrate module and docs to pubgo/markview (#22)
- chore: remove tagpr, fix workflow triggers and credits generation (#23)：ci/build-artifacts/trivy 的 push 触发分支修正为 master；`make credits` 改为直接生成 goreleaser 打包的 docs/CREDITS
- ci: pin gostyle to v0.26.0 for go 1.26.0 toolchain (#21)

## [v0.18.1](https://github.com/kooksee/markview/compare/v0.18.0...v0.18.1) - 2026-03-10
### Other Changes
- feat: add --skip-bind-address-confirmation flag to bypass non-loopback bind prompt by @110y in https://github.com/kooksee/markview/pull/103
- fix: rename --skip-bind-address-confirmation to --dangerously-allow-remote-access by @k1LoW in https://github.com/kooksee/markview/pull/105

## [v0.18.0](https://github.com/kooksee/markview/compare/v0.17.0...v0.18.0) - 2026-03-10
### New Features 🎉
- feat: add wide/narrow layout toggle by @k1LoW in https://github.com/kooksee/markview/pull/101
### Other Changes
- fix: add accessibility attributes to all toggle buttons by @k1LoW in https://github.com/kooksee/markview/pull/102

## [v0.17.0](https://github.com/kooksee/markview/compare/v0.16.3...v0.17.0) - 2026-03-10
### New Features 🎉
- Proposal: add --bind flag to specify listen address by @110y in https://github.com/kooksee/markview/pull/96
- feat: add security warning with confirmation prompt for non-localhost --bind by @k1LoW in https://github.com/kooksee/markview/pull/98

## [v0.16.3](https://github.com/kooksee/markview/compare/v0.16.2...v0.16.3) - 2026-03-10
### Fix bug 🐛
- fix: render Mermaid charts using actual container width by @k1LoW in https://github.com/kooksee/markview/pull/95
### Other Changes
- refactor: replace eslint with oxlint/oxfmt by @k1LoW in https://github.com/kooksee/markview/pull/93

## [v0.16.2](https://github.com/kooksee/markview/compare/v0.16.1...v0.16.2) - 2026-03-09
### Fix bug 🐛
- Remove stale files when a watched directory is moved by @110y in https://github.com/kooksee/markview/pull/91

## [v0.16.1](https://github.com/kooksee/markview/compare/v0.16.0...v0.16.1) - 2026-03-09
### New Features 🎉
- feat: preserve scroll position across live-reload and server restart by @k1LoW in https://github.com/kooksee/markview/pull/90
### Other Changes
- feat: add ESLint to frontend and fix all lint errors by @k1LoW in https://github.com/kooksee/markview/pull/88

## [v0.16.0](https://github.com/kooksee/markview/compare/v0.15.2...v0.16.0) - 2026-03-08
### Breaking Changes 🛠
- feat: display deeplinks when adding files via CLI by @k1LoW in https://github.com/kooksee/markview/pull/86
- feat: route processable output to stdout and add --json flag by @k1LoW in https://github.com/kooksee/markview/pull/87
### New Features 🎉
- feat: add LaTeX/math rendering support with KaTeX by @ysaito8015 in https://github.com/kooksee/markview/pull/84
- feat: add drag-and-drop file addition from OS file manager by @k1LoW in https://github.com/kooksee/markview/pull/85
### Other Changes
- feat: use deterministic hash-based file IDs for deep linking by @k1LoW in https://github.com/kooksee/markview/pull/81

## [v0.15.2](https://github.com/kooksee/markview/compare/v0.15.1...v0.15.2) - 2026-03-07
### Other Changes
- fix: always restore backup when starting a new server by @k1LoW in https://github.com/kooksee/markview/pull/80

## [v0.15.1](https://github.com/kooksee/markview/compare/v0.15.0...v0.15.1) - 2026-03-06

## [v0.15.0](https://github.com/kooksee/markview/compare/v0.14.1...v0.15.0) - 2026-03-06
### New Features 🎉
- feat: add auto-backup and restore for sessions by @k1LoW in https://github.com/kooksee/markview/pull/76

## [v0.14.1](https://github.com/kooksee/markview/compare/v0.14.0...v0.14.1) - 2026-03-06
### Fix bug 🐛
- fix: fix group dropdown not showing when no default group exists by @k1LoW in https://github.com/kooksee/markview/pull/75

## [v0.14.0](https://github.com/kooksee/markview/compare/v0.13.1...v0.14.0) - 2026-03-06
### New Features 🎉
- feat: add --restart flag by @k1LoW in https://github.com/kooksee/markview/pull/71
- Add file search filtering to sidebar by @harakeishi in https://github.com/kooksee/markview/pull/72
- feat: reload all browser tabs on server restart by @k1LoW in https://github.com/kooksee/markview/pull/70
### Fix bug 🐛
- fix: render code blocks without language using Shiki and copy button by @babarot in https://github.com/kooksee/markview/pull/73

## [v0.13.1](https://github.com/kooksee/markview/compare/v0.13.0...v0.13.1) - 2026-03-06
### New Features 🎉
- feat: add `--unwatch` flag to remove watched glob patterns by @k1LoW in https://github.com/kooksee/markview/pull/65
### Dependency Updates ⬆️
- chore(deps): bump aquasecurity/trivy-action from 0.34.1 to 0.34.2 in the dependencies group by @dependabot[bot] in https://github.com/kooksee/markview/pull/66
- chore(deps): bump the dependencies group in /internal/frontend with 4 updates by @dependabot[bot] in https://github.com/kooksee/markview/pull/67

## [v0.13.0](https://github.com/kooksee/markview/compare/v0.12.0...v0.13.0) - 2026-03-05
### New Features 🎉
- feat: add `--watch` (`-w`) flag for glob pattern directory watching by @k1LoW in https://github.com/kooksee/markview/pull/64

## [v0.12.0](https://github.com/kooksee/markview/compare/v0.11.4...v0.12.0) - 2026-03-04
### New Features 🎉
- feat: support YAML frontmatter in Markdown files by @k1LoW in https://github.com/kooksee/markview/pull/60
- feat: support MDX files by @k1LoW in https://github.com/kooksee/markview/pull/62

## [v0.11.4](https://github.com/kooksee/markview/compare/v0.11.3...v0.11.4) - 2026-03-04
### Other Changes
- Include frontend dependency licenses in CREDITS by @k1LoW in https://github.com/kooksee/markview/pull/59

## [v0.11.3](https://github.com/kooksee/markview/compare/v0.11.2...v0.11.3) - 2026-03-03
### Other Changes
- fix: avoid appending /default to URL when adding files to existing server by @k1LoW in https://github.com/kooksee/markview/pull/56

## [v0.11.2](https://github.com/kooksee/markview/compare/v0.11.1...v0.11.2) - 2026-03-03
### New Features 🎉
- fix: handle atomic saves and improve live-reload reliability by @k1LoW in https://github.com/kooksee/markview/pull/54

## [v0.11.1](https://github.com/kooksee/markview/compare/v0.11.0...v0.11.1) - 2026-03-03
### New Features 🎉
- Allow slashes in --target group names and validate invalid characters by @k1LoW in https://github.com/kooksee/markview/pull/53

## [v0.11.0](https://github.com/kooksee/markview/compare/v0.10.1...v0.11.0) - 2026-03-02
### Breaking Changes 🛠
- feat: write logs to rotating files under XDG_STATE_HOME by @k1LoW in https://github.com/kooksee/markview/pull/46
- feat: run markview in background by default by @k1LoW in https://github.com/kooksee/markview/pull/50
### New Features 🎉
- feat: add --close flag to gracefully shut down a running markview server by @k1LoW in https://github.com/kooksee/markview/pull/47
- feat: add --status flag to show all running markview servers by @k1LoW in https://github.com/kooksee/markview/pull/51
### Other Changes
- Rename --close flag to --shutdown by @k1LoW in https://github.com/kooksee/markview/pull/49

## [v0.10.1](https://github.com/kooksee/markview/compare/v0.10.0...v0.10.1) - 2026-03-02
### Other Changes
- feat: update tree view toggle icon to file-tree style by @k1LoW in https://github.com/kooksee/markview/pull/45

## [v0.10.0](https://github.com/kooksee/markview/compare/v0.9.0...v0.10.0) - 2026-03-02
### New Features 🎉
- feat: add drag-and-drop file reordering in sidebar by @k1LoW in https://github.com/kooksee/markview/pull/41
- feat: add move file to another group via kebab menu by @k1LoW in https://github.com/kooksee/markview/pull/42
- feat: add flat/tree view toggle for sidebar by @k1LoW in https://github.com/kooksee/markview/pull/43

## [v0.9.0](https://github.com/kooksee/markview/compare/v0.8.0...v0.9.0) - 2026-03-02
### New Features 🎉
- feat: add file remove feature by @k1LoW in https://github.com/kooksee/markview/pull/36
- feat: add Open in new tab to sidebar kebab menu by @k1LoW in https://github.com/kooksee/markview/pull/38
- feat: add restart server from Web UI by @k1LoW in https://github.com/kooksee/markview/pull/39

## [v0.8.0](https://github.com/kooksee/markview/compare/v0.7.0...v0.8.0) - 2026-03-01
### New Features 🎉
- feat: add copy buttons to Mermaid blocks by @k1LoW in https://github.com/kooksee/markview/pull/34

## [v0.7.0](https://github.com/kooksee/markview/compare/v0.6.0...v0.7.0) - 2026-03-01
### New Features 🎉
- feat: add copy button to code blocks by @k1LoW in https://github.com/kooksee/markview/pull/32
### Other Changes
- test: improve frontend testing with colocation and component tests by @k1LoW in https://github.com/kooksee/markview/pull/33

## [v0.6.0](https://github.com/kooksee/markview/compare/v0.5.2...v0.6.0) - 2026-03-01
### New Features 🎉
- feat: add copy-to-clipboard button with format selection by @k1LoW in https://github.com/kooksee/markview/pull/29
### Other Changes
- fix: differentiate ToC indentation for each heading level by @k1LoW in https://github.com/kooksee/markview/pull/30

## [v0.5.2](https://github.com/kooksee/markview/compare/v0.5.1...v0.5.2) - 2026-03-01

## [v0.5.1](https://github.com/kooksee/markview/compare/v0.5.0...v0.5.1) - 2026-03-01
### Fix bug 🐛
- fix: resolve render loop caused by unstable references in ToC integration by @k1LoW in https://github.com/kooksee/markview/pull/26

## [v0.5.0](https://github.com/kooksee/markview/compare/v0.4.1...v0.5.0) - 2026-02-28
### New Features 🎉
- feat: add raw markdown view toggle by @k1LoW in https://github.com/kooksee/markview/pull/22
- feat: add table of contents right panel by @k1LoW in https://github.com/kooksee/markview/pull/24

## [v0.4.1](https://github.com/kooksee/markview/compare/v0.4.0...v0.4.1) - 2026-02-28
### Fix bug 🐛
- fix: reject directory paths passed as file arguments by @matsuyoshi30 in https://github.com/kooksee/markview/pull/20

## [v0.4.0](https://github.com/kooksee/markview/compare/v0.3.2...v0.4.0) - 2026-02-28
### New Features 🎉
- feat: add --open and --no-open flags to control browser opening by @k1LoW in https://github.com/kooksee/markview/pull/19

## [v0.3.2](https://github.com/kooksee/markview/compare/v0.3.1...v0.3.2) - 2026-02-28
### Fix bug 🐛
- fix: serialize mermaid rendering to fix multiple diagrams by @k1LoW in https://github.com/kooksee/markview/pull/15

## [v0.3.1](https://github.com/kooksee/markview/compare/v0.3.0...v0.3.1) - 2026-02-27
### Other Changes
- refactor: improve donegroup usage for graceful shutdown by @k1LoW in https://github.com/kooksee/markview/pull/13
- refactor: replace log and fmt.Fprintf(os.Stderr) with slog by @k1LoW in https://github.com/kooksee/markview/pull/14

## [v0.3.0](https://github.com/kooksee/markview/compare/v0.2.0...v0.3.0) - 2026-02-27
### New Features 🎉
- feat: support GitHub Alerts (admonitions) by @k1LoW in https://github.com/kooksee/markview/pull/11

## [v0.2.0](https://github.com/kooksee/markview/compare/v0.1.1...v0.2.0) - 2026-02-27
### New Features 🎉
- feat: show file path tooltip on sidebar hover by @k1LoW in https://github.com/kooksee/markview/pull/8

## [v0.1.1](https://github.com/kooksee/markview/compare/v0.1.0...v0.1.1) - 2026-02-27

## [v0.1.0](https://github.com/kooksee/markview/commits/v0.1.0) - 2026-02-27
### Dependency Updates ⬆️
- chore(deps): bump pnpm/action-setup from 4.1.0 to 4.2.0 in the dependencies group by @dependabot[bot] in https://github.com/kooksee/markview/pull/4
- chore(deps): bump the dependencies group in /internal/frontend with 3 updates by @dependabot[bot] in https://github.com/kooksee/markview/pull/6
