export type AppRole = "admin" | "ops" | "analyst" | "field" | "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  ops: "Operations",
  analyst: "Analyst",
  field: "Field Officer",
  viewer: "Viewer",
};

export const DEFAULT_ROLE: AppRole = "viewer";

export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  "/dashboard": ["admin", "ops", "analyst", "field", "viewer"],
  "/risk-map": ["admin", "ops", "analyst", "field", "viewer"],
  "/monitoring": ["admin", "ops", "analyst", "field"],
  "/alerts": ["admin", "ops", "analyst", "field", "viewer"],
  "/citizen-reports": ["admin", "ops", "field", "viewer"],
  "/data-sources": ["admin", "ops", "analyst"],
  "/about": ["admin", "ops", "analyst", "field", "viewer"],
  "/admin/users": ["admin"],
};

export function normalizeRole(value: string | null | undefined): AppRole {
  if (!value) return DEFAULT_ROLE;
  if (value === "user") return DEFAULT_ROLE;
  if (value === "admin" || value === "ops" || value === "analyst" || value === "field" || value === "viewer") {
    return value;
  }
  return DEFAULT_ROLE;
}

export function canAccessRoute(role: AppRole, path: string) {
  const allowed = ROUTE_PERMISSIONS[path];
  if (!allowed) return role === "admin";
  return allowed.includes(role);
}
