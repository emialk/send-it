/**
 * Entry point for the static GitHub Pages build (no server, no SSR).
 * The Lovable preview keeps using the TanStack Start entry; this file is only
 * used by `bun run build:pages`.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

import { routeTree } from "./routeTree.gen";
import "./styles.css";

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
  basepath: import.meta.env.BASE_URL,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
