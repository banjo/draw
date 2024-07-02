import { Draw } from "@/features/draw/draw";
import { FC } from "react";
import { useParams } from "react-router-dom";

export const DrawContainer: FC = () => {
    const { slug } = useParams();
    return <Draw slug={slug} />;
};
