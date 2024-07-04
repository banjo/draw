import { useGlobal } from "@/contexts/global-context";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { Shape, shapes } from "@/models/shapes";
import { useAddElementStore } from "@/stores/use-add-element-store";
import { isEmpty } from "@banjoanton/utils";
import Fuse from "fuse.js";
import React, { HTMLAttributes, PropsWithChildren, RefObject, useEffect, useState } from "react";
import { cn } from "ui";

type ListItemProps = PropsWithChildren & {
    selected?: boolean;
    refObject?: RefObject<HTMLDivElement>;
    shape: Shape;
    onClick?: (item: Shape) => void;
};

const ListItem = ({ onClick, selected = false, refObject, shape }: ListItemProps) => {
    const { title, Icon, description } = shape;
    const selectedStyle = selected ? "bg-gray-100" : "";
    return (
        <div
            ref={refObject}
            onClick={() => onClick?.(shape)}
            className={cn(
                `px-4 py-2 border border-gray-300 bg-white rounded-md w-full hover:bg-gray-100 hover:cursor-pointer`,
                selectedStyle
            )}
        >
            <div className="flex gap-4 items-center">
                {Icon && <Icon />}
                <div className="flex flex-col items-start">
                    <span className="text-sm">{title}</span>
                    <span className="text-gray-600 text-xs">{description}</span>
                </div>
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

type BackgroundProps = PropsWithChildren & HTMLAttributes<HTMLDivElement>;
const Background = ({ children, ...props }: BackgroundProps) => (
    <div
        {...props}
        className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 flex-col"
    >
        {children}
    </div>
);

const itemsToNavigate = shapes;

export const AddElementContainer = () => {
    const { excalidrawApi } = useGlobal();
    const setShowAddElementMenu = useAddElementStore(s => s.setShowAddElementMenu);
    const [search, setSearch] = useState("");
    const [listItems, setListItems] = useState<Shape[]>(() => shapes);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const fuseOptions = {
        threshold: 0.3,
        keys: ["title"],
    };

    const fuse = new Fuse(itemsToNavigate, fuseOptions);

    const closeMenu = () => {
        setShowAddElementMenu(false);
        NativeContainer.parse();
        NativeContainer.focus();
    };

    const onClick = (item: Shape) => {
        if (!excalidrawApi) return;

        const currentElements = excalidrawApi.getSceneElements();
        const appState = excalidrawApi.getAppState();

        const viewportBounds = ElementPositionUtil.getActiveViewportBounds(appState);
        const center = ElementPositionUtil.getCenterFromBounds(viewportBounds);

        const newElements = ElementCreationUtil.createElementFromType(item.type, {
            x: center.x,
            y: center.y,
        });

        const { updatedState } = ElementUtil.createNewElementSelection(newElements, appState);

        excalidrawApi.updateScene({
            elements: [...currentElements, ...newElements],
            appState: updatedState,
            commitToHistory: true,
        });

        closeMenu();
    };

    const { refs, selectedIndex, handleKeyboardNavigation, resetSelectedIndex } =
        useKeyboardNavigation({
            itemsToNavigate,
            onClick,
        });

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);

        if (isEmpty(value)) {
            setListItems(itemsToNavigate);
            return;
        }

        const results = fuse.search(value);
        resetSelectedIndex();
        setListItems(results.map(result => result.item));
    };

    const onComponentClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        inputRef.current?.focus();
    };

    const onOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            closeMenu();
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") {
            closeMenu();
            return;
        }

        return handleKeyboardNavigation(e);
    };

    const noResults = isEmpty(listItems);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <Background onKeyDown={onKeyDown} onClick={onOutsideClick}>
            <ComponentContainer onClick={onComponentClick}>
                <input
                    value={search}
                    onChange={onInputChange}
                    className="border border-gray-300 bg-white h-10 px-5 rounded-md text-sm focus:outline-none w-full"
                    type="search"
                    name="search"
                    placeholder="Search..."
                    autoComplete="off"
                    autoFocus
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
