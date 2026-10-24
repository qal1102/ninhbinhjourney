import * as maplibregl from "maplibre-gl";

// MapLibre 6 tìm worker cạnh tệp JS của nó; sau khi đóng gói thì tệp ấy không
// có ở đó (404, bản đồ trống). Chỉ thẳng cho bộ đóng gói phát hành tệp worker.
// Worker cùng nguồn trang nên CSP `worker-src 'self'` cho chạy.
maplibregl.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

export { maplibregl };
