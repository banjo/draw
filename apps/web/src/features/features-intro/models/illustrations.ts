/* eslint-disable max-params -- drawing helpers take coordinates, like rough.js */
import rough from "roughjs";
import type { Options } from "roughjs/bin/core";

const SVG_NS = "http://www.w3.org/2000/svg";
const INK = "#1e1e1e";
const HAND_FONT = "Excalifont, Virgil, cursive";
const CODE_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Excalidraw's palette
const COLORS = {
    blue: "#a5d8ff",
    green: "#b2f2bb",
    yellow: "#ffec99",
    violet: "#d0bfff",
    teal: "#c3fae8",
    orange: "#ffd8a8",
    peach: "#fff4e6",
    red: "#ffc9c9",
    gray: "#868e96",
    accent: "#e8590c",
};

type TextOptions = {
    size?: number;
    fill?: string;
    anchor?: "start" | "middle" | "end";
    font?: string;
};

/** Drawing helpers on top of rough.js, the library Excalidraw draws with */
const createPen = (svg: SVGSVGElement, seed: number) => {
    const rc = rough.svg(svg);
    let nextSeed = seed;
    const options = (extra: Options = {}): Options => ({
        seed: nextSeed++,
        roughness: 1.1,
        stroke: INK,
        strokeWidth: 1.6,
        ...extra,
    });
    const add = <T extends SVGElement>(node: T, parent: SVGElement = svg) => {
        parent.appendChild(node);
        return node;
    };

    const text = (x: number, y: number, value: string, opts: TextOptions = {}) => {
        const node = document.createElementNS(SVG_NS, "text");
        const attributes = {
            x,
            y,
            "font-family": opts.font ?? HAND_FONT,
            "font-size": opts.size ?? 15,
            fill: opts.fill ?? INK,
            "text-anchor": opts.anchor ?? "middle",
            "dominant-baseline": "middle",
        };
        Object.entries(attributes).forEach(([key, val]) => node.setAttribute(key, String(val)));
        node.textContent = value;
        return add(node);
    };

    const box = (x: number, y: number, w: number, h: number, fill: string, extra: Options = {}) =>
        add(rc.rectangle(x, y, w, h, options({ fill, fillStyle: "solid", ...extra })));

    const line = (x1: number, y1: number, x2: number, y2: number, extra: Options = {}) =>
        add(rc.line(x1, y1, x2, y2, options(extra)));

    const arrow = (x1: number, y1: number, x2: number, y2: number, extra: Options = {}) => {
        line(x1, y1, x2, y2, extra);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = 10;
        [-0.45, 0.45].forEach(spread =>
            line(
                x2,
                y2,
                x2 - head * Math.cos(angle + spread),
                y2 - head * Math.sin(angle + spread),
                extra
            )
        );
    };

    const key = (x: number, y: number, label: string, w = 28) => {
        box(x, y, w, 26, "#ffffff", { roughness: 0.6, strokeWidth: 1.3 });
        text(x + w / 2, y + 14, label, { size: 13, font: "system-ui, sans-serif" });
    };

    const group = (attributes: Record<string, string>) => {
        const node = document.createElementNS(SVG_NS, "g");
        Object.entries(attributes).forEach(([k, v]) => node.setAttribute(k, v));
        return add(node);
    };

    return { rc, options, add, text, box, line, arrow, key, group };
};

type Pen = ReturnType<typeof createPen>;

const ILLUSTRATIONS: Record<string, (pen: Pen) => void> = {
    "add-element": ({ rc, add, box, text, line, key, options }) => {
        key(0, 22, "+", 26);
        box(40, 16, 200, 38, "#ffffff", { roughness: 0.6 });
        add(rc.circle(60, 35, 13, options({ strokeWidth: 1.5 })));
        line(65, 40, 71, 46, { strokeWidth: 1.5 });
        text(82, 36, "react", { anchor: "start", size: 17 });

        box(40, 66, 200, 40, "#e7f5ff", { stroke: "transparent", roughness: 0.3 });
        // The React logo: three orbits and a nucleus
        [0, 60, 120].forEach(angle => {
            const orbit = add(
                rc.ellipse(
                    62,
                    86,
                    30,
                    11,
                    options({ stroke: "#1c7ed6", strokeWidth: 1.3, roughness: 0.6 })
                )
            );
            orbit.setAttribute("transform", `rotate(${angle} 62 86)`);
        });
        add(
            rc.circle(
                62,
                86,
                5,
                options({ fill: "#1c7ed6", fillStyle: "solid", stroke: "#1c7ed6" })
            )
        );
        text(86, 87, "React", { anchor: "start", size: 16 });

        add(
            rc.rectangle(
                52,
                116,
                18,
                22,
                options({ fill: COLORS.blue, fillStyle: "solid", strokeWidth: 1.2 })
            )
        );
        text(86, 128, "React Native", { anchor: "start", size: 16 });
        add(
            rc.circle(
                62,
                168,
                20,
                options({ fill: COLORS.red, fillStyle: "solid", strokeWidth: 1.2 })
            )
        );
        text(86, 169, "React Query", { anchor: "start", size: 16 });
    },

    extend: ({ box, text, arrow, key }) => {
        box(0, 20, 120, 60, COLORS.blue);
        text(60, 51, "Frontend", { size: 18 });
        arrow(128, 50, 178, 50);
        box(186, 20, 120, 60, COLORS.green);
        text(246, 51, "API", { size: 18 });

        const dashed = { strokeLineDash: [7, 6], stroke: COLORS.gray };
        arrow(246, 88, 246, 140, dashed);
        box(186, 148, 120, 60, "transparent", dashed);
        text(330, 178, "let go!", { size: 17, fill: COLORS.accent, anchor: "start" });

        key(20, 176, "⌘");
        key(54, 176, "↓");
    },

    "smart-copy": ({ box, text, group, key }) => {
        [0.35, 0.6, 1].forEach((opacity, i) => {
            const layer = group({ opacity: String(opacity) });
            const x = 60 - i * 30;
            const y = 60 - i * 30;
            layer.appendChild(box(x, y, 130, 64, COLORS.green));
            layer.appendChild(text(x + 65, y + 33, "Service", { size: 17 }));
        });
        key(206, 98, "⌘");
        key(240, 98, "↵");
    },

    "change-shape": ({ rc, add, box, text, arrow, options }) => {
        box(0, 30, 110, 66, COLORS.yellow);
        text(55, 64, "Step", { size: 18 });
        arrow(118, 63, 160, 63);
        add(
            rc.polygon(
                [
                    [225, 20],
                    [285, 63],
                    [225, 106],
                    [165, 63],
                ],
                options({ fill: COLORS.yellow, fillStyle: "solid" })
            )
        );
        text(225, 64, "Step", { size: 18 });

        // The shape picker
        box(80, 128, 132, 40, "#ffffff", { roughness: 0.5 });
        box(127, 133, 38, 30, "#e7f5ff", { stroke: "transparent", roughness: 0.3 });
        add(rc.rectangle(94, 139, 20, 18, options({ strokeWidth: 1.3 })));
        add(
            rc.polygon(
                [
                    [146, 137],
                    [157, 148],
                    [146, 159],
                    [135, 148],
                ],
                options({ strokeWidth: 1.3 })
            )
        );
        add(rc.circle(189, 148, 20, options({ strokeWidth: 1.3 })));
    },

    "code-blocks": ({ box, text, add, rc, options }) => {
        box(0, 0, 290, 132, "#f6f8fa", { stroke: "#d0d7de", roughness: 0.5 });
        const lines: [string, string][][] = [
            [
                ["const ", "#cf222e"],
                ["greet", "#8250df"],
                [" = (name) =>", "#1f2328"],
            ],
            [
                ["  `Hello, ", "#0a3069"],
                ["${name}", "#1f2328"],
                ["!`", "#0a3069"],
            ],
            [["// say hi", "#6e7781"]],
            [
                ["greet", "#8250df"],
                ["(", "#1f2328"],
                ['"Banjo"', "#0a3069"],
                [");", "#1f2328"],
            ],
        ];
        lines.forEach((parts, row) => {
            const node = text(20, 28 + row * 26, "", {
                anchor: "start",
                size: 14,
                font: CODE_FONT,
            });
            parts.forEach(([value, color]) => {
                const span = document.createElementNS(SVG_NS, "tspan");
                span.setAttribute("fill", color);
                span.setAttribute("xml:space", "preserve");
                span.textContent = value;
                node.appendChild(span);
            });
        });
        add(
            rc.rectangle(
                176,
                146,
                114,
                30,
                options({ fill: "#ffffff", fillStyle: "solid", roughness: 0.5, strokeWidth: 1.3 })
            )
        );
        text(190, 162, "JavaScript ▾", { anchor: "start", size: 14 });
    },

    models: ({ box, text, line }) => {
        box(0, 0, 140, 150, COLORS.peach);
        box(0, 0, 140, 36, COLORS.orange);
        text(70, 19, "User", { size: 18 });
        line(0, 36, 140, 36);
        ["id", "name", "email"].forEach((field, i) =>
            text(16, 58 + i * 30, field, { anchor: "start" })
        );
    },

    collaboration: ({ rc, add, box, text, arrow, options }) => {
        box(0, 20, 100, 55, COLORS.violet);
        text(50, 48, "Idea");
        box(145, 65, 100, 55, COLORS.teal);
        text(195, 93, "Plan");
        arrow(105, 52, 142, 82);

        const cursor = (x: number, y: number, color: string, name: string) => {
            add(
                rc.polygon(
                    [
                        [x, y],
                        [x + 16, y + 9],
                        [x + 8, y + 11],
                        [x + 5, y + 20],
                    ],
                    options({ fill: color, fillStyle: "solid", stroke: color, roughness: 0.4 })
                )
            );
            const width = name.length * 8 + 12;
            box(x + 12, y + 18, width, 18, color, { stroke: color, roughness: 0.3 });
            text(x + 12 + width / 2, y + 27, name, { size: 12, fill: "#ffffff" });
        };
        cursor(110, 10, "#e8590c", "Anna");
        cursor(40, 95, "#1971c2", "Sam");
    },

    collection: ({ rc, options, group, text }) => {
        const cards: [string, string, number][] = [
            ["Roadmap", COLORS.yellow, -6],
            ["Architecture", COLORS.blue, 2],
            ["Sprint 12", COLORS.green, 8],
        ];
        cards.forEach(([title, color, rotation], i) => {
            const card = group({ transform: `rotate(${rotation} 160 100)` });
            const x = 80 + i * 26;
            const y = 40 + i * 32;
            card.appendChild(
                rc.rectangle(x, y, 150, 95, options({ fill: "#ffffff", fillStyle: "solid" }))
            );
            card.appendChild(
                rc.rectangle(x, y, 150, 24, options({ fill: color, fillStyle: "solid" }))
            );
            card.appendChild(text(x + 10, y + 13, title, { anchor: "start", size: 14 }));
        });
    },
};

const PADDING = 14;

/**
 * Draw a feature's illustration into an empty, mounted <svg>, and fit the view to it. Returns
 * false when the feature has none.
 */
export const drawIllustration = (id: string, svg: SVGSVGElement, seed = 1) => {
    const draw = ILLUSTRATIONS[id];
    if (!draw) return false;

    svg.replaceChildren();
    draw(createPen(svg, seed));

    const { x, y, width, height } = svg.getBBox();
    svg.setAttribute(
        "viewBox",
        `${x - PADDING} ${y - PADDING} ${width + PADDING * 2} ${height + PADDING * 2}`
    );
    return true;
};
