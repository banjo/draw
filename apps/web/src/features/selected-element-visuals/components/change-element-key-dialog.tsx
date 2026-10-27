import { KeyboardButton } from "@/features/draw/components/keyboard-button";
import { MODIFIER_LABEL } from "@/utils/platform";
import { Callback } from "@banjoanton/utils";
import { PropsWithChildren } from "react";
import React from "react";

type Props = PropsWithChildren<{
    keyRef: React.RefObject<HTMLDivElement>;
    onClick: Callback;
}>;

export const SmartCopyKeyDialog = ({ keyRef, onClick }: Props) => (
    <div className="flex flex-row gap-2 items-center absolute z-[3]" ref={keyRef}>
        <KeyboardButton onClick={onClick}>{MODIFIER_LABEL}</KeyboardButton>+
        <KeyboardButton onClick={onClick}>↵</KeyboardButton>
    </div>
);
