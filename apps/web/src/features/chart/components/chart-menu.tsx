import { useGlobal } from "@/contexts/global-context";
import { NativeBlockMenu } from "@/features/draw/models/native/native-block-menu";
import {
    BarChart3,
    BarChartBig,
    BarChartHorizontal,
    ChevronDown,
    Donut,
    LineChart,
    Pencil,
    PieChart,
    Table2,
} from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { cn } from "ui";
import { Chart, CHART_LOOKS, CHART_PALETTES, CHART_TYPES } from "../models/chart";
import { ChartContent, ChartPalette, ChartType, PALETTES } from "../models/chart-render";
import { useChartStore } from "../stores/use-chart-store";

const GROUP_CLASS =
    "flex h-full items-center gap-0.5 rounded-lg bg-[#ECECF4] p-1 dark:bg-[#23232A]";

export const CHART_ICONS: Record<ChartType, typeof BarChart3> = {
    bar: BarChart3,
    stacked: BarChartBig,
    hbar: BarChartHorizontal,
    line: LineChart,
    pie: PieChart,
    donut: Donut,
};

const Option = ({
    isActive,
    onClick,
    children,
    label,
}: {
    isActive?: boolean;
    onClick: () => void;
    children: ReactNode;
    label?: string;
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        aria-label={label}
        title={label}
        className={cn(
            "flex h-full items-center gap-1.5 whitespace-nowrap rounded-md px-2.5",
            isActive
                ? "bg-[#e0dfff] font-semibold text-[#4a47b1] dark:bg-[#403e6a] dark:text-[#e0dfff]"
                : "hover:bg-black/5 dark:hover:bg-white/10"
        )}
    >
        {children}
    </button>
);

/** A button that opens a list above it, closed by choosing or clicking elsewhere */
const Dropdown = ({
    button,
    label,
    children,
}: {
    button: ReactNode;
    label: string;
    children: (close: () => void) => ReactNode;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!ref.current?.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        return () => document.removeEventListener("pointerdown", onPointerDown, true);
    }, [isOpen]);

    return (
        <div ref={ref} className="relative h-full">
            <Option isActive={isOpen} onClick={() => setIsOpen(!isOpen)} label={label}>
                {button}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Option>
            {isOpen ? (
                <div
                    role="menu"
                    className="absolute bottom-[calc(100%+8px)] left-0 z-10 flex min-w-[180px] flex-col gap-0.5 rounded-xl bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(25,25,60,0.4),0_0_0_1px_rgba(20,20,40,0.08)] dark:bg-[#232329] dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)]"
                >
                    {children(() => setIsOpen(false))}
                </div>
            ) : null}
        </div>
    );
};

const MenuItem = ({
    isActive,
    onClick,
    children,
}: {
    isActive: boolean;
    onClick: () => void;
    children: ReactNode;
}) => (
    <button
        type="button"
        role="menuitemradio"
        aria-checked={isActive}
        onClick={onClick}
        className={cn(
            "flex h-8 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 text-left",
            isActive
                ? "bg-[#e0dfff] font-semibold text-[#4a47b1] dark:bg-[#403e6a] dark:text-[#e0dfff]"
                : "hover:bg-black/5 dark:hover:bg-white/10"
        )}
    >
        {children}
    </button>
);

const Swatches = ({ palette }: { palette: ChartPalette }) => (
    <span className="flex -space-x-1">
        {PALETTES[palette].clean.slice(0, 3).map(color => (
            <span
                key={color}
                className="h-3.5 w-3.5 rounded-full ring-2 ring-[#ECECF4] dark:ring-[#23232A]"
                style={{ background: color }}
            />
        ))}
    </span>
);

type Props = Omit<ChartContent, "rows" | "title"> & { id: string };

/** A chart's type, look, what it shows and its colors, while it's selected */
const ChartMenu = ({ id, chartType, look, legend, values, palette }: Props) => {
    const { excalidrawApi } = useGlobal();

    const change = async (changes: Partial<ChartContent>) => {
        if (!excalidrawApi) return;
        try {
            await Chart.apply(excalidrawApi, id, changes);
        } catch {
            toast.error("Couldn't draw the chart");
        }
    };

    const TypeIcon = CHART_ICONS[chartType];
    const typeLabel = CHART_TYPES.find(option => option.type === chartType)?.label ?? "Bar";

    return (
        <div className="pointer-events-auto absolute z-[3] flex h-full items-center gap-2 text-sm">
            <div className={GROUP_CLASS}>
                <Dropdown
                    label="Chart type"
                    button={
                        <>
                            <TypeIcon className="h-4 w-4" />
                            {typeLabel}
                        </>
                    }
                >
                    {close =>
                        CHART_TYPES.map(option => {
                            const Icon = CHART_ICONS[option.type];
                            return (
                                <MenuItem
                                    key={option.type}
                                    isActive={chartType === option.type}
                                    onClick={() => {
                                        close();
                                        void change({ chartType: option.type });
                                    }}
                                >
                                    <Icon className="h-4 w-4" />
                                    {option.label}
                                </MenuItem>
                            );
                        })
                    }
                </Dropdown>
            </div>
            <div className={GROUP_CLASS}>
                {CHART_LOOKS.map(option => (
                    <Option
                        key={option.look}
                        isActive={look === option.look}
                        onClick={() => void change({ look: option.look })}
                    >
                        {option.label}
                    </Option>
                ))}
            </div>
            <div className={GROUP_CLASS}>
                <Option isActive={legend} onClick={() => void change({ legend: !legend })}>
                    Legend
                </Option>
                <Option isActive={values} onClick={() => void change({ values: !values })}>
                    Values
                </Option>
            </div>
            <div className={GROUP_CLASS}>
                <Dropdown label="Colors" button={<Swatches palette={palette} />}>
                    {close =>
                        CHART_PALETTES.map(option => (
                            <MenuItem
                                key={option.palette}
                                isActive={palette === option.palette}
                                onClick={() => {
                                    close();
                                    void change({ palette: option.palette });
                                }}
                            >
                                <Swatches palette={option.palette} />
                                {option.label}
                            </MenuItem>
                        ))
                    }
                </Dropdown>
            </div>
            <div className={GROUP_CLASS}>
                <Option onClick={() => useChartStore.getState().setEditingId(id)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit data
                </Option>
                <Option
                    label="Show as a table"
                    onClick={() => excalidrawApi && void Chart.switchView(excalidrawApi, id)}
                >
                    <Table2 className="h-4 w-4" />
                    Table
                </Option>
            </div>
        </div>
    );
};

/** In Excalidraw's footer while a chart is selected */
export const ChartMenuContainer = () => {
    const selected = useChartStore(state => state.selected);
    const container = NativeBlockMenu.getContainer();
    if (!selected || !container) return null;
    return createPortal(<ChartMenu {...selected} />, container);
};
