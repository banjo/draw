import { Shape } from "@/models/shapes";
import { IconDto } from "../services/icon-service";
import { capitalize } from "@banjoanton/utils";

export const LIST_ITEM_TYPES = ["shape", "icon"] as const;
export type ListItemType = (typeof LIST_ITEM_TYPES)[number];

export type ShapeListItem = {
    type: "shape";
    description: string;
    title: string;
    item: Shape;
};

export type IconListItem = {
    type: "icon";
    description: string;
    title: string;
    item: IconDto;
};

export type ListItem = ShapeListItem | IconListItem;

const toIconListItem = (icon: IconDto): IconListItem => ({
    type: "icon",
    description: `${capitalize(icon.group)}`,
    title: icon.icon,
    item: icon,
});

const toShapeListItem = (shape: Shape): ShapeListItem => ({
    type: "shape",
    description: shape.description ?? "",
    title: shape.title ?? "",
    item: shape,
});

const filterByIcon = (item: ListItem): item is IconListItem => item.type === "icon";
const filterByShape = (item: ListItem): item is ShapeListItem => item.type === "shape";

export const ListItem = {
    filterByIcon,
    filterByShape,
    toIconListItem,
    toShapeListItem,
};
