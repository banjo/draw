import { Maybe, noop } from "@banjoanton/utils";
import { ExcalidrawApi } from "common";
import { createContext, PropsWithChildren, useContext, useState } from "react";
import React from "react";

export interface GlobalContextInterface {
    excalidrawApi: Maybe<ExcalidrawApi>;
    setExcalidrawApi: React.Dispatch<React.SetStateAction<Maybe<ExcalidrawApi>>>;
}

const emptyGlobalContext: GlobalContextInterface = {
    excalidrawApi: undefined,
    setExcalidrawApi: noop,
};

const GlobalContext = createContext<GlobalContextInterface>(emptyGlobalContext);
const useGlobal = () => useContext(GlobalContext);

const GlobalContextProvider = ({ children }: PropsWithChildren) => {
    const [excalidrawApi, setExcalidrawApi] = useState<Maybe<ExcalidrawApi>>(undefined);

    const context: GlobalContextInterface = {
        excalidrawApi,
        setExcalidrawApi,
    };

    return <GlobalContext.Provider value={context}>{children}</GlobalContext.Provider>;
};

export { GlobalContextProvider, useGlobal };
