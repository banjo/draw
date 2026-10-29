import { ExcalidrawApi } from "common";
import { BarChart3 } from "lucide-react";
import toast from "react-hot-toast";
import { Chart } from "../models/chart";

/** After rows with numbers are pasted as a table: a button that shows them as a chart */
export const showAsChartToast = (api: ExcalidrawApi, tableId: string) =>
    toast(
        t => (
            <span className="flex items-center gap-3">
                Pasted as a table
                <button
                    type="button"
                    onClick={() => {
                        toast.dismiss(t.id);
                        void Chart.switchView(api, tableId);
                    }}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-[#4a47b1] hover:bg-[#e0dfff] dark:text-[#b7b5ff] dark:hover:bg-[#403e6a]"
                >
                    <BarChart3 className="h-4 w-4" />
                    Show as chart
                </button>
            </span>
        ),
        { duration: 6000, id: `chart-${tableId}` }
    );
