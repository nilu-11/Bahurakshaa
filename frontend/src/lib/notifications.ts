import { toast } from "sonner";

export type NotifyPayload = {
  id: string;
  title: string;
  body: string;
  severity: "safe" | "watch" | "warning" | "evacuate";
};

const STORAGE_KEY = "bahuraksha_notified_alert_ids";

function readNotifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeNotifiedIds(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // no-op for storage failures
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

function notifyBrowser(payload: NotifyPayload) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(payload.title, { body: payload.body });
}

function notifyInApp(payload: NotifyPayload) {
  const prefix =
    payload.severity === "evacuate"
      ? "Critical alert"
      : payload.severity === "warning"
        ? "Warning alert"
        : "New alert";
  toast(`${prefix}: ${payload.title}`, {
    description: payload.body,
  });
}

export function emitAlertNotifications(alerts: NotifyPayload[]) {
  const notified = readNotifiedIds();
  const fresh = alerts.filter((a) => !notified.has(a.id));
  if (fresh.length === 0) return;

  for (const a of fresh) {
    notifyInApp(a);
    notifyBrowser(a);
    notified.add(a.id);
  }
  writeNotifiedIds(notified);
}
