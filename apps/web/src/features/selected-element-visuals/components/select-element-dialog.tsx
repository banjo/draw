import { Hint, Keys } from "@/components/keys";
import { useGlobal } from "@/contexts/global-context";
import { ElementSketch } from "@/features/add-element/components/element-sketch";
import { Highlight } from "@/features/collection/components/highlight";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { ElementVisualUtils } from "@/features/draw/utils/element-visual-utils";
import { Shape, shapes } from "@/models/shapes";
import { first } from "@banjoanton/utils";
import { CustomElementType } from "common";
import { Search } from "lucide-react";
import { KeyboardEvent, RefObject, useMemo, useState } from "react";
import { cn } from "ui";

const SECTIONS = [
    { kind: "shape", title: "Shapes" },
    { kind: "block", title: "Blocks" },
] as const;

const matches = (shape: Shape, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [shape.title ?? "", ...shape.tags].some(text => text.toLowerCase().includes(q));
};

// In section order, so the keys move the way the list reads
const filterShapes = (query: string) =>
    SECTIONS.flatMap(({ kind }) =>
        shapes.filter(shape => shape.kind === kind && matches(shape, query))
    );

type Props = {
    customRef: RefObject<HTMLDivElement>;
    /** Focuses the canvas again, unless the focus went somewhere else */
    closeSelectElementDialog: (options?: { focusCanvas?: boolean }) => void;
};

/** Change the selected shape to another type, by typing or with the keys */
export const SelectElementDialog = ({ customRef, closeSelectElementDialog }: Props) => {
    const { excalidrawApi } = useGlobal();
    const [query, setQuery] = useState("");

    const currentType = useMemo(() => {
        if (!excalidrawApi) return undefined;
        const selected = ElementUtil.getSelectedElements(
            excalidrawApi.getAppState(),
            excalidrawApi.getSceneElements()
        ).filter(element => !ElementUtil.isBoundText(element));
        const element = first(selected);
        return (element?.customData?.type ?? element?.type) as CustomElementType | undefined;
    }, [excalidrawApi]);

    // Start on the one after the current type, so Tab and Enter swap to the next
    const [selected, setSelected] = useState(() => {
        const all = filterShapes("");
        const index = all.findIndex(shape => shape.type === currentType);
        return index === -1 ? 0 : (index + 1) % all.length;
    });

    const items = filterShapes(query);
    const index = Math.min(selected, Math.max(items.length - 1, 0));

    const change = (type: CustomElementType) => {
        if (excalidrawApi && type !== currentType) {
            ElementVisualUtils.updateElementFromTypeSelection(excalidrawApi, type);
        }
        closeSelectElementDialog();
    };

    const move = (step: number) => {
        if (items.length === 0) return;
        setSelected((index + step + items.length) % items.length);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        // Keep Excalidraw's shortcuts out of the field
        event.stopPropagation();

        const actions: Record<string, () => void> = {
            ArrowDown: () => move(1),
            ArrowUp: () => move(-1),
            // Round and round, instead of on to the rest of the page
            Tab: () => move(event.shiftKey ? -1 : 1),
            Enter: () => {
                const shape = items[index];
                if (shape) change(shape.type);
            },
            Escape: () => closeSelectElementDialog(),
        };

        const action = actions[event.key];
        if (!action) return;
        event.preventDefault();
        action();
    };

    let start = 0;

    return (
        <div
            ref={customRef}
            role="dialog"
            aria-label="Change shape"
            // Clicks inside keep the focus in the field, so it doesn't close
            onMouseDown={event => {
                if (event.target instanceof HTMLInputElement) return;
                event.preventDefault();
            }}
            className="absolute z-[4] w-[260px] overflow-hidden rounded-xl bg-white text-[#1b1b1f] shadow-[0_20px_50px_-18px_rgba(25,25,60,0.35),0_0_0_1px_rgba(20,20,40,0.07)] duration-150 animate-in fade-in-0 zoom-in-[0.98] dark:bg-[#232329] dark:text-[#ececf1] dark:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] dark:[color-scheme:dark]"
        >
            <label className="flex h-11 items-center gap-2 border-b border-black/[0.07] px-3 text-zinc-400 dark:border-white/[0.07]">
                <Search className="h-4 w-4 shrink-0" />
                <input
                    autoFocus
                    value={query}
                    onChange={event => {
                        setQuery(event.target.value);
                        setSelected(0);
                    }}
                    onKeyDown={onKeyDown}
                    onBlur={() => closeSelectElementDialog({ focusCanvas: false })}
                    placeholder="Change to…"
                    role="combobox"
                    aria-expanded
                    aria-controls="change-shape-list"
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#1b1b1f] outline-none placeholder:text-zinc-400 dark:text-[#ececf1]"
                />
            </label>

            <div id="change-shape-list" role="listbox" className="px-1.5 pb-1.5">
                {items.length === 0 ? (
                    <div className="px-2 py-4 text-[13px] text-zinc-400">
                        No shape matches "{query.trim()}"
                    </div>
                ) : null}
                {SECTIONS.map(({ kind, title }) => {
                    const section = items.filter(shape => shape.kind === kind);
                    if (section.length === 0) return null;
                    const offset = start;
                    start += section.length;

                    return (
                        <div key={kind} role="group" aria-label={title}>
                            <div className="px-2 pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-zinc-400">
                                {title}
                            </div>
                            {section.map((shape, i) => {
                                const isSelected = offset + i === index;
                                return (
                                    <div
                                        key={shape.type}
                                        role="option"
                                        aria-selected={isSelected}
                                        onMouseMove={() => !isSelected && setSelected(offset + i)}
                                        onClick={() => change(shape.type)}
                                        className={cn(
                                            "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13.5px] font-medium",
                                            isSelected &&
                                                "bg-[#ecebff] text-[#4a47b1] dark:bg-[#a8a5ff]/15 dark:text-[#b7b5ff]"
                                        )}
                                    >
                                        <span className="grid w-[33px] shrink-0 place-items-center text-[#1e1e1e] dark:text-[#d8d8d8]">
                                            <ElementSketch type={shape.type} />
                                        </span>
                                        <span className="flex-1 truncate">
                                            <Highlight text={shape.title ?? ""} query={query} />
                                        </span>
                                        {shape.type === currentType ? (
                                            <span className="text-[11px] font-normal text-zinc-400">
                                                current
                                            </span>
                                        ) : null}
                                        {isSelected && shape.type !== currentType ? (
                                            <Keys keys={["↵"]} />
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            <div className="flex items-center gap-3 border-t border-black/[0.07] bg-black/[0.02] px-3 py-2 text-[11.5px] text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400">
                <Hint keys={["tab"]}>Next</Hint>
                <Hint keys={["↵"]}>Change</Hint>
                <Hint keys={["esc"]}>Close</Hint>
            </div>
        </div>
    );
};
