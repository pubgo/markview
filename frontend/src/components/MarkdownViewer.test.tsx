import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MarkdownViewer } from "./MarkdownViewer";
import { fetchFileContent, openRelativeFile } from "../hooks/useApi";

vi.mock("../hooks/useApi", () => ({
    fetchFileContent: vi.fn(),
    openRelativeFile: vi.fn(),
}));

vi.mock("./TocToggle", () => ({
    TocToggle: () => null,
}));

vi.mock("./RawToggle", () => ({
    RawToggle: () => null,
}));

vi.mock("./SlidesToggle", () => ({
    SlidesToggle: () => null,
}));

vi.mock("./CopyButton", () => ({
    CopyButton: () => null,
}));

vi.mock("./PdfExportButton", () => ({
    PdfExportButton: () => null,
}));

vi.mock("./RemoveButton", () => ({
    RemoveButton: () => null,
}));

vi.mock("./BacklinksPanel", () => ({
    BacklinksPanel: () => null,
}));

describe("MarkdownViewer link opening", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows visible error when opening relative markdown link fails", async () => {
        vi.mocked(fetchFileContent).mockResolvedValue({
            content: "[坏链接](./missing.md)",
            baseDir: "/tmp",
        });
        vi.mocked(openRelativeFile).mockRejectedValue(new Error("not found"));

        const onFileOpened = vi.fn();

        render(
            <MarkdownViewer
                fileId="file-1"
                fileName="README.md"
                revision={0}
                onFileOpened={onFileOpened}
                onHeadingsChange={() => { }}
                isTocOpen={false}
                onTocToggle={() => { }}
                onRemoveFile={() => { }}
                isWide={false}
            />,
        );

        const link = await screen.findByRole("link", { name: "坏链接" });
        fireEvent.click(link);

        await waitFor(() => {
            expect(screen.getByText("无法打开链接：./missing.md")).toBeInTheDocument();
        });
        expect(onFileOpened).not.toHaveBeenCalled();
    });

    it("opens relative markdown link and does not show error when request succeeds", async () => {
        vi.mocked(fetchFileContent).mockResolvedValue({
            content: "[打开文档](./ok.md)",
            baseDir: "/tmp",
        });
        vi.mocked(openRelativeFile).mockResolvedValue({
            id: "file-2",
            name: "ok.md",
            path: "/tmp/ok.md",
        });

        const onFileOpened = vi.fn();

        render(
            <MarkdownViewer
                fileId="file-1"
                fileName="README.md"
                revision={0}
                onFileOpened={onFileOpened}
                onHeadingsChange={() => { }}
                isTocOpen={false}
                onTocToggle={() => { }}
                onRemoveFile={() => { }}
                isWide={false}
            />,
        );

        const link = await screen.findByRole("link", { name: "打开文档" });
        fireEvent.click(link);

        await waitFor(() => {
            expect(onFileOpened).toHaveBeenCalledWith("file-2");
        });
        expect(screen.queryByText(/^无法打开链接：/)).not.toBeInTheDocument();
    });

    it("toggles section visibility when clicking headings", async () => {
        vi.mocked(fetchFileContent).mockResolvedValue({
            content: `# 第一章

段落一

## 子节

段落二

# 第二章

段落三`,
            baseDir: "/tmp",
        });

        render(
            <MarkdownViewer
                fileId="file-1"
                fileName="README.md"
                revision={0}
                onFileOpened={() => { }}
                onHeadingsChange={() => { }}
                isTocOpen={false}
                onTocToggle={() => { }}
                onRemoveFile={() => { }}
                isWide={false}
            />,
        );

        const heading = await screen.findByRole("heading", { name: /第一章/ });
        expect(await screen.findByText("段落一")).toBeVisible();
        expect(await screen.findByText("段落二")).toBeVisible();
        expect(await screen.findByRole("heading", { name: /第二章/ })).toBeVisible();

        fireEvent.click(heading);

        await waitFor(() => {
            expect(screen.getByText("段落一")).not.toBeVisible();
            expect(screen.getByText("段落二")).not.toBeVisible();
            expect(screen.getByRole("heading", { name: /第二章/ })).toBeVisible();
        });

        fireEvent.click(screen.getByRole("heading", { name: /第一章/ }));

        await waitFor(() => {
            expect(screen.getByText("段落一")).toBeVisible();
            expect(screen.getByText("段落二")).toBeVisible();
        });
    });
});
