export function drawGrid(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  canvas: HTMLCanvasElement,
  spacingPx = 50
) {
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  const cs = getComputedStyle(document.documentElement);
  const grid =
    cs.getPropertyValue("--planner-grid").trim() || "rgba(255,255,255,0.06)";
  ctx.save();
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += spacingPx) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += spacingPx) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}
