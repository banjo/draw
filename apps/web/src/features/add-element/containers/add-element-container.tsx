import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation";
import { Shape, shapes } from "@/models/shapes";
import { PropsWithChildren, RefObject } from "react";
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

type ComponentContainerProps = PropsWithChildren & {
    onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
};
const ComponentContainer = ({ children, onKeyDown }: ComponentContainerProps) => (
    <div onKeyDown={onKeyDown} className="bg-white rounded-md shadow-lg w-80 max-h-2/3 h-auto p-4">
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
    const onClick = (item: Shape) => {
        console.log(item);
    };

    const { refs, selectedIndex, handleKeyboardNavigation } = useKeyboardNavigation({
        itemsToNavigate,
        onClick,
    });

    return (
        <Background>
            <ComponentContainer onKeyDown={handleKeyboardNavigation}>
                <input
                    className="border border-gray-300 bg-white h-10 px-5 rounded-md text-sm focus:outline-none w-full"
                    type="search"
                    name="search"
                    placeholder="Search..."
                    autoComplete="off"
                />
                <ListContainer>
                    {itemsToNavigate.map((item, index) => (
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
