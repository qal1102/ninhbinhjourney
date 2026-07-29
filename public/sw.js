self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Ninh Bình Điều hành", {
      body: data.body || "Có cập nhật vận hành mới.",
      icon: data.icon || "/brand/pwa-192.png",
      badge: "/brand/pwa-192.png",
      data: { url: data.url || "/erp" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/erp";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(url));
      return existing ? existing.focus() : self.clients.openWindow(url);
    }),
  );
});
