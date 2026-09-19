import { describe, expect, it } from "vitest";
import { isSlideCover } from "./slideCover";

describe("isSlideCover", () => {
  it("treats title-only slides as covers", () => {
    expect(isSlideCover("# 封面\n")).toBe(true);
    expect(isSlideCover("## Agenda\n")).toBe(true);
  });

  it("allows up to two short subtitle paragraphs", () => {
    expect(isSlideCover("# 封面\n\n副标题一行\n")).toBe(true);
    expect(isSlideCover("# 封面\n\n一行\n\n两行\n")).toBe(true);
  });

  it("rejects lists, fences, blockquotes, and tables", () => {
    expect(isSlideCover("# 标题\n\n- a\n- b\n")).toBe(false);
    expect(isSlideCover("# 标题\n\n```js\n1\n```\n")).toBe(false);
    expect(isSlideCover("# 标题\n\n> quote\n")).toBe(false);
    expect(isSlideCover("# 标题\n\n| a | b |\n| - | - |\n")).toBe(false);
  });

  it("rejects long paragraphs and multiple headings", () => {
    const long = "字".repeat(81);
    expect(isSlideCover(`# 标题\n\n${long}\n`)).toBe(false);
    expect(isSlideCover("# 一\n\n## 二\n")).toBe(false);
    expect(isSlideCover("### 太小\n")).toBe(false);
  });

  it("rejects dense content pages", () => {
    expect(
      isSlideCover(`# 第二页

这是正文第一段，仍然较短。

这是正文第二段。

这是第三段，不再算封面。
`),
    ).toBe(false);
  });
});
