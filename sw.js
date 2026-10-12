// Recibe los avisos de Sophy (recordatorio de racha) y los muestra como notificación.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let aviso = {};
  try {
    aviso = e.data ? e.data.json() : {};
  } catch {}
  e.waitUntil(
    self.registration.showNotification(aviso.titulo || "Sophy", {
      body: aviso.texto || "",
      icon: "Sophya.png",
      badge: "Sophya.png",
      tag: "sophy-racha", // un aviso nuevo sustituye al anterior
    })
  );
});

// Al tocar el aviso se abre Sophy (o se trae al frente si ya estaba abierta).
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) =>
      ventanas.length ? ventanas[0].focus() : self.clients.openWindow(self.registration.scope)
    )
  );
});
