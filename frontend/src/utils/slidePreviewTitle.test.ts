import { describe, expect, it } from "vitest";
import { slidePreviewTitle } from "./slidePreviewTitle";

describe("slidePreviewTitle", () => {
  it("uses the first ATX heading", () => {
    expect(slidePreviewTitle("## 双栏\n\n- a")).toBe("双栏");
  });

  it("strips speaker notes before reading the title", () => {
    expect(slidePreviewTitle("# 封面\n\n<!-- 口播 -->\n\n副标题")).toBe("封面");
  });

  it("falls back to truncated body text when there is no heading", () => {
    expect(slidePreviewTitle("没有标题只有很长的一段说明文字用来预览")).toBe(
      "没有标题只有很长的一段说明文字用来预览".slice(0, 40),
    );
  });

  it("returns a placeholder for empty slides", () => {
    expect(slidePreviewTitle("<!-- only notes -->")).toBe("（空页）");
  });
});
