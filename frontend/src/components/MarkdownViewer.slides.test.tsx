import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("MarkdownViewer slides mode", () => {
    let requestFullscreenMock: ReturnType<typeof vi.fn>;
    let exitFullscreenMock: ReturnType<typeof vi.fn>;
    let fullscreenElement: Element | null;

    beforeEach(() => {
        vi.clearAllMocks();
        fullscreenElement = null;
        Object.defineProperty(document, "fullscreenElement", {
            configurable: true,
            get: () => fullscreenElement,
        });
        requestFullscreenMock = vi.fn().mockImplementation(function (this: HTMLElement) {
            fullscreenElement = this;
            return Promise.resolve();
        });
        exitFullscreenMock = vi.fn().mockImplementation(() => {
            fullscreenElement = null;
            return Promise.resolve();
        });
        Object.defineProperty(document, "exitFullscreen", {
            configurable: true,
            value: exitFullscreenMock,
        });
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
            configurable: true,
            value: requestFullscreenMock,
        });
        vi.mocked(fetchFileContent).mockResolvedValue({
            content: `# 封面\n\n第一页内容\n\n---\n\n# 第二页\n\n第二页内容`,
            baseDir: "/tmp",
        });
        vi.mocked(openRelativeFile).mockResolvedValue({
            id: "file-2",
            name: "ok.md",
            path: "/tmp/ok.md",
        });
    });

    it("enters slides mode and flips pages by button", async () => {
        const user = userEvent.setup();

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

        await screen.findByText("第一页内容");

        await user.click(screen.getByRole("button", { name: "Slides" }));

        await waitFor(() => {
            expect(screen.getByText(/PPT 模式/)).toBeInTheDocument();
            expect(screen.getByText("第一页内容")).toBeInTheDocument();
            expect(screen.queryByText("第二页内容")).not.toBeInTheDocument();
        });

        await user.click(screen.getByRole("button", { name: "下一页" }));

        await waitFor(() => {
            expect(screen.getByText("第二页内容")).toBeInTheDocument();
            expect(screen.queryByText("第一页内容")).not.toBeInTheDocument();
        });
    });

    it("supports keyboard navigation in slides mode", async () => {
        const user = userEvent.setup();

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

        await screen.findByText("第一页内容");
        await user.click(screen.getByRole("button", { name: "Slides" }));

        fireEvent.keyDown(window, { key: "ArrowRight" });
        await waitFor(() => {
            expect(screen.getByText("第二页内容")).toBeInTheDocument();
        });

        fireEvent.keyDown(window, { key: "ArrowLeft" });
        await waitFor(() => {
            expect(screen.getByText("第一页内容")).toBeInTheDocument();
        });
    });

    it("enters fullscreen when clicking fullscreen button", async () => {
        const user = userEvent.setup();

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

        await screen.findByText("第一页内容");
        await user.click(screen.getByRole("button", { name: "Slides" }));

        await user.click(screen.getByRole("button", { name: "全屏展示" }));
        expect(requestFullscreenMock).toHaveBeenCalledOnce();
    });

    it("goes to next slide when clicking slide body", async () => {
        const user = userEvent.setup();

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

        await screen.findByText("第一页内容");
        await user.click(screen.getByRole("button", { name: "Slides" }));

        const slidePage = document.querySelector(".markdown-slide-page") as HTMLElement;
        expect(slidePage).toBeTruthy();
        await user.click(slidePage);

        await waitFor(() => {
            expect(screen.getByText("第二页内容")).toBeInTheDocument();
        });
    });

    it("exits fullscreen before leaving slides on Escape", async () => {
        const user = userEvent.setup();

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

        await screen.findByText("第一页内容");
        await user.click(screen.getByRole("button", { name: "Slides" }));
        await user.click(screen.getByRole("button", { name: "全屏展示" }));
        expect(requestFullscreenMock).toHaveBeenCalledOnce();

        fireEvent.keyDown(window, { key: "Escape" });

        expect(exitFullscreenMock).toHaveBeenCalledOnce();
        expect(screen.getByText(/PPT 模式/)).toBeInTheDocument();
    });

    it("auto-hides overlay controls in fullscreen after inactivity", async () => {
        const user = userEvent.setup();

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

        await screen.findByText("第一页内容");
        await user.click(screen.getByRole("button", { name: "Slides" }));
        await user.click(screen.getByRole("button", { name: "全屏展示" }));
        document.dispatchEvent(new Event("fullscreenchange"));

        const shell = screen.getByTestId("markdown-slide-shell");
        expect(shell.className).not.toContain("markdown-slide-shell--overlay-hidden");

        await waitFor(() => {
            expect(shell.className).toContain("markdown-slide-shell--overlay-hidden");
        }, {
            timeout: 4500,
        });
    });

});
