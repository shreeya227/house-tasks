import { api } from "./api";

/** iOS only allows notifications once the site has been added to the Home Screen. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function permission(): NotificationPermission | "unsupported" {
  return pushSupported() ? Notification.permission : "unsupported";
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Must be called from a real tap: iOS ignores a permission prompt triggered on page load.
 * @param vapidPublicKey the server's public key, returned when you joined
 */
export async function enableNotifications(vapidPublicKey: string): Promise<true> {
  if (!pushSupported()) throw new Error("This browser can't do notifications.");
  if (isIos() && !isStandalone()) {
    throw new Error("On iPhone, add this page to your Home Screen first, then open it from there.");
  }
  if (!vapidPublicKey) {
    throw new Error("Notifications aren't set up on the server yet. Switch person and pick your name again once they are.");
  }

  const result = await Notification.requestPermission();
  if (result !== "granted") throw new Error("Notifications were not allowed.");

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("The browser returned an incomplete subscription. Try again.");
  }
  await api.subscribePush({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth });
  return true;
}
