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
import React, {
    HTMLAttributes,
    PropsWithChildren,
    RefObject,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { cn } from "ui";
import { ListItem } from "../models/list-item.model";
import { useIconsQuery } from "../queries/useIconsQuery";

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

type BackgroundProps = PropsWithChildren & HTMLAttributes<HTMLDivElement>;
const Background = ({ children, ...props }: BackgroundProps) => (
    <div
        {...props}
        className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 flex-col"
    >
        {children}
    </div>
);

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
            keys: ["title"],
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
        (item: ListItem) => {
            if (!excalidrawApi) return;

            if (item.type === "icon") {
                // TODO: handle icon click
                console.log("icon clicked", item.item);
                closeMenu();
                return;
            }

            const currentElements = excalidrawApi.getSceneElements();
            const appState = excalidrawApi.getAppState();

            const viewportBounds = ElementPositionUtil.getActiveViewportBounds(appState);
            const center = ElementPositionUtil.getCenterFromBounds(viewportBounds);

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
                    {sortedItems.slice(0, 5).map((item, index) => (
                        <ListItemComponent
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
                                    <MemoImageComponent
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
                </ListContainer>
            </ComponentContainer>
        </Background>
    );
};
