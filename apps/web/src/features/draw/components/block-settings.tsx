import { Minus, Plus } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "ui";

/*
 * The parts of a block's settings in Excalidraw's sidebar, looking like Excalidraw's own:
 * its colors and sizes come from Excalidraw's CSS variables, so they follow the theme.
 */

const BUTTON =
    "rounded-lg bg-[var(--button-bg)] text-[0.75rem] text-[var(--text-primary-color)] transition-colors hover:bg-[var(--button-hover-bg)] disabled:opacity-40 disabled:hover:bg-[var(--button-bg)]";
const ACTIVE =
    "!bg-[var(--color-surface-primary-container)] font-semibold !text-[var(--color-on-primary-container)]";

/** A block's settings, above Excalidraw's, with a line between them */
export const BlockSettings = ({ children }: { children: ReactNode }) => (
    <div className="flex flex-col gap-3 border-b border-[var(--default-border-color)] pb-3">
        {children}
    </div>
);

/** One setting, with its name above it */
export const Setting = ({ label, children }: { label: string; children: ReactNode }) => (
    <fieldset>
        <legend>{label}</legend>
        {children}
    </fieldset>
);

export type Choice<T> = { value: T; label: ReactNode; title?: string };

/** One of a few options, side by side, or in rows of `columns` */
export const Choices = <T,>({
    options,
    value,
    onChange,
    columns,
}: {
    options: Choice<T>[];
    value: T;
    onChange: (value: T) => void;
    columns?: number;
}) => (
    <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
    >
        {options.map(option => (
            <button
                key={String(option.value)}
                type="button"
                title={option.title}
                aria-pressed={option.value === value}
                onClick={() => onChange(option.value)}
                className={cn(
                    BUTTON,
                    "flex min-h-8 min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1",
                    option.value === value && ACTIVE
                )}
            >
                {option.label}
            </button>
        ))}
    </div>
);

/** Something that's on or off */
export const Toggle = ({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) => (
    <label className="flex h-7 cursor-pointer items-center gap-2 text-[0.8125rem] text-[var(--text-primary-color)]">
        <input
            type="checkbox"
            checked={checked}
            onChange={event => onChange(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
        />
        {label}
    </label>
);

/** A number, with buttons for one less and one more */
export const Stepper = ({
    value,
    min,
    max,
    step = 1,
    onChange,
    name,
}: {
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    /** What's counted, for the buttons' labels, e.g. "row" */
    name: string;
}) => (
    <div className="flex h-8 items-center rounded-lg bg-[var(--button-bg)] text-[var(--text-primary-color)]">
        <button
            type="button"
            aria-label={`One ${name} less`}
            disabled={value - step < min}
            onClick={() => onChange(value - step)}
            className={cn(BUTTON, "grid h-8 w-8 place-items-center bg-transparent")}
        >
            <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="flex-1 text-center text-[0.8125rem] font-semibold tabular-nums">
            {value}
        </span>
        <button
            type="button"
            aria-label={`One ${name} more`}
            disabled={value + step > max}
            onClick={() => onChange(value + step)}
            className={cn(BUTTON, "grid h-8 w-8 place-items-center bg-transparent")}
        >
            <Plus className="h-3.5 w-3.5" />
        </button>
    </div>
);

/** A list to choose from, for when there are many options */
export const Select = <T extends string>({
    value,
    options,
    onChange,
    label,
}: {
    value: T;
    options: readonly T[];
    onChange: (value: T) => void;
    label: string;
}) => (
    <select
        value={value}
        aria-label={label}
        onChange={event => onChange(event.target.value as T)}
        className={cn(BUTTON, "h-8 w-full cursor-pointer border-none px-2 outline-none")}
    >
        {options.map(option => (
            <option key={option} value={option}>
                {option}
            </option>
        ))}
    </select>
);

/** Does something with the block, like editing it. The main one stands out. */
export const ActionButton = ({
    icon,
    children,
    onClick,
    isPrimary,
    shortcut,
    title,
}: {
    icon?: ReactNode;
    children: ReactNode;
    onClick: () => void;
    isPrimary?: boolean;
    shortcut?: string;
    title?: string;
}) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className={cn(
            BUTTON,
            "flex h-8 w-full items-center justify-center gap-1.5 px-2 font-medium",
            isPrimary &&
                "bg-[var(--color-primary)] !text-[var(--color-surface-lowest,#fff)] hover:bg-[var(--color-primary-darker)]"
        )}
    >
        {icon}
        {children}
        {shortcut ? (
            <kbd className="ml-0.5 rounded border border-current/30 px-1 font-sans text-[10px] opacity-70">
                {shortcut}
            </kbd>
        ) : null}
    </button>
);

/** Buttons next to each other */
export const ButtonRow = ({ children }: { children: ReactNode }) => (
    <div className="grid grid-flow-col gap-1.5 [grid-auto-columns:minmax(0,1fr)]">{children}</div>
);
