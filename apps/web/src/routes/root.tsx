import { DrawContainer } from "@/features/draw/draw-container";
import ErrorPage from "@/routes/error-page";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";

const createAppRouter = () =>
    createBrowserRouter([
        {
            path: "/",
            errorElement: <ErrorPage />,
            children: [
                {
                    path: "/",
                    element: <DrawContainer />,
                },
                {
                    path: "/draw/:slug",
                    element: <DrawContainer />,
                },
                {
                    path: "*",
                    element: <Navigate to={"/"} />,
                },
            ],
        },
    ]);

export function Root() {
    const appRouter = createAppRouter();
    return <RouterProvider router={appRouter} />;
}
