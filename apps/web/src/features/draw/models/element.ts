export type ElementBasicPosition = {
    startX: number;
    startY: number;
};

export const ElementBasicPosition = {
    from: (options: ElementBasicPosition) => options,
};

export type ElementMeasurement = {
    width: number;
    height: number;
};

export const ElementMeasurement = {
    from: (measurement: ElementMeasurement) => measurement,
};
