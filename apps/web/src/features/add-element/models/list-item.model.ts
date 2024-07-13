import { Shape } from "@/models/shapes";
import { IconDto } from "../services/icon-service";
import { capitalize, isDefined } from "@banjoanton/utils";

export const LIST_ITEM_TYPES = ["shape", "icon"] as const;
export type ListItemType = (typeof LIST_ITEM_TYPES)[number];

export type ShapeListItem = {
    type: "shape";
    description: string;
    tags: string[];
    title: string;
    item: Shape;
};

export type IconListItem = {
    type: "icon";
    description: string;
    tags: string[];
    title: string;
    item: IconDto;
};

export type ListItem = ShapeListItem | IconListItem;

const toIconListItem = (icon: IconDto): IconListItem => ({
    type: "icon",
    description: `Icon - ${icon.groupDisplayName}`,
    tags: [icon.groupDisplayName, icon.group, "icon"],
    title: icon.icon,
    item: icon,
});

const toShapeListItem = (shape: Shape): ShapeListItem => ({
    type: "shape",
    description: shape.description ?? "",
    tags: [shape.type, shape?.description ?? undefined, shape?.title ?? undefined, "shape"].filter(
        isDefined
    ),
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
