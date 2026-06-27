interface SlidesToggleProps {
    isSlidesOpen: boolean;
    onToggle: () => void;
}

export function SlidesToggle({ isSlidesOpen, onToggle }: SlidesToggleProps) {
    return (
        <button
            type="button"
            className="flex items-center justify-center bg-transparent border border-gh-border rounded-md p-1.5 text-gh-text-secondary cursor-pointer transition-colors duration-150 hover:bg-gh-bg-hover"
            onClick={onToggle}
            aria-label="Slides"
            aria-pressed={isSlidesOpen}
            title={isSlidesOpen ? "Exit slides" : "Show slides"}
        >
            <svg
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
            >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <line x1="8" y1="9" x2="16" y2="9" />
                <line x1="8" y1="12" x2="14" y2="12" />
                <line x1="8" y1="15" x2="12" y2="15" />
            </svg>
        </button>
    );
}
