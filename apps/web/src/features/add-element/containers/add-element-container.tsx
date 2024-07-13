import { useGlobal } from "@/contexts/global-context";
import { NativeContainer } from "@/features/draw/models/native/native-container";
import { ElementCreationUtil } from "@/features/draw/utils/element-creation-util";
import { ElementPositionUtil } from "@/features/draw/utils/element-position-util";
import { ElementUtil } from "@/features/draw/utils/element-util";
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { shapes } from "@/models/shapes";
import { useAddElementStore } from "@/stores/use-add-element-store";
import { isEmpty } from "@banjoanton/utils";
import { useDebounce } from "@uidotdev/usehooks";
import Fuse from "fuse.js";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ListItem } from "../models/list-item.model";
import { useIconsQuery } from "../queries/useIconsQuery";
import { AddElement } from "../components/add-element-component";
import { IconService } from "../services/icon-service";
import { FileUtil } from "@/features/draw/utils/file-util";

const DEFAULT_SHAPES = shapes.slice(0, 5).map(ListItem.toShapeListItem);

export const AddElementContainer = () => {
    const { excalidrawApi } = useGlobal();
    const setShowAddElementMenu = useAddElementStore(s => s.setShowAddElementMenu);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);

    const { data: iconListItems, isLoading: isLoadingIcons } = useIconsQuery({
        query: debouncedSearch,
    });

    const [shapeListItems, setShapeListItems] = useState(() => DEFAULT_SHAPES);

    const itemsToNavigate: ListItem[] = useMemo(
        () => [...shapeListItems, ...iconListItems],
        [shapeListItems, iconListItems]
    );

    const inputRef = React.useRef<HTMLInputElement>(null);

    const fuse = useMemo(() => {
        const fuseOptions = {
            threshold: 0.3,
            keys: ["title", "description", "tags"], // TODO: improve search to include tags
        };

        const items = [...DEFAULT_SHAPES, ...iconListItems];

        return new Fuse(items, fuseOptions);
    }, [iconListItems]);

    const closeMenu = () => {
        setShowAddElementMenu(false);
        NativeContainer.parse();
        NativeContainer.focus();
    };

    const onClick = useCallback(
        async (item: ListItem) => {
            if (!excalidrawApi) return;
            const currentElements = excalidrawApi.getSceneElements();
            const appState = excalidrawApi.getAppState();

            const viewportBounds = ElementPositionUtil.getActiveViewportBounds(appState);
            const center = ElementPositionUtil.getCenterFromBounds(viewportBounds);

            if (item.type === "icon") {
                const base64Icon = await IconService.fetchIconifyIcon(
                    item.item.icon,
                    item.item.group
                );

                const imageData = FileUtil.createImageFile({
                    data: base64Icon,
                    mimeType: "image/svg+xml", // TODO: is this always svg?
                });

                const imageElement = ElementCreationUtil.createImage({
                    base: {
                        x: center.x,
                        y: center.y,
                        width: 100,
                        height: 100,
                    },
                    fileId: imageData.id,
                });

                const { updatedState } = ElementUtil.createNewElementSelection(
                    [imageElement],
                    appState
                );

                excalidrawApi.addFiles([imageData]);
                excalidrawApi.updateScene({
                    elements: [...currentElements, imageElement],
                    appState: updatedState,
                    commitToHistory: true,
                });

                closeMenu();
                return;
            }

            const newElements = ElementCreationUtil.createElementFromType(item.item.type, {
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
        },
        [excalidrawApi, closeMenu]
    );

    const { refs, selectedIndex, handleKeyboardNavigation, resetSelectedIndex } =
        useKeyboardNavigation({
            itemsToNavigate,
            onClick,
        });

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearch(value);

        if (isEmpty(value)) {
            setShapeListItems(DEFAULT_SHAPES);
            return;
        }

        const results = fuse.search(value).map(res => res.item);
        resetSelectedIndex();

        const shapeResults = results.filter(ListItem.filterByShape);
        setShapeListItems(shapeResults);
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

    const noResults = isEmpty(itemsToNavigate) && !isLoadingIcons;

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // sort input items so that shapes are always on top
    const sortedItems = itemsToNavigate.toSorted((a, b) => {
        if (a.type === "shape" && b.type === "icon") {
            return -1;
        }

        if (a.type === "icon" && b.type === "shape") {
            return 1;
        }

        return 0;
    });

    return (
        <AddElement.Background onKeyDown={onKeyDown} onClick={onOutsideClick}>
            <AddElement.ComponentContainer onClick={onComponentClick}>
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
                <AddElement.ListContainer>
                    {noResults && <div className="text-gray-500">No results found</div>}
                    {sortedItems.slice(0, 5).map((item, index) => (
                        <AddElement.ListItemComponent
                            key={`${item.type}-${item.title}-${item.description}`}
                            title={item.title}
                            description={item.description}
                            selected={selectedIndex === index}
                            refObject={refs[index]}
                            item={item}
                            Icon={() => {
                                if (item.type === "shape") {
                                    return <item.item.Icon />;
                                }

                                return (
                                    <AddElement.MemoImageComponent
                                        className="w-5 h-5"
                                        width={25}
                                        height={25}
                                        src={item.item.url}
                                        alt={item.item.icon}
                                    />
                                );
                            }}
                            onClick={onClick}
                        />
                    ))}
                    {isLoadingIcons && <div className="text-black">Loading icons...</div>}
                </AddElement.ListContainer>
            </AddElement.ComponentContainer>
        </AddElement.Background>
    );
};
