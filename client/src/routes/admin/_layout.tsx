import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isAdminAuthenticated } from "@/lib/adminApi";

// Pathless layout route — wraps all /admin/* pages.
// The underscore prefix tells TanStack Router this is a layout-only route
// with no URL segment of its own.
export const Route = createFileRoute("/admin/_layout")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/admin/login") return;
    if (!isAdminAuthenticated()) {
      throw redirect({ to: "/admin/login" });
    }
  },
  component: () => <Outlet />,
});
