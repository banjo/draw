import { useQuery } from "@tanstack/react-query";
import { ListItem } from "../models/list-item.model";
import { IconService } from "../services/icon-service";
import { isEmpty } from "@banjoanton/utils";

const fetchIcons = async (query: string) => {
    const icons = await IconService.searchIcons(query);
    return icons.map(ListItem.toIconListItem);
};

type UseIconsQueryProps = {
    query: string;
};
export const useIconsQuery = ({ query }: UseIconsQueryProps) => {
    const { data, isLoading } = useQuery({
        queryKey: ["icons", query],
        queryFn: () => fetchIcons(query),
        enabled: !isEmpty(query),
    });

    return { data: data ?? [], isLoading };
};
