import { NativeHelpButton } from "@/features/draw/models/native/native-help-button";
import { NativeHelpDialog } from "@/features/draw/models/native/native-help-dialog";
import { useEffect } from "react";

export const useHelpMenu = () => {
    const onHelpButtonClick = (e: MouseEvent) => {
        // set timeout to wait for the help dialog to be rendered
        setTimeout(async () => {
            await NativeHelpDialog.waitForElement();
            NativeHelpDialog.hideHelpHeader();
        }, 0);
    };

    useEffect(() => {
        // set timeout to wait for the help button to be rendered
        setTimeout(async () => {
            await NativeHelpButton.waitForElement();
            NativeHelpButton.addOnClick(onHelpButtonClick);
        }, 0);
    }, []);

    return {
        onHelpButtonClick,
    };
};
