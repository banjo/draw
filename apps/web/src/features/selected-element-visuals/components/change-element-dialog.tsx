import { KeyboardButton } from "@/features/draw/components/keyboard-button";
import { Callback } from "@banjoanton/utils";
import { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
    changeElementRef: React.RefObject<HTMLDivElement>;
    onClick: Callback;
}>;

export const ChangeElementDialog = ({ changeElementRef, onClick }: Props) => {
    return (
        <div className="flex flex-row gap-2 items-center absolute z-[3]" ref={changeElementRef}>
            <KeyboardButton onClick={onClick} className="hover:cursor-default">
                Tab
            </KeyboardButton>
        </div>
    );
};
