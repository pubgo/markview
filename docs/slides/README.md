# Markdown PPT（Marp）模板

本目录提供一套可直接开讲的 Marp 幻灯片模板。

## 文件说明

- `tech-talk-template.md`：演示模板（16:9、分页、结构化内容）
- `theme-markview.css`：深色中文主题

## 本地预览

在仓库根目录执行：

make slides-preview

## 导出 PDF

make slides-pdf

## 导出 PPTX

make slides-pptx

## 自定义输入文件

make slides-preview SLIDES_FILE=docs/slides/my-talk.md
make slides-pdf SLIDES_FILE=docs/slides/my-talk.md SLIDES_PDF=docs/slides/my-talk.pdf
make slides-pptx SLIDES_FILE=docs/slides/my-talk.md SLIDES_PPTX=docs/slides/my-talk.pptx

## 不走 Makefile（可选）

pnpm dlx @marp-team/marp-cli docs/slides/tech-talk-template.md --theme-set docs/slides/theme-markview.css --preview

## 快速改造建议

1. 先改标题页与目录页
2. 每页只放一个核心观点
3. 一页最多 5~7 条要点
4. 代码页只展示最关键片段
