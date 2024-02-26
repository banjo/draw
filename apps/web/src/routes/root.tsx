// import { Draw } from "@/features/draw/draw";
// import { DrawContainer } from "@/features/draw/draw-container";
// import ErrorPage from "@/routes/error-page";
// import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";

// const router = createBrowserRouter([
//     {
//         path: "/",
//         errorElement: <ErrorPage />,
//         element: (
//             <>
//                 <Outlet />
//             </>
//         ),
//         children: [
//             {
//                 path: "/",
//                 element: <Draw />,
//             },
//             {
//                 path: "*",
//                 element: <Navigate to={"/"} />,
//             },
//         ],
//     },
// ]);

// // TODO: use one router instead as firebase support that
// const signedOutRouter = createBrowserRouter([
//     {
//         path: "/",
//         element: <Outlet />,
//         errorElement: <ErrorPage />,
//         children: [
//             {
//                 path: "/",
//                 element: <DrawContainer />,
//             },
//             {
//                 path: "/draw/:slug",
//                 element: <DrawContainer />,
//             },
//             {
//                 path: "*",
//                 element: <Navigate to={"/"} />,
//             },
//         ],
//     },
// ]);

// export function Root() {
//     return <RouterProvider router={signedOutRouter} />;
//     // const { userId } = useAuth();

//     // if (!userId) {
//     //     return <RouterProvider router={signedOutRouter} />;
//     // }

//     // return <RouterProvider router={router} />;
// }

import { useAuth } from "@/contexts/auth-context";
import { DrawContainer } from "@/features/draw/draw-container";
import ErrorPage from "@/routes/error-page";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";

const createAppRouter = (isAuthenticated: boolean) =>
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
    const { userId } = useAuth();
    const isAuthenticated = !!userId;
    const appRouter = createAppRouter(isAuthenticated);

    return <RouterProvider router={appRouter} />;
}
