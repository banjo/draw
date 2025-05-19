import { isDefined } from "@banjoanton/utils";
import { X } from "lucide-react";
import {
    HTMLAttributes,
    KeyboardEvent,
    MouseEvent,
    PropsWithChildren,
    RefObject,
    useEffect,
    useRef,
} from "react";
import { cn } from "ui";

type BackgroundProps = PropsWithChildren &
    HTMLAttributes<HTMLDivElement> & {
        refObject?: RefObject<HTMLDivElement>;
    };
const Background = ({ children, className, refObject, ...props }: BackgroundProps) => (
    <div
        {...props}
        ref={refObject}
        tabIndex={-1}
        className={cn(
            "fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 flex-col",
            className
        )}
    >
        {children}
    </div>
);

type ModalProps = PropsWithChildren & {
    onOutsideClick?: (e: MouseEvent<HTMLDivElement>) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
    onEscape?: (e: KeyboardEvent<HTMLDivElement>) => void;
    setShow: (show: boolean) => void;
    onClose?: () => void;
    show?: boolean;
    backgroundClassName?: string;
};

const Container = (props: ModalProps) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (props.show) {
            ref.current?.focus();
        }
    }, [props.show]);

    if (isDefined(props.show) && !props.show) {
        return null;
    }

    const onOutsideClick = (e: MouseEvent<HTMLDivElement>) => {
        props.onOutsideClick?.(e);
        if (e.target === e.currentTarget) {
            props.onClose?.();
            props.setShow(false);
        }
    };

    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        props.onKeyDown?.(e);
        if (e.key === "Escape") {
            props.onEscape?.(e);
            props.onClose?.();
            props.setShow(false);
        }
    };

    return (
        <Background
            refObject={ref}
            className={props?.backgroundClassName}
            onKeyDown={onKeyDown}
            onClick={onOutsideClick}
        >
            {props.children}
        </Background>
    );
};

type ContentProps = PropsWithChildren & HTMLAttributes<HTMLDivElement>;
const Content = ({ children, className, ...props }: ContentProps) => (
    <div {...props} className={cn("bg-white p-4 rounded-md shadow-lg mt-2", className)}>
        {children}
    </div>
);

type HeaderProps = PropsWithChildren &
    HTMLAttributes<HTMLDivElement> & {
        onClose?: () => void;
    };

const Header = ({ children, onClose, className, ...props }: HeaderProps) => (
    <div {...props} className={cn("relative flex-col justify-between items-start", className)}>
        {children}
        {onClose ? (
            <X
                onClick={onClose}
                className="absolute top-0 right-0 cursor-pointer"
                aria-label="Close modal"
            />
        ) : null}
    </div>
);

type TitleProps = PropsWithChildren & HTMLAttributes<HTMLHeadingElement>;
const Title = ({ children, className, ...props }: TitleProps) => (
    <h2 {...props} className={cn("text-lg font-bold", className)}>
        {children}
    </h2>
);

type DescriptionProps = PropsWithChildren & HTMLAttributes<HTMLParagraphElement>;
const Description = ({ children, className, ...props }: DescriptionProps) => (
    <p {...props} className={cn("text-gray-500 mt-1", className)}>
        {children}
    </p>
);

type BodyProps = PropsWithChildren & HTMLAttributes<HTMLDivElement>;
const Body = ({ children, className, ...props }: BodyProps) => (
    <div {...props} className={cn("mt-6", className)}>
        {children}
    </div>
);

type FooterProps = PropsWithChildren & HTMLAttributes<HTMLDivElement>;
const Footer = ({ children, className, ...props }: FooterProps) => (
    <div {...props} className={cn("mt-4 flex justify-end gap-2", className)}>
        {children}
    </div>
);

export const Modal = {
    Container,
    Content,
    Header,
    Body,
    Footer,
    Title,
    Description,
};
