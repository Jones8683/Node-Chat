let faviconLink = null;
let originalSrc = "/favicon.png";
let cachedBaseImage = null;
let cachedBaseImagePromise = null;
let lastUnreadCount = 0;

export function initBadge() {
  faviconLink = document.querySelector('link[rel="icon"]');
  if (!faviconLink) {
    faviconLink = document.createElement("link");
    faviconLink.rel = "icon";
    document.head.appendChild(faviconLink);
  }
  if (faviconLink.getAttribute("href")) {
    originalSrc = faviconLink.getAttribute("href");
  } else {
    faviconLink.href = originalSrc;
  }
}

function loadBaseImage() {
  if (cachedBaseImage) return Promise.resolve(cachedBaseImage);
  if (cachedBaseImagePromise) return cachedBaseImagePromise;
  cachedBaseImagePromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      cachedBaseImage = img;
      resolve(img);
    };
    img.onerror = (err) => {
      cachedBaseImagePromise = null;
      reject(err);
    };
    img.src = originalSrc;
  });
  return cachedBaseImagePromise;
}

export function updateBadge(unreadCount) {
  if (!faviconLink) initBadge();
  if (!unreadCount || unreadCount <= 0) return;
  if (unreadCount === lastUnreadCount) return;
  lastUnreadCount = unreadCount;

  loadBaseImage()
    .then((img) => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 128, 128);
      ctx.fillStyle = "#3B82F6";
      ctx.beginPath();
      ctx.arc(107, 21, 20, 0, Math.PI * 2);
      ctx.fill();
      faviconLink.href = canvas.toDataURL("image/png");
    })
    .catch(() => {});
}

export function clearBadge() {
  lastUnreadCount = 0;
  if (faviconLink) faviconLink.href = originalSrc;
}
