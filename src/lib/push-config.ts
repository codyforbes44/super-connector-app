/** VAPID public key — safe to ship to the browser. */
export const VAPID_PUBLIC_KEY =
  "BAb4dbZZqBj6KgVhT5CS3I8n9iEn9iYuW3AS2JVcChc-TbuNZtXGV0HxoSEoagM_M_XblQEgUXUrCdZQrCJ9DRw";

/**
 * In production the offline worker at /sw.js importScripts()s push-sw.js, so a
 * single root-scope registration handles both offline and push (and existing
 * push subscriptions carry over). Dev/preview never register /sw.js, so push
 * testing keeps using the standalone messaging worker.
 */
export const PUSH_SW_URL: string = import.meta.env.PROD ? "/sw.js" : "/push-sw.js";