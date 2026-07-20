import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "@/services";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
