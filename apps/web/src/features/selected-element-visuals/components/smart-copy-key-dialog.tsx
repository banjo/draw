import { KeyboardButton } from "@/features/draw/components/keyboard-button";
import { Callback } from "@banjoanton/utils";
import { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
    changeElementKeyRef: React.RefObject<HTMLDivElement>;
    onClick: Callback;
}>;

export const ChangeElementKeyDialog = ({ changeElementKeyRef, onClick }: Props) => {
    return (
        <div className="flex flex-row gap-2 items-center absolute z-[3]" ref={changeElementKeyRef}>
            <KeyboardButton onClick={onClick}>Tab</KeyboardButton>
        </div>
    );
};
