import { KeyboardButton } from "@/features/draw/components/keyboard-button";
import { Callback } from "@banjoanton/utils";
import { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
    changeElementRef: React.RefObject<HTMLButtonElement>;
    onClick: Callback;
}>;

export const ChangeElementDialog = ({ changeElementRef, onClick }: Props) => {
    return (
        <KeyboardButton
            onClick={onClick}
            customRef={changeElementRef}
            className="absolute z-[3] hover:cursor-default"
        >
            Tab
        </KeyboardButton>
    );
};
