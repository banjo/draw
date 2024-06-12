import { NativeToolbar } from "@/features/draw/models/native/native-toolbar";
import { NativeToolbarAddElementButton } from "@/features/draw/models/native/native-toolbar-add-element-button";

const init = () => {
    NativeToolbarAddElementButton.create();
    const id = NativeToolbarAddElementButton.getId();
    const addElementButton = NativeToolbarAddElementButton.get();

    const onResize = () => {
        NativeToolbar.parse();

        if (NativeToolbar.buttonExists(id)) {
            return;
        }

        NativeToolbar.addNewButton({ button: addElementButton, position: 1 });
    };

    NativeToolbar.onResize(onResize);
};

export const AddElementService = {
    init,
};
