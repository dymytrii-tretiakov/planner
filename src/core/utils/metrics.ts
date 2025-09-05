export type RoomMetrics = {
  innerPxW: number;
  innerPxH: number;
  wallPx: number;
  outerPxW: number;
  outerPxH: number;
  originX: number;
  originY: number;
};

export function computeRoomMetrics(
  room: { width: number; height: number; wallThicknessM: number },
  scale: number,
  canvas: HTMLCanvasElement,
  dpr: number
): RoomMetrics {
  const innerPxW = room.width * scale;
  const innerPxH = room.height * scale;
  const wallPx = Math.max(1, room.wallThicknessM * scale);
  const outerPxW = innerPxW + wallPx * 2;
  const outerPxH = innerPxH + wallPx * 2;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const originX = (w - outerPxW) / 2;
  const originY = (h - outerPxH) / 2;
  return { innerPxW, innerPxH, wallPx, outerPxW, outerPxH, originX, originY };
}
