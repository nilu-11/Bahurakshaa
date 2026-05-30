import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Clock,
  ExternalLink,
  LocateFixed,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/useAuth";
import { cn } from "@/lib/utils";
import { DEFAULT_ROLE, normalizeRole } from "@/lib/rbac";

const typeLabels = {
  rising_water: "Rising Water",
  cracks: "Ground Cracks",
  blocked_drain: "Blocked Drain",
  landslide_signs: "Landslide Signs",
  other: "Other",
};

type CitizenReportType = keyof typeof typeLabels;

type CitizenReport = {
  id: string;
  type: CitizenReportType;
  description: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
  trust_score: number;
  verified: boolean;
  created_at: string;
  created_by?: string | null;
};

type ReportForm = {
  type: CitizenReportType;
  description: string;
  location: string;
};

const emptyForm: ReportForm = {
  type: "rising_water",
  description: "",
  location: "",
};

export default function CitizenReportsPage() {
  const { user, role } = useAuth();
  const resolvedRole = normalizeRole(role ?? DEFAULT_ROLE);
  const canReviewReports = resolvedRole === "admin" || resolvedRole === "ops";
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ReportForm>(emptyForm);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "verified">("all");

  const {
    data: reports = [],
    isLoading,
    error,
  } = useQuery<CitizenReport[]>({
    queryKey: ["citizen-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("citizen_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CitizenReport[];
    },
  });

  const submitReport = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be signed in to submit a report.");
      if (!formData.location.trim() || !formData.description.trim()) {
        throw new Error("Location and description are required.");
      }

      const { error } = await supabase.from("citizen_reports").insert({
        type: formData.type,
        description: formData.description.trim(),
        location_name: formData.location.trim(),
        location_lat: coords?.lat ?? 27.7,
        location_lng: coords?.lng ?? 85.3,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Report submitted for review");
      setShowForm(false);
      setFormData(emptyForm);
      setCoords(null);
      setGeoStatus("");
      await queryClient.invalidateQueries({ queryKey: ["citizen-reports"] });
    },
    onError: (err) => {
      toast.error("Failed to submit report", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    },
  });

  const reviewReport = useMutation({
    mutationFn: async ({
      id,
      verified,
      trustScore,
    }: {
      id: string;
      verified: boolean;
      trustScore: number;
    }) => {
      const { error } = await supabase
        .from("citizen_reports")
        .update({ verified, trust_score: trustScore })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_, vars) => {
      toast.success(vars.verified ? "Report verified" : "Report marked pending");
      await queryClient.invalidateQueries({ queryKey: ["citizen-reports"] });
    },
    onError: (err) => {
      toast.error("Could not update report", {
        description: err instanceof Error ? err.message : "Only admin and operations users can review reports.",
      });
    },
  });

  const filteredReports = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (filter === "pending" && report.verified) return false;
      if (filter === "verified" && !report.verified) return false;
      if (!needle) return true;
      return [typeLabels[report.type], report.description, report.location_name]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, reports, search]);

  const pendingCount = reports.filter((report) => !report.verified).length;
  const verifiedCount = reports.length - pendingCount;

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("Geolocation unavailable");
      return;
    }
    setGeoStatus("Locating...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("GPS captured");
      },
      () => setGeoStatus("GPS permission denied"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <AppLayout>
      <div className="space-y-5 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ocean-400/15">
              <ShieldCheck className="h-5 w-5 text-ocean-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Citizen Reports</h1>
              <p className="text-sm text-muted-foreground">
                Review field observations, verify reports, and prioritize response.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["citizen-reports"] })}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button type="button" onClick={() => setShowForm((open) => !open)}>
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Close Form" : "Submit Report"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Total reports" value={reports.length} />
          <Metric label="Pending review" value={pendingCount} tone="warning" />
          <Metric label="Verified" value={verifiedCount} tone="safe" />
        </div>

        {showForm && (
          <form onSubmit={(event) => { event.preventDefault(); submitReport.mutate(); }} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">New Field Report</h2>
                <p className="text-xs text-muted-foreground">
                  Reports are queued for admin or operations verification.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Report Type">
                <select
                  value={formData.type}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, type: event.target.value as CitizenReportType }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Location">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Teku Bridge"
                    value={formData.location}
                    onChange={(event) => setFormData((prev) => ({ ...prev, location: event.target.value }))}
                    required
                  />
                  <Button type="button" variant="outline" onClick={captureLocation}>
                    <LocateFixed className="h-4 w-4" />
                    GPS
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {coords ? `Lat ${coords.lat.toFixed(4)}, Lng ${coords.lng.toFixed(4)}` : "Default basin coordinates will be used."}
                  {geoStatus ? ` | ${geoStatus}` : ""}
                </p>
              </Field>

              <Field label="Description" className="md:col-span-2">
                <Textarea
                  placeholder="Describe water level, cracks, blockage, slope movement, or local impact."
                  value={formData.description}
                  onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                  rows={4}
                  required
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitReport.isPending}>
                <Plus className="h-4 w-4" />
                {submitReport.isPending ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </form>
        )}

        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by place, report type, or description"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as typeof filter)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="all">All reports</option>
                <option value="pending">Pending only</option>
                <option value="verified">Verified only</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-risk-warning/40 bg-risk-warning/10 p-4 text-sm text-risk-warning">
            Could not load citizen reports. Check your role and Supabase policy.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {isLoading ? (
            <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading reports...
            </div>
          ) : (
            filteredReports.map((report) => (
              <article key={report.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {typeLabels[report.type] ?? report.type}
                      </span>
                      <StatusBadge verified={report.verified} />
                    </div>
                    <p className="text-sm leading-6 text-foreground">{report.description}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {report.location_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(report.created_at).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Trust {Math.round(report.trust_score * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a
                        href={`https://www.google.com/maps?q=${report.location_lat},${report.location_lng}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Map
                      </a>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canReviewReports || reviewReport.isPending || report.verified}
                      onClick={() => reviewReport.mutate({ id: report.id, verified: true, trustScore: 1 })}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Verify
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!canReviewReports || reviewReport.isPending || !report.verified}
                      onClick={() => reviewReport.mutate({ id: report.id, verified: false, trustScore: 0.4 })}
                    >
                      <XCircle className="h-4 w-4" />
                      Reopen
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {!isLoading && filteredReports.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No citizen reports match the current filters.
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("space-y-1.5 md:col-span-1", className)}>
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "safe";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-bold text-foreground",
          tone === "warning" && "text-risk-watch",
          tone === "safe" && "text-risk-safe",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-risk-safe/15 px-2 py-0.5 text-xs font-medium text-risk-safe">
      <CheckCircle className="h-3.5 w-3.5" />
      Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-risk-watch/15 px-2 py-0.5 text-xs font-medium text-risk-watch">
      <XCircle className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}
