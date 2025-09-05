import type { Room } from "../../models/Room";
import type { RoomMetrics } from "../utils/metrics";

export function drawWalls(
  ctx: CanvasRenderingContext2D,
  room: Room,
  m: RoomMetrics
) {
  const {
    innerPxW,
    innerPxH,
    wallPx,
    outerPxW,
    outerPxH,
    originX: x,
    originY: y,
  } = m;
  const cs = getComputedStyle(document.documentElement);
  const wallFill =
    cs.getPropertyValue("--planner-wall-fill").trim() || "#1f2430";
  const roomOutline =
    cs.getPropertyValue("--planner-room-outline").trim() || "#7aa2ff";
  const label =
    cs.getPropertyValue("--planner-label").trim() || "rgba(255,255,255,0.8)";
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;

  ctx.fillStyle = wallFill;
  ctx.beginPath();
  ctx.rect(x, y, outerPxW, outerPxH);
  ctx.moveTo(x + wallPx, y + wallPx);
  ctx.rect(
    x + wallPx,
    y + wallPx,
    Math.max(0, innerPxW),
    Math.max(0, innerPxH)
  );
  ctx.fill("evenodd");

  ctx.shadowColor = "transparent";
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, outerPxW, outerPxH);
  ctx.moveTo(x + wallPx, y + wallPx);
  ctx.rect(
    x + wallPx,
    y + wallPx,
    Math.max(0, innerPxW),
    Math.max(0, innerPxH)
  );
  ctx.clip("evenodd");
  ctx.lineWidth = 2;
  ctx.strokeStyle = roomOutline;
  ctx.strokeRect(x + wallPx, y + wallPx, innerPxW, innerPxH);
  ctx.restore();

  // labels
  ctx.fillStyle = label;
  ctx.font =
    "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${room.width.toFixed(2)} m (inner)`, x + outerPxW / 2, y - 12);
  ctx.save();
  ctx.translate(x - 16, y + outerPxH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${room.height.toFixed(2)} m (inner)`, 0, 0);
  ctx.restore();

  ctx.restore();
}
