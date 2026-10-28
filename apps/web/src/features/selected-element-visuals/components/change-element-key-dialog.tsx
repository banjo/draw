import { Keys } from "@/components/keys";
import { Callback } from "@banjoanton/utils";
import React from "react";

type Props = {
    changeElementKeyRef: React.RefObject<HTMLDivElement>;
    onClick: Callback;
};

export const ChangeElementKeyDialog = ({ changeElementKeyRef, onClick }: Props) => (
    <div className="absolute z-[3]" ref={changeElementKeyRef}>
        <button
            type="button"
            onClick={onClick}
            className="flex h-7 select-none items-center gap-1.5 whitespace-nowrap rounded-lg bg-white pl-1 pr-2 text-xs font-medium text-zinc-500 shadow-[0_0_0_1px_rgba(20,20,40,0.09),0_4px_12px_-6px_rgba(0,0,0,0.25)] hover:text-[#1b1b1f] dark:bg-[#232329] dark:text-zinc-400 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_4px_12px_-6px_rgba(0,0,0,0.6)] dark:hover:text-[#ececf1]"
        >
            <Keys keys={["Tab"]} />
            Change shape
        </button>
    </div>
);
