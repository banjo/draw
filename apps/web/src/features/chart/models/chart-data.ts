export type Series = { name: string; values: number[] };
export type ChartData = { labels: string[]; series: Series[] };

/** Whether a cell has a number in it, maybe with a unit like "$8" or "12%" */
export const isNumeric = (cell: string | undefined) =>
    /^[^\d\s]{0,2}\s?-?[\d\s,.\u00a0]*\d[\d\s,.\u00a0]*\s?[^\d\s]{0,2}$/.test((cell ?? "").trim());

/** A cell as a number: "1,234", "12%", "$8" and "3,5" all work. Anything else is 0. */
export const toNumber = (cell: string | undefined) => {
    if (!isNumeric(cell)) return 0;
    let text = (cell ?? "").replace(/[\s\u00a0]/g, "");
    // A comma before one or two digits at the end is a decimal comma
    text =
        /\d,\d{1,2}\D*$/.test(text) && !text.includes(".")
            ? text.replace(",", ".")
            : text.replace(/,/g, "");
    const number = parseFloat(text.replace(/[^\d.-]/g, ""));
    return Number.isFinite(number) ? number : 0;
};

export const parseData = (rows: string[][]): ChartData => {
    const [header = [], ...body] = rows;
    return {
        labels: body.map(row => row[0]?.trim() ?? ""),
        series: header.slice(1).map((name, i) => ({
            name: name.trim() || `Series ${i + 1}`,
            values: body.map(row => toNumber(row[i + 1])),
        })),
    };
};
