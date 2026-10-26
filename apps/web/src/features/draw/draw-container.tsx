import { GlobalContextProvider } from "@/contexts/global-context";
import { Draw } from "@/features/draw/draw";
import { FC } from "react";
import { useParams } from "react-router-dom";

export const DrawContainer: FC = () => {
    const { slug } = useParams();

    // Remount on every drawing change, so no state or Excalidraw instance carries over
    return (
        <GlobalContextProvider key={slug ?? "local"}>
            <Draw slug={slug} />
        </GlobalContextProvider>
    );
};
