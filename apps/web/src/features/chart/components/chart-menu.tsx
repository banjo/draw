import { useGlobal } from "@/contexts/global-context";
import {
    ActionButton,
    BlockSettings,
    Choices,
    Setting,
    Toggle,
} from "@/features/draw/components/block-settings";
import { NativeBlockSettings } from "@/features/draw/models/native/native-block-settings";
import {
    BarChart3,
    BarChartBig,
    BarChartHorizontal,
    Donut,
    LineChart,
    Pencil,
    PieChart,
    Table2,
} from "lucide-react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Chart, CHART_LOOKS, CHART_PALETTES, CHART_TYPES } from "../models/chart";
import { ChartContent, ChartPalette, ChartType, PALETTES } from "../models/chart-render";
import { useChartStore } from "../stores/use-chart-store";

const CHART_ICONS: Record<ChartType, typeof BarChart3> = {
    bar: BarChart3,
    stacked: BarChartBig,
    hbar: BarChartHorizontal,
    line: LineChart,
    pie: PieChart,
    donut: Donut,
};

// Shorter names, to fit three on a row
const SHORT_TYPES: Record<ChartType, string> = {
    bar: "Bar",
    stacked: "Stacked",
    hbar: "Horizontal",
    line: "Line",
    pie: "Pie",
    donut: "Donut",
};

const Swatches = ({ palette }: { palette: ChartPalette }) => (
    <span className="flex -space-x-1">
        {PALETTES[palette].clean.slice(0, 3).map(color => (
            <span
                key={color}
                className="h-3 w-3 rounded-full ring-2 ring-[var(--button-bg)]"
                style={{ background: color }}
            />
        ))}
    </span>
);

type Props = Omit<ChartContent, "rows" | "title"> & { id: string };

/** A chart's type, look, what it shows and its colors, in Excalidraw's sidebar */
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

    return (
        <BlockSettings>
            <Setting label="Type">
                <Choices
                    columns={3}
                    options={CHART_TYPES.map(option => {
                        const Icon = CHART_ICONS[option.type];
                        return {
                            value: option.type,
                            title: option.label,
                            label: (
                                <>
                                    <Icon className="h-4 w-4" />
                                    <span className="text-[10.5px]">
                                        {SHORT_TYPES[option.type]}
                                    </span>
                                </>
                            ),
                        };
                    })}
                    value={chartType}
                    onChange={value => void change({ chartType: value })}
                />
            </Setting>
            <Setting label="Look">
                <Choices
                    options={CHART_LOOKS.map(option => ({
                        value: option.look,
                        label: option.label,
                    }))}
                    value={look}
                    onChange={value => void change({ look: value })}
                />
            </Setting>
            <Setting label="Show">
                <Toggle
                    label="Legend"
                    checked={legend}
                    onChange={checked => void change({ legend: checked })}
                />
                <Toggle
                    label="Values"
                    checked={values}
                    onChange={checked => void change({ values: checked })}
                />
            </Setting>
            <Setting label="Colors">
                <Choices
                    options={CHART_PALETTES.map(option => ({
                        value: option.palette,
                        title: option.label,
                        label: <Swatches palette={option.palette} />,
                    }))}
                    value={palette}
                    onChange={value => void change({ palette: value })}
                />
            </Setting>
            <div className="flex flex-col gap-1.5">
                <ActionButton
                    isPrimary
                    shortcut="↵"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => useChartStore.getState().setEditingId(id)}
                >
                    Edit data
                </ActionButton>
                <ActionButton
                    icon={<Table2 className="h-4 w-4" />}
                    onClick={() => excalidrawApi && void Chart.switchView(excalidrawApi, id)}
                >
                    Show as table
                </ActionButton>
            </div>
        </BlockSettings>
    );
};

/** In Excalidraw's sidebar while a chart is selected */
export const ChartMenuContainer = () => {
    const selected = useChartStore(state => state.selected);
    if (!selected) return null;
    return createPortal(<ChartMenu {...selected} />, NativeBlockSettings.container);
};
