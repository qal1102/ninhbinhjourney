self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Ninh Bình Điều hành", {
      body: data.body || "Có cập nhật vận hành mới.",
      icon: data.icon || "/brand/erp-192.png",
      badge: "/brand/erp-192.png",
      data: { url: data.url || "/erp" },
      // Báo khẩn cấp (12/10/2026): rung mạnh, giữ trên màn tới khi bấm, báo lại nếu cùng mã.
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      requireInteraction: Boolean(data.khanCap),
      vibrate: data.khanCap ? [500, 200, 500, 200, 1000, 300, 1000] : undefined,
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

/*
 * Dùng khi mất sóng (H3, 11/10/2026; học ứng dụng NPS tải trước cả công viên).
 * Chỉ vài trang khách cần lúc ở trong hang: tra vé, thuyết minh, hộ chiếu.
 * Trang: mạng trước, mất mạng thì lấy bản đã lưu. Tệp `/_next/static` có băm
 * trong tên nên lấy bản lưu trước. Không đụng tới ERP hay API nào.
 */
const KHO_TRANG = "nbj-ngoai-tuyen-trang-v1";
const KHO_TEP = "nbj-ngoai-tuyen-tep-v1";
const TRANG_LUU = ["/tra-cuu-ve", "/nghe", "/ho-so"];
const TOI_DA_TEP = 160;

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((ten) =>
      Promise.all(ten.filter((k) => k.startsWith("nbj-ngoai-tuyen-") && k !== KHO_TRANG && k !== KHO_TEP).map((k) => caches.delete(k))),
    ),
  );
});

async function gonKho(ten, toiDa) {
  const kho = await caches.open(ten);
  const khoa = await kho.keys();
  for (let i = 0; i < khoa.length - toiDa; i++) await kho.delete(khoa[i]);
}

self.addEventListener("fetch", (event) => {
  const yc = event.request;
  if (yc.method !== "GET") return;
  const url = new URL(yc.url);
  if (url.origin !== self.location.origin) return;

  if (yc.mode === "navigate" && TRANG_LUU.includes(url.pathname)) {
    event.respondWith(
      fetch(yc)
        .then((tl) => {
          if (tl.ok) {
            const ban = tl.clone();
            caches.open(KHO_TRANG).then((kho) => kho.put(url.pathname + url.search, ban));
          }
          return tl;
        })
        .catch(async () => {
          const kho = await caches.open(KHO_TRANG);
          return (await kho.match(url.pathname + url.search)) || (await kho.match(url.pathname)) || Response.error();
        }),
    );
    return;
  }

  const mayCucBo = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";
  if (url.pathname.startsWith("/_next/static/") && !mayCucBo) {
    event.respondWith(
      caches.open(KHO_TEP).then(async (kho) => {
        const da = await kho.match(yc);
        if (da) return da;
        const tl = await fetch(yc);
        if (tl.ok) {
          await kho.put(yc, tl.clone());
          gonKho(KHO_TEP, TOI_DA_TEP);
        }
        return tl;
      }),
    );
  }
});
