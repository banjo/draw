import { Maybe, noop } from "@banjoanton/utils";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { PropsWithChildren, createContext, useContext, useState } from "react";

export interface GlobalContextInterface {
    excalidrawApi: Maybe<ExcalidrawImperativeAPI>;
    setExcalidrawApi: React.Dispatch<React.SetStateAction<Maybe<ExcalidrawImperativeAPI>>>;
}

const emptyGlobalContext: GlobalContextInterface = {
    excalidrawApi: undefined,
    setExcalidrawApi: noop,
};

const GlobalContext = createContext<GlobalContextInterface>(emptyGlobalContext);
const useGlobal = () => useContext(GlobalContext);

const GlobalContextProvider = ({ children }: PropsWithChildren) => {
    const [excalidrawApi, setExcalidrawApi] = useState<Maybe<ExcalidrawImperativeAPI>>(undefined);

    const context: GlobalContextInterface = {
        excalidrawApi,
        setExcalidrawApi,
    };

    return <GlobalContext.Provider value={context}>{children}</GlobalContext.Provider>;
};

export { GlobalContextProvider, useGlobal };
