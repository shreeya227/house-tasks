import { api } from "./api.js";

/** iOS only allows notifications once the site has been added to the Home Screen. */
export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function permission() {
  return pushSupported() ? Notification.permission : "unsupported";
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js");
}

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Must be called from a real tap: iOS ignores a permission prompt triggered on page load.
 * @param vapidPublicKey the server's public key, returned when you joined
 */
export async function enableNotifications(vapidPublicKey) {
  if (!pushSupported()) throw new Error("This browser can't do notifications.");
  if (isIos() && !isStandalone()) {
    throw new Error("On iPhone, add this page to your Home Screen first, then open it from there.");
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
  await api.subscribePush({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  });
  return true;
}
