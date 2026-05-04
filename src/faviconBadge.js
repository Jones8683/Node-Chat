let faviconLink = null;
let originalSrc = "/favicon.png";

export function initBadge() {
  faviconLink = document.querySelector('link[rel="icon"]');
  if (!faviconLink) {
    faviconLink = document.createElement("link");
    faviconLink.rel = "icon";
    document.head.appendChild(faviconLink);
  }
  faviconLink.href = originalSrc;
}

export function updateBadge(unreadCount) {
  if (!faviconLink) initBadge();
  if (unreadCount === 0) return;

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  const img = new Image();
  img.src = originalSrc;
  img.onload = () => {
    ctx.drawImage(img, 0, 0, 128, 128);
    ctx.fillStyle = "#3B82F6";
    ctx.beginPath();
    ctx.arc(107, 21, 20, 0, Math.PI * 2);
    ctx.fill();
    faviconLink.href = canvas.toDataURL("image/png");
  };
}

export function clearBadge() {
  if (faviconLink) faviconLink.href = originalSrc;
}
