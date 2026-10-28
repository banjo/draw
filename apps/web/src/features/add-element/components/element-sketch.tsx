import { CustomElementType } from "common";
import { ReactElement } from "react";

// Two slightly different passes, like Excalidraw's hand-drawn lines
const sketches: Partial<Record<CustomElementType, ReactElement>> = {
    rectangle: (
        <path
            d="M6.4 6.2 L53.8 5.7 L54.3 34.1 L5.8 34.4 Z M5.7 5.6 L54.2 6.4 L53.6 33.8 L6.3 34.2 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
        />
    ),
    ellipse: (
        <>
            <ellipse
                cx={30}
                cy={20}
                rx={24}
                ry={14}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
            />
            <ellipse
                cx={30.5}
                cy={19.5}
                rx={23.5}
                ry={14.6}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.2}
                transform="rotate(2 30 20)"
            />
        </>
    ),
    diamond: (
        <path
            d="M30.3 3.4 L55.6 20.2 L29.8 36.7 L4.3 19.8 Z M29.7 2.8 L56.2 19.7 L30.4 37.3 L3.8 20.4 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
        />
    ),
    model: (
        <>
            <path
                d="M6.3 3.4 L53.7 2.8 L54.2 37.2 L5.8 37.4 Z"
                fill="#ffc9c9"
                stroke="#1e1e1e"
                strokeWidth={1.6}
                strokeLinejoin="round"
            />
            <path d="M6 14.2 L54 13.7" stroke="#1e1e1e" strokeWidth={1.4} />
            <path
                d="M11 9h16M11 21h12M11 29h9"
                stroke="#1e1e1e"
                strokeWidth={2}
                strokeLinecap="round"
            />
        </>
    ),
    codeblock: (
        <>
            <rect x={4} y={3} width={52} height={34} rx={5} fill="#1e1e2e" />
            <circle cx={10} cy={9} r={1.6} fill="#f38ba8" />
            <circle cx={15} cy={9} r={1.6} fill="#f9e2af" />
            <circle cx={20} cy={9} r={1.6} fill="#a6e3a1" />
            <g strokeWidth={2.4} strokeLinecap="round">
                <path d="M10 17h9M14 23h16M10 29h6" stroke="#89b4fa" />
                <path d="M22 17h14" stroke="#cba6f7" />
                <path d="M33 23h8" stroke="#a6e3a1" />
            </g>
        </>
    ),
};

/** A small hand-drawn picture of a shape or block, as it looks on the canvas */
export const ElementSketch = ({ type }: { type: CustomElementType }) => (
    <svg viewBox="0 0 60 40" className="h-[22px] w-[33px] overflow-visible" aria-hidden>
        {sketches[type]}
    </svg>
);
