import { HTMLAttributes, PropsWithChildren } from "react";

type BackgroundProps = PropsWithChildren & HTMLAttributes<HTMLDivElement>;
const Background = ({ children, ...props }: BackgroundProps) => (
    <div
        {...props}
        className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 flex-col"
    >
        {children}
    </div>
);

type ModalProps = PropsWithChildren & {
    onOutsideClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onEscape?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    setShow: (show: boolean) => void;
    onClose?: () => void;
};

export const ModalContainer = (props: ModalProps) => {
    const onOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
        props.onOutsideClick?.(e);
        if (e.target === e.currentTarget) {
            props.onClose?.();
            props.setShow(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        props.onKeyDown?.(e);
        if (e.key === "Escape") {
            props.onEscape?.(e);
            props.onClose?.();
            props.setShow(false);
        }
    };

    return (
        <Background onKeyDown={onKeyDown} onClick={onOutsideClick}>
            {props.children}
        </Background>
    );
};
