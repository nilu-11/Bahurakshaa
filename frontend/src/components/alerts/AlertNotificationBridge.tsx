import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/useAuth";
import {
  emitAlertNotifications,
  requestBrowserNotificationPermission,
} from "@/lib/notifications";

type AlertRow = {
  id: string;
  type: "flood" | "landslide" | "glof";
  severity: "safe" | "watch" | "warning" | "evacuate";
  title: string;
  message: string;
  zone: string;
  created_at?: string;
  is_active: boolean;
};

const PERMISSION_PROMPT_KEY = "bahuraksha_notification_permission_requested";

export default function AlertNotificationBridge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: alerts = [] } = useQuery<AlertRow[]>({
    queryKey: ["global-alert-notifications"],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 1000 * 60,
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("global-alert-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["global-alert-notifications"] });
        queryClient.invalidateQueries({ queryKey: ["alerts"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(PERMISSION_PROMPT_KEY) === "true") return;

    localStorage.setItem(PERMISSION_PROMPT_KEY, "true");
    void requestBrowserNotificationPermission();
  }, [user]);

  useEffect(() => {
    if (!user || alerts.length === 0) return;

    const notificationRows = alerts
      .filter((alert) => alert.severity !== "safe")
      .map((alert) => ({
        id: [
          "db-alert",
          alert.id,
          alert.severity,
          alert.title,
          alert.message,
          alert.is_active ? "active" : "resolved",
        ].join(":"),
        title: alert.title,
        body: `${alert.zone} | ${alert.message}`,
        severity: alert.severity,
      }));

    emitAlertNotifications(notificationRows);
  }, [alerts, user]);

  return null;
}
