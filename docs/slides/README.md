# Markdown PPT（Marp）模板

本目录提供一套可直接开讲的 **Marp** 幻灯片模板（离线导出 PDF/PPTX）。

> 应用内演示请用内置 **Slides**，完整示例见 [`testdata/slides-complete.md`](../../testdata/slides-complete.md)（备注、`|||` 双栏、进度条等）。Marp 与内置 Slides 是两条路径。

## 文件说明

- `tech-talk-template.md`：演示模板（16:9、分页、结构化内容）
- `theme-markview.css`：深色中文主题

## 本地预览

在仓库根目录执行：

```console
make slides-preview
```

## 导出 PDF

```console
make slides-pdf
```

## 导出 PPTX

```console
make slides-pptx
```

## 自定义输入文件

```console
make slides-preview SLIDES_FILE=docs/slides/my-talk.md
make slides-pdf SLIDES_FILE=docs/slides/my-talk.md SLIDES_PDF=docs/slides/my-talk.pdf
make slides-pptx SLIDES_FILE=docs/slides/my-talk.md SLIDES_PPTX=docs/slides/my-talk.pptx
```

## 不走 Makefile（可选）

```console
pnpm dlx @marp-team/marp-cli docs/slides/tech-talk-template.md --theme-set docs/slides/theme-markview.css --preview
```

## 快速改造建议

1. 先改标题页与目录页
2. 每页只放一个核心观点
3. 一页最多 5~7 条要点
4. 代码页只展示最关键片段
