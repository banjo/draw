/* eslint-disable max-params -- drawing helpers take coordinates, like rough.js */
import rough from "roughjs";
import type { Options } from "roughjs/bin/core";

const SVG_NS = "http://www.w3.org/2000/svg";
const INK = "#1e1e1e";
const HAND_FONT = "Excalifont, Virgil, cursive";

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

    blocks: ({ rc, add, box, text, line, arrow, options }) => {
        // Eight tiles, four on a row, each with its name under it
        const W = 120;
        const H = 84;
        const at = (index: number) => ({
            x: (index % 4) * (W + 18),
            y: Math.floor(index / 4) * (H + 40),
        });
        const caption = (index: number, name: string) => {
            const { x, y } = at(index);
            text(x + W / 2, y + H + 16, name, { size: 14, fill: COLORS.gray });
        };
        const flat = { roughness: 0.2, strokeWidth: 3 };

        // Code block
        let { x, y } = at(0);
        box(x, y, W, H, "#1e1e2e", { stroke: "#1e1e2e", roughness: 0.4 });
        const code: [number, number, string][][] = [
            [
                [12, 26, "#c678dd"],
                [32, 62, "#61afef"],
            ],
            [
                [20, 46, "#98c379"],
                [52, 88, "#e5c07b"],
            ],
            [
                [20, 38, "#e06c75"],
                [44, 76, "#abb2bf"],
            ],
            [[12, 22, "#abb2bf"]],
        ];
        code.forEach((parts, row) =>
            parts.forEach(([from, to, color]) =>
                line(x + from, y + 18 + row * 16, x + to, y + 18 + row * 16, {
                    ...flat,
                    stroke: color,
                })
            )
        );
        caption(0, "Code");

        // Table
        ({ x, y } = at(1));
        box(x, y, W, 22, COLORS.blue, { stroke: "transparent", roughness: 0.4 });
        box(x, y, W, H, "transparent", { strokeWidth: 1.5 });
        line(x, y + 22, x + W, y + 22, { strokeWidth: 1.5 });
        line(x, y + 53, x + W, y + 53, { strokeWidth: 1 });
        line(x + 58, y, x + 58, y + H, { strokeWidth: 1 });
        [
            ["Task", "Who"],
            ["Plan", "Anna"],
            ["Ship", "Sam"],
        ].forEach(([task, who], row) => {
            const rowY = row === 0 ? y + 12 : y + 38 + (row - 1) * 31;
            text(x + 8, rowY, task!, { anchor: "start", size: 13 });
            text(x + 66, rowY, who!, { anchor: "start", size: 13 });
        });
        caption(1, "Table");

        // Chart
        ({ x, y } = at(2));
        line(x + 6, y, x + 6, y + H, { strokeWidth: 1.5 });
        line(x + 6, y + H, x + W, y + H, { strokeWidth: 1.5 });
        [
            [16, 46, COLORS.blue],
            [42, 22, COLORS.red],
            [68, 54, COLORS.green],
            [94, 8, COLORS.yellow],
        ].forEach(([dx, top, fill]) =>
            add(
                rc.rectangle(
                    x + (dx as number),
                    y + (top as number),
                    18,
                    H - (top as number),
                    options({ fill: fill as string, fillStyle: "solid", strokeWidth: 1.3 })
                )
            )
        );
        caption(2, "Chart");

        // Markdown note
        ({ x, y } = at(3));
        box(x, y, W, H, "#ffffff", { roughness: 0.6 });
        text(x + 10, y + 16, "# Notes", { anchor: "start", size: 15 });
        text(x + 10, y + 38, "**bold**", { anchor: "start", size: 13, fill: COLORS.gray });
        box(x + 10, y + 54, 11, 11, COLORS.green, { roughness: 0.4, strokeWidth: 1.2 });
        line(x + 12, y + 60, x + 15, y + 63, { strokeWidth: 1.4, roughness: 0.2 });
        line(x + 15, y + 63, x + 20, y + 56, { strokeWidth: 1.4, roughness: 0.2 });
        text(x + 28, y + 60, "Draw it", { anchor: "start", size: 13 });
        caption(3, "Markdown");

        // Mermaid diagram
        ({ x, y } = at(4));
        box(x, y + 6, 46, 26, COLORS.violet, { roughness: 0.6, strokeWidth: 1.3 });
        text(x + 23, y + 20, "Start", { size: 12 });
        add(
            rc.polygon(
                [
                    [x + 94, y + 2],
                    [x + 120, y + 19],
                    [x + 94, y + 36],
                    [x + 68, y + 19],
                ],
                options({ fill: COLORS.yellow, fillStyle: "solid", strokeWidth: 1.3 })
            )
        );
        text(x + 94, y + 20, "OK?", { size: 12 });
        arrow(x + 48, y + 19, x + 66, y + 19, { strokeWidth: 1.3 });
        box(x + 68, y + 58, 52, 26, COLORS.green, { roughness: 0.6, strokeWidth: 1.3 });
        text(x + 94, y + 72, "Done", { size: 12 });
        arrow(x + 94, y + 38, x + 94, y + 56, { strokeWidth: 1.3 });
        caption(4, "Mermaid");

        // Database model
        ({ x, y } = at(5));
        box(x, y, W, H, COLORS.peach, { roughness: 0.6 });
        box(x, y, W, 24, COLORS.orange, { roughness: 0.6 });
        text(x + W / 2, y + 13, "User", { size: 14 });
        ["id", "email"].forEach((field, i) =>
            text(x + 10, y + 40 + i * 22, field, { anchor: "start", size: 13 })
        );
        caption(5, "Model");

        // Swimlane
        ({ x, y } = at(6));
        box(x, y, W, H / 2, "#e7f5ff", { roughness: 0.5, strokeWidth: 1.3 });
        box(x, y + H / 2, W, H / 2, "#ebfbee", { roughness: 0.5, strokeWidth: 1.3 });
        line(x + 28, y, x + 28, y + H, { strokeWidth: 1.3 });
        text(x + 14, y + H / 4, "A", { size: 13 });
        text(x + 14, y + (H * 3) / 4, "B", { size: 13 });
        box(x + 38, y + 9, 30, 24, "#ffffff", { roughness: 0.5, strokeWidth: 1.2 });
        box(x + 82, y + 51, 30, 24, "#ffffff", { roughness: 0.5, strokeWidth: 1.2 });
        arrow(x + 68, y + 21, x + 90, y + 49, { strokeWidth: 1.2 });
        caption(6, "Swimlane");

        // Link card
        ({ x, y } = at(7));
        box(x, y + 22, W, 40, "#ffffff", { roughness: 0.5 });
        box(x + 8, y + 30, 24, 24, "#1971c2", { stroke: "#1971c2", roughness: 0.3 });
        line(x + 15, y + 47, x + 25, y + 37, {
            stroke: "#ffffff",
            strokeWidth: 1.8,
            roughness: 0.2,
        });
        line(x + 19, y + 37, x + 25, y + 37, {
            stroke: "#ffffff",
            strokeWidth: 1.8,
            roughness: 0.2,
        });
        line(x + 25, y + 37, x + 25, y + 43, {
            stroke: "#ffffff",
            strokeWidth: 1.8,
            roughness: 0.2,
        });
        text(x + 40, y + 36, "BanjoDraw", { anchor: "start", size: 13 });
        text(x + 40, y + 51, "banjoanton.com", { anchor: "start", size: 10, fill: COLORS.gray });
        caption(7, "Link card");
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

    ai: ({ rc, add, options, text, box, line, arrow }) => {
        // The request, with a sparkle and a caret
        box(0, 70, 190, 92, "#ffffff", { roughness: 0.6 });
        const sparkle = (x: number, y: number, r: number) =>
            add(
                rc.polygon(
                    [
                        [x, y - r],
                        [x + r * 0.3, y - r * 0.3],
                        [x + r, y],
                        [x + r * 0.3, y + r * 0.3],
                        [x, y + r],
                        [x - r * 0.3, y + r * 0.3],
                        [x - r, y],
                        [x - r * 0.3, y - r * 0.3],
                    ],
                    options({
                        fill: "#de9239",
                        fillStyle: "solid",
                        stroke: "#de9239",
                        roughness: 0.4,
                    })
                )
            );
        sparkle(20, 92, 9);
        sparkle(34, 80, 5);
        text(14, 120, "Login flow with", { anchor: "start", size: 16 });
        text(14, 142, "2FA, and errors", { anchor: "start", size: 16 });
        line(130, 132, 130, 152, { stroke: COLORS.accent, strokeWidth: 1.5, roughness: 0.2 });

        arrow(204, 116, 250, 116, { stroke: COLORS.accent });

        // What comes back: a flow of shapes you can edit
        add(rc.ellipse(300, 60, 84, 44, options({ fill: COLORS.green, fillStyle: "solid" })));
        text(300, 61, "Start", { size: 15 });
        arrow(300, 84, 300, 108);
        add(
            rc.polygon(
                [
                    [300, 112],
                    [350, 146],
                    [300, 180],
                    [250, 146],
                ],
                options({ fill: COLORS.yellow, fillStyle: "solid" })
            )
        );
        text(300, 147, "Valid?", { size: 15 });
        arrow(352, 146, 396, 146);
        text(374, 134, "yes", { size: 13, fill: COLORS.gray });
        box(400, 124, 92, 44, COLORS.blue);
        text(446, 147, "2FA code", { size: 15 });
        arrow(300, 182, 300, 212);
        text(312, 198, "no", { size: 13, fill: COLORS.gray, anchor: "start" });
        box(254, 216, 92, 40, COLORS.red);
        text(300, 237, "Error", { size: 15 });
        box(398, 206, 100, 50, COLORS.yellow, { stroke: "transparent", roughness: 0.4 });
        text(448, 224, "Lock after", { size: 13 });
        text(448, 242, "5 tries", { size: 13 });
    },

    collection: ({ rc, add, options, group, text, box, line, arrow }) => {
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

        // The same drawings on a laptop and a phone, kept in sync
        box(330, 40, 120, 76, "#ffffff", { roughness: 0.6 });
        box(338, 48, 104, 14, COLORS.blue, { stroke: "transparent", roughness: 0.3 });
        add(
            rc.polygon(
                [
                    [318, 124],
                    [462, 124],
                    [452, 116],
                    [328, 116],
                ],
                options({ fill: "#e9ecef", fillStyle: "solid", roughness: 0.5 })
            )
        );
        line(346, 76, 404, 76, { strokeWidth: 1.2, stroke: COLORS.gray });
        line(346, 92, 386, 92, { strokeWidth: 1.2, stroke: COLORS.gray });

        box(372, 168, 50, 88, "#ffffff", { roughness: 0.6 });
        box(378, 178, 38, 10, COLORS.blue, { stroke: "transparent", roughness: 0.3 });
        line(382, 202, 410, 202, { strokeWidth: 1.2, stroke: COLORS.gray });
        line(382, 216, 402, 216, { strokeWidth: 1.2, stroke: COLORS.gray });
        line(390, 246, 404, 246, { strokeWidth: 1.6, roughness: 0.2 });

        arrow(372, 134, 382, 160, { stroke: COLORS.accent });
        arrow(412, 160, 404, 134, { stroke: COLORS.accent });
        text(440, 148, "synced", { anchor: "start", size: 15, fill: COLORS.accent });
    },

    folders: ({ rc, add, box, text, line, options }) => {
        const folder = (x: number, y: number, color: string) =>
            add(
                rc.path(
                    `M ${x} ${y + 3} h 7 l 2 3 h 11 v 12 h -20 Z`,
                    options({ fill: color, fillStyle: "solid", strokeWidth: 1.3, roughness: 0.6 })
                )
            );
        const chevron = (x: number, y: number) =>
            add(
                rc.linearPath(
                    [
                        [x, y],
                        [x + 4, y + 4],
                        [x + 8, y],
                    ],
                    options({ strokeWidth: 1.2, roughness: 0.4 })
                )
            );

        chevron(0, 12);
        folder(16, 4, COLORS.blue);
        text(46, 14, "Work", { anchor: "start", size: 17 });

        line(4, 30, 4, 112, { stroke: "#ced4da", strokeWidth: 1, roughness: 0.3 });
        chevron(22, 46);
        folder(38, 38, COLORS.violet);
        text(68, 48, "Architecture", { anchor: "start", size: 16 });

        box(44, 64, 190, 30, "#e7f5ff", { stroke: "transparent", roughness: 0.3 });
        add(rc.rectangle(64, 70, 14, 18, options({ strokeWidth: 1.2, roughness: 0.5 })));
        text(88, 80, "System overview", { anchor: "start", size: 15 });

        folder(38, 104, COLORS.yellow);
        text(68, 114, "Sprints", { anchor: "start", size: 16 });

        folder(16, 140, COLORS.green);
        text(46, 150, "Side projects", { anchor: "start", size: 17 });
    },

    "find-drawing": ({ rc, add, box, text, line, key, options }) => {
        key(0, 22, "⌘");
        key(34, 22, "O");
        box(74, 16, 220, 38, "#ffffff", { roughness: 0.6 });
        add(rc.circle(94, 35, 13, options({ strokeWidth: 1.5 })));
        line(99, 40, 105, 46, { strokeWidth: 1.5 });
        text(116, 36, "sys", { anchor: "start", size: 17 });
        line(144, 26, 144, 46, { stroke: COLORS.accent, strokeWidth: 1.5, roughness: 0.2 });

        box(74, 66, 220, 40, "#e7f5ff", { stroke: "transparent", roughness: 0.3 });
        add(rc.rectangle(90, 76, 16, 20, options({ strokeWidth: 1.2, roughness: 0.5 })));
        text(118, 87, "System overview", { anchor: "start", size: 16 });
        add(rc.rectangle(90, 116, 16, 20, options({ strokeWidth: 1.2, roughness: 0.5 })));
        text(118, 127, "System design", { anchor: "start", size: 16 });
        text(272, 87, "↵", { size: 16, fill: COLORS.gray });
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
