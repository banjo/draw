import React, { HTMLAttributes, PropsWithChildren, RefObject, useMemo } from "react";
import { ListItem } from "../models/list-item.model";
import { cn } from "ui";

type ListItemProps = {
    selected?: boolean;
    refObject?: RefObject<HTMLDivElement>;
    Icon?: React.FC;
    item: ListItem;
    title: string;
    description: string;
    onClick?: (item: ListItem) => void;
};

const ListItemWithoutMemo = ({
    onClick,
    selected = false,
    refObject,
    Icon,
    item,
    title,
    description,
}: ListItemProps) => {
    const selectedStyle = selected ? "bg-gray-100" : "";

    // only re-render if the type changes
    const MemoIcon = useMemo(() => Icon, [item.type]);

    return (
        <div
            ref={refObject}
            onClick={() => onClick?.(item)}
            className={cn(
                `px-4 py-2 border border-gray-300 bg-white rounded-md w-full hover:bg-gray-100 hover:cursor-pointer`,
                selectedStyle
            )}
        >
            <div className="flex gap-4 items-center">
                {MemoIcon && <MemoIcon />}
                <div className="flex flex-col items-start">
                    <span className="text-sm">{title}</span>
                    <span className="text-gray-600 text-xs">{description}</span>
                </div>
            </div>
        </div>
    );
};

const ListItemComponent = React.memo(ListItemWithoutMemo);

const ImageComponent = (
    props: HTMLAttributes<HTMLImageElement> & {
        width?: number;
        height?: number;
        src: string;
        alt?: string;
    }
) => <img {...props} />;
const MemoImageComponent = React.memo(ImageComponent);

const ListContainer = ({ children }: PropsWithChildren) => (
    <div className="mt-4 flex flex-col gap-y-2 items-center">{children}</div>
);

type ComponentContainerProps = HTMLAttributes<HTMLDivElement> & PropsWithChildren;

const ComponentContainer = ({ children, ...props }: ComponentContainerProps) => (
    <div {...props} className="bg-white rounded-md shadow-lg w-80 h-[410px] p-4">
        {children}
    </div>
);

export const AddElement = {
    ComponentContainer,
    ListContainer,
    ListItemComponent,
    MemoImageComponent,
};
