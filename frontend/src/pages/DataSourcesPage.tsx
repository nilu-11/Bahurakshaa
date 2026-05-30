import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle,
  CloudRain,
  Database,
  FileCheck2,
  Gauge,
  GitBranch,
  Layers3,
  Link as LinkIcon,
  Map,
  Mountain,
  Radar,
  Route,
  Satellite,
  ShieldCheck,
  Table2,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  fetchDataSources,
  fetchLatestSentinelScenes,
  fetchSatelliteProducts,
} from "@/lib/operationalData";
import { cn } from "@/lib/utils";

type PipelineSource = {
  slug: string;
  name: string;
  provider: string;
  category: string;
  stage: "raw" | "feature" | "training" | "model" | "operational";
  status: "collected" | "active" | "derived" | "trained" | "fallback";
  script?: string;
  artifact?: string;
  description: string;
  features: string[];
  icon: LucideIcon;
};

const pipelineSources: PipelineSource[] = [
  {
    slug: "bipad-incidents",
    name: "BIPAD Incident Records",
    provider: "Government of Nepal BIPAD",
    category: "ground truth",
    stage: "raw",
    status: "collected",
    artifact: "data/raw/bipad/incidents-*.csv",
    description: "Historical flood and landslide labels used to build supervised training samples.",
    features: ["event label", "district", "municipality", "incident date"],
    icon: Users,
  },
  {
    slug: "gpm-imerg",
    name: "GPM IMERG Daily Rainfall",
    provider: "NASA GPM via Google Earth Engine",
    category: "rainfall",
    stage: "feature",
    status: "collected",
    script: "scripts/02_download_rainfall.py",
    artifact: "data/raw/rainfall/gpm_bagmati_daily.csv",
    description: "Daily Bagmati Basin rainfall exported from GEE and converted into rolling rainfall windows.",
    features: ["rf_1day", "rf_3day", "rf_7day", "rf_30day"],
    icon: CloudRain,
  },
  {
    slug: "era5-land-runoff",
    name: "ERA5-Land Runoff and Soil Moisture",
    provider: "ECMWF ERA5-Land via Google Earth Engine",
    category: "hydrology",
    stage: "feature",
    status: "collected",
    script: "scripts/03_download_discharge.py",
    artifact: "data/raw/discharge/glofas_bagmati_daily.csv",
    description: "Station-sampled runoff and volumetric soil-water layers used as discharge and wetness proxies.",
    features: ["discharge_proxy", "soil_moisture_index", "surface runoff", "sub-surface runoff"],
    icon: Gauge,
  },
  {
    slug: "sentinel-1-sar-training",
    name: "Sentinel-1 SAR Backscatter",
    provider: "Copernicus Sentinel-1 via Google Earth Engine",
    category: "satellite",
    stage: "feature",
    status: "collected",
    script: "scripts/07_download_sar.py",
    artifact: "data/raw/sentinel/sentinel1_bagmati_daily.csv",
    description: "VV/VH SAR basin means aligned to rainfall dates for flood and landslide feature tables.",
    features: ["sar_vv_db", "sar_vh_db", "sar_vv_vh_ratio_db"],
    icon: Radar,
  },
  {
    slug: "srtm-dem",
    name: "SRTM Digital Elevation",
    provider: "NASA SRTM / OpenTopography",
    category: "terrain",
    stage: "feature",
    status: "collected",
    artifact: "data/raw/dem/srtm_bagmati.tif",
    description: "Terrain raster sampled at event and negative points for elevation and slope-derived predictors.",
    features: ["elevation_m", "slope_deg", "aspect_deg", "curvature", "dist_drainage_m"],
    icon: Mountain,
  },
  {
    slug: "esa-worldcover",
    name: "ESA WorldCover 10m",
    provider: "ESA WorldCover public S3",
    category: "land cover",
    stage: "feature",
    status: "collected",
    script: "scripts/01_download_worldcover.py",
    artifact: "data/raw/landuse/worldcover_nepal.tif",
    description: "Land-cover tile converted into land-use code and NDVI proxy features.",
    features: ["landuse_code", "ndvi_proxy"],
    icon: Layers3,
  },
  {
    slug: "bagmati-boundary",
    name: "Bagmati Basin Boundary",
    provider: "Project boundary file",
    category: "domain",
    stage: "feature",
    status: "active",
    artifact: "data/raw/boundary/bagmatibasin.geojson",
    description: "Basin polygon used for domain filtering with bounding-box fallback when unavailable.",
    features: ["basin mask", "domain validation", "sample filtering"],
    icon: Map,
  },
  {
    slug: "training-tables",
    name: "Flood and Landslide Training Tables",
    provider: "Bahurakshaa preprocessing",
    category: "training",
    stage: "training",
    status: "derived",
    script: "scripts/05_preprocess.py",
    artifact: "data/training/flood_training.csv, data/training/landslide_training.csv",
    description: "Preprocessed feature tables with positive events and sampled negative examples.",
    features: ["time split", "event labels", "feature alignment", "quality checks"],
    icon: Table2,
  },
  {
    slug: "hazard-models",
    name: "Flood and Landslide Models",
    provider: "Bahurakshaa ML pipeline",
    category: "ml",
    stage: "model",
    status: "trained",
    script: "scripts/06_train_models.py",
    artifact: "models/flood_model.pkl, models/landslide_model.pkl",
    description: "Selected XGBoost classifiers trained with validation-selected operational thresholds.",
    features: ["XGBoost", "time-based split", "threshold tuning", "model metrics"],
    icon: Brain,
  },
  {
    slug: "supabase-operational",
    name: "Supabase Operational Tables",
    provider: "Supabase",
    category: "operations",
    stage: "operational",
    status: "active",
    description: "Runtime tables powering dashboards, alerts, river stations, forecasts, reports, and scenes.",
    features: ["alerts", "risk_zones", "river_stations", "rainfall_forecasts", "citizen_reports"],
    icon: Database,
  },
  {
    slug: "hecras-routing",
    name: "HEC-RAS Routing Contract",
    provider: "Bahurakshaa synthetic routing adapter",
    category: "hydraulic model",
    stage: "operational",
    status: "fallback",
    script: "scripts/parse_hecras.py",
    artifact: "data/raw/sample_river.hdf",
    description: "Prepared adapter for HEC-RAS-style station routing, currently backed by scenario data when live outputs are absent.",
    features: ["arrival time", "peak stage", "station risk", "routing scenario"],
    icon: Route,
  },
];

const modelCards = [
  {
    name: "Flood XGBoost",
    threshold: "0.30",
    rows: "373 rows",
    split: "train <= 2022, val 2023-2024, test >= 2025",
    metrics: [
      ["ROC-AUC", "0.9940"],
      ["PR-AUC", "0.9891"],
      ["F1", "0.9412"],
      ["Accuracy", "0.9574"],
    ],
    features: ["rf_3day", "rf_7day", "soil_moisture_index", "elevation_m"],
  },
  {
    name: "Landslide XGBoost",
    threshold: "0.43",
    rows: "544 rows",
    split: "train <= 2022, val 2023-2024, test >= 2025",
    metrics: [
      ["ROC-AUC", "0.9875"],
      ["PR-AUC", "0.9821"],
      ["F1", "0.9412"],
      ["Accuracy", "0.9592"],
    ],
    features: ["rf_3day", "rf_30day", "curvature", "elevation_m"],
  },
];

const stageOrder = ["raw", "feature", "training", "model", "operational"] as const;

export default function DataSourcesPage() {
  const { data: sources = [] } = useQuery({
    queryKey: ["data-sources"],
    queryFn: fetchDataSources,
  });
  const { data: satelliteProducts = [] } = useQuery({
    queryKey: ["satellite-products", "data-sources"],
    queryFn: fetchSatelliteProducts,
  });
  const { data: sentinelScenes = [] } = useQuery({
    queryKey: ["sentinel-scenes", "latest"],
    queryFn: () => fetchLatestSentinelScenes(12),
  });

  const runtimeSourceBySlug = useMemo(() => {
    return new Map(sources.map((source) => [source.slug, source]));
  }, [sources]);

  const groupedSources = useMemo(() => {
    return stageOrder.map((stage) => ({
      stage,
      sources: pipelineSources.filter((source) => source.stage === stage),
    }));
  }, []);

  const latestSatelliteUpdate =
    sentinelScenes[0]?.sceneDatetime ??
    satelliteProducts[0]?.observedAt ??
    sources.find((source) => source.category === "satellite")?.lastUpdated;

  const collectedCount = pipelineSources.filter((source) =>
    ["collected", "active", "trained", "derived"].includes(source.status),
  ).length;

  return (
    <AppLayout>
      <div className="space-y-5 p-4 md:p-6 lg:p-8">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ocean-400/15">
              <Database className="h-5 w-5 text-ocean-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Data Sources and Model Pipeline
              </h1>
              <p className="text-sm text-muted-foreground">
                Current collection state from the local scripts, model artifacts, and Supabase runtime tables.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <Metric label="Sources" value={pipelineSources.length} />
            <Metric label="Ready" value={collectedCount} />
            <Metric label="Scenes" value={sentinelScenes.length} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Active Pipeline</h2>
              <p className="text-xs text-muted-foreground">
                BIPAD labels plus satellite, hydro-meteorological, terrain, and land-cover predictors feed the trained hazard models.
              </p>
            </div>
            {latestSatelliteUpdate && (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                Latest satellite: {new Date(latestSatelliteUpdate).toLocaleString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            {[
              ["Raw Data", Users],
              ["Feature Engineering", GitBranch],
              ["Training Tables", Table2],
              ["ML Models", Brain],
              ["Operational UI", ShieldCheck],
            ].map(([label, Icon], index) => {
              const StepIcon = Icon as LucideIcon;
              return (
                <div key={label as string} className="relative rounded-lg border border-border/70 bg-secondary/20 p-3">
                  <div className="flex items-center gap-2">
                    <StepIcon className="h-4 w-4 text-ocean-400" />
                    <span className="text-xs font-semibold text-foreground">{label}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Step {index + 1}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {groupedSources.map((group) => (
            <section key={group.stage} className="space-y-3">
              <div className="flex items-center gap-2">
                <StageIcon stage={group.stage} />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {stageLabel(group.stage)}
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {group.sources.map((source) => {
                  const runtime = runtimeSourceBySlug.get(source.slug);
                  const Icon = source.icon;

                  return (
                    <article key={source.slug} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">{source.name}</h3>
                              <p className="mt-1 text-xs text-muted-foreground">{source.provider}</p>
                            </div>
                            <StatusBadge status={runtime?.status ?? source.status} />
                          </div>

                          <p className="mt-3 text-sm leading-6 text-muted-foreground">{source.description}</p>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {source.features.map((feature) => (
                              <span key={feature} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                                {feature}
                              </span>
                            ))}
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-2">
                            {source.script && (
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <FileCheck2 className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{source.script}</span>
                              </span>
                            )}
                            {source.artifact && (
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <Database className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{source.artifact}</span>
                              </span>
                            )}
                            {runtime?.lastUpdated && (
                              <span className="inline-flex min-w-0 items-center gap-1">
                                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-risk-safe" />
                                <span className="truncate">Runtime: {new Date(runtime.lastUpdated).toLocaleString()}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-ocean-400" />
            <h2 className="text-sm font-semibold text-foreground">Current Model Artifacts</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {modelCards.map((model) => (
              <div key={model.name} className="rounded-lg border border-border/70 bg-secondary/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{model.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Threshold {model.threshold} | {model.rows}
                    </p>
                  </div>
                  <StatusBadge status="trained" />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{model.split}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {model.metrics.map(([label, value]) => (
                    <div key={label} className="rounded-md bg-background p-2">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-sm font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {model.features.map((feature) => (
                    <span key={feature} className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Latest Sentinel Scene Records</h2>
              <p className="text-xs text-muted-foreground">
                Runtime records from Supabase `sentinel_scenes`, separate from the training SAR CSV.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{sentinelScenes.length} recent scenes</span>
          </div>

          <div className="space-y-3">
            {sentinelScenes.length === 0 ? (
              <p className="rounded-lg border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                No ingested Sentinel scene records found in Supabase yet.
              </p>
            ) : (
              sentinelScenes.map((scene) => (
                <div key={scene.id} className="rounded-lg border border-border/70 bg-secondary/20 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">{scene.collection}</h3>
                      <p className="mt-1 truncate text-xs text-muted-foreground">Scene ID: {scene.sceneId}</p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(scene.sceneDatetime).toLocaleString()}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Use case: {scene.useCase}</span>
                    {scene.platform && <span>Platform: {scene.platform}</span>}
                    {scene.instrumentMode && <span>Mode: {scene.instrumentMode}</span>}
                    {scene.orbitState && <span>Orbit: {scene.orbitState}</span>}
                    {scene.cloudCover !== null && <span>Cloud cover: {scene.cloudCover}%</span>}
                    {scene.mgrsTile && <span>Tile: {scene.mgrsTile}</span>}
                  </div>

                  {scene.stacItemUrl && (
                    <a
                      href={scene.stacItemUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <LinkIcon className="h-3 w-3" />
                      View STAC item
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const active = ["active", "collected", "trained", "derived"].includes(normalized);
  const fallback = normalized === "fallback";

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        active && "bg-risk-safe/15 text-risk-safe",
        fallback && "bg-risk-watch/15 text-risk-watch",
        !active && !fallback && "bg-secondary text-muted-foreground",
      )}
    >
      {active ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {status}
    </span>
  );
}

function StageIcon({ stage }: { stage: PipelineSource["stage"] }) {
  const Icon =
    stage === "raw"
      ? Database
      : stage === "feature"
        ? GitBranch
        : stage === "training"
          ? Table2
          : stage === "model"
            ? Brain
            : ShieldCheck;
  return <Icon className="h-4 w-4 text-ocean-400" />;
}

function stageLabel(stage: PipelineSource["stage"]) {
  if (stage === "raw") return "Raw Collection";
  if (stage === "feature") return "Feature Sources";
  if (stage === "training") return "Training Assembly";
  if (stage === "model") return "Model Artifacts";
  return "Operational Runtime";
}
