import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { Shape, shapes } from "@/models/shapes";
import { isEmpty } from "@banjoanton/utils";
import Fuse from "fuse.js";
import React, { HTMLAttributes, PropsWithChildren, RefObject, useState } from "react";
import { cn } from "ui";

type ListItemProps = PropsWithChildren & {
    selected?: boolean;
    refObject?: RefObject<HTMLDivElement>;
    shape: Shape;
    onClick?: (item: Shape) => void;
};

const ListItem = ({ onClick, selected = false, refObject, shape }: ListItemProps) => {
    const { title, Icon } = shape;
    const selectedStyle = selected ? "bg-gray-100" : "";
    return (
        <div
            ref={refObject}
            onClick={() => onClick?.(shape)}
            className={cn(
                `p-4 border border-gray-300 bg-white rounded-md w-full hover:bg-gray-100 hover:cursor-pointer`,
                selectedStyle
            )}
        >
            <div className="flex gap-4 items-center">
                {Icon && <Icon />}
                {title}
            </div>
        </div>
    );
};

const ListContainer = ({ children }: PropsWithChildren) => (
    <div className="mt-4 flex flex-col gap-y-2 items-center">{children}</div>
);

type ComponentContainerProps = HTMLAttributes<HTMLDivElement> & PropsWithChildren;

const ComponentContainer = ({ children, ...props }: ComponentContainerProps) => (
    <div {...props} className="bg-white rounded-md shadow-lg w-80 h-[410px] p-4">
        {children}
    </div>
);

const Background = ({ children }: PropsWithChildren) => (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 flex-col">
        {children}
    </div>
);

const itemsToNavigate = shapes;

export const AddElementContainer = () => {
    const [search, setSearch] = useState("");
    const [listItems, setListItems] = useState<Shape[]>(() => shapes);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const fuseOptions = {
        threshold: 0.3,
        keys: ["title"],
    };

    const fuse = new Fuse(itemsToNavigate, fuseOptions);

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);

        if (isEmpty(value)) {
            setListItems(itemsToNavigate);
            return;
        }

        const results = fuse.search(value);
        setListItems(results.map(result => result.item));
    };

    const onClick = (item: Shape) => {
        console.log(item);
    };

    const { refs, selectedIndex, handleKeyboardNavigation } = useKeyboardNavigation({
        itemsToNavigate,
        onClick,
    });

    const onComponentClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        inputRef.current?.focus();
    };

    const noResults = isEmpty(listItems);

    return (
        <Background>
            <ComponentContainer onClick={onComponentClick} onKeyDown={handleKeyboardNavigation}>
                <input
                    value={search}
                    onChange={onInputChange}
                    className="border border-gray-300 bg-white h-10 px-5 rounded-md text-sm focus:outline-none w-full"
                    type="search"
                    name="search"
                    placeholder="Search..."
                    autoComplete="off"
                    ref={inputRef}
                />
                <ListContainer>
                    {noResults && <div className="text-gray-500">No results found</div>}
                    {listItems.slice(0, 5).map((item, index) => (
                        <ListItem
                            key={index}
                            selected={selectedIndex === index}
                            refObject={refs[index]}
                            shape={item}
                            onClick={onClick}
                        />
                    ))}
                </ListContainer>
            </ComponentContainer>
        </Background>
    );
};
