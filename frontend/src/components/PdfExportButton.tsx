import {
  exportArticleAsPdf,
  exportSlidesDeckAsPdf,
  type SlidesDeckExportController,
} from "../utils/pdfExport";
import { useState } from "react";

interface PdfExportButtonProps {
  articleRef: React.RefObject<HTMLElement | null>;
  fileName: string;
  /** When set, export captures each slide page into a multi-page deck PDF. */
  slidesDeck?: SlidesDeckExportController | null;
}

export function PdfExportButton({ articleRef, fileName, slidesDeck }: PdfExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const isDeck = (slidesDeck?.slideCount ?? 0) > 0;

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      if (isDeck && slidesDeck) {
        await exportSlidesDeckAsPdf(slidesDeck, fileName);
        return;
      }
      const article = articleRef.current;
      if (!article) return;
      await exportArticleAsPdf(article, fileName);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      type="button"
      className="flex items-center justify-center bg-transparent border border-gh-border rounded-md p-1.5 text-gh-text-secondary cursor-pointer transition-colors duration-150 hover:bg-gh-bg-hover disabled:opacity-50"
      onClick={() => void handleExport()}
      disabled={exporting}
      title={
        isDeck
          ? exporting
            ? "正在导出幻灯片 PDF…"
            : "导出幻灯片 PDF（每页一页）"
          : "导出 PDF（单页，不截断）"
      }
      aria-label={isDeck ? "Export slides PDF" : "Export PDF"}
    >
      <svg
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
    </button>
  );
}
