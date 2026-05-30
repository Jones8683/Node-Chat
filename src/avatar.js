export const OWNER_AVATAR_URL = "/owner.png";

const AVATAR_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
];

export function hashAvatarColor(name) {
  const safeName = name || "?";
  let hash = 0;
  for (let i = 0; i < safeName.length; i++) {
    hash = (hash << 5) - hash + safeName.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getAvatarInitial(name, uid, ownerUid) {
  if (ownerUid && uid === ownerUid) return "";
  return (name && name[0]?.toUpperCase()) || "?";
}

export function getAvatarColor(name, storedColor) {
  if (storedColor) return storedColor;
  return hashAvatarColor(name);
}

export function getAvatarStyle(name, uid, storedColor, ownerUid) {
  const color = getAvatarColor(name, storedColor);
  if (ownerUid && uid === ownerUid) {
    return {
      backgroundColor: color,
      backgroundImage: `url("${OWNER_AVATAR_URL}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  return { background: color };
}
