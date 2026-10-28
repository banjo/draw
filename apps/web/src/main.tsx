import { App } from "@/app";
import { CustomShapeUtil } from "@/features/draw/utils/custom-shape-util";
import React from "react";
import ReactDOM from "react-dom/client";

CustomShapeUtil.register();

ReactDOM.createRoot(document.querySelector("#root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
