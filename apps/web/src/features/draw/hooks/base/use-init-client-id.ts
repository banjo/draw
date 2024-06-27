import { useClientIdStore } from "@/stores/use-client-id-store";
import { uuid } from "@banjoanton/utils";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useEffect } from "react";

const ID_KEY = "banjo-collab-id";

export const useInitClientId = () => {
    const [clientId] = useLocalStorage(ID_KEY, uuid());

    const { setClientId } = useClientIdStore();

    useEffect(() => {
        setClientId(clientId);
    }, []);
};
