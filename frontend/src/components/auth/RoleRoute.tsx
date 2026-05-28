import { Link, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";
import { DEFAULT_ROLE, normalizeRole, type AppRole } from "@/lib/rbac";

export default function RoleRoute({ allow }: { allow: AppRole[] }) {
  const { role, loading } = useAuth();
  const skipAuth = import.meta.env.VITE_DISABLE_AUTH === "true";

  if (skipAuth) {
    return <Outlet />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading access...
      </div>
    );
  }

  const resolvedRole = normalizeRole(role ?? DEFAULT_ROLE);
  if (!allow.includes(resolvedRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-xl border border-border p-6 bg-secondary">
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Restricted</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Your role does not have access to this section.
          </p>
          <Link
            to="/dashboard"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
