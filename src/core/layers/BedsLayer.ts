import type { Bed } from "../../models/Bed";
import type { Room } from "../../models/Room";

export class BedsLayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private getScale: () => number;
  private getRoom: () => Room | null;
  private requestRender: () => void;
  private originX = 0;
  private originY = 0;
  private innerPxW = 0;
  private innerPxH = 0;
  private wallPx = 0;
  private selectedId: string | null = null;
  private draggingId: string | null = null;
  private dragDx = 0;
  private dragDy = 0;
  private lastSafe: Record<string, { xM: number; yM: number; rot: number }> =
    {};
  // Overlay
  private bedPanel: HTMLDivElement | null = null;
  private inpW: HTMLInputElement | null = null;
  private inpH: HTMLInputElement | null = null;
  private cbLeft: HTMLInputElement | null = null;
  private cbRight: HTMLInputElement | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    getScale: () => number,
    getRoom: () => Room | null,
    requestRender: () => void
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.getScale = getScale;
    this.getRoom = getRoom;
    this.requestRender = requestRender;

    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", () => this.onPointerUp());

    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "r" && this.selectedId) {
        const room = this.getRoom();
        const bed = room?.beds.find((b) => b.id === this.selectedId);
        if (bed) {
          // rotate 90 degrees
          const prev = { xM: bed.xM, yM: bed.yM, rot: bed.rotationRad };
          bed.rotationRad = (bed.rotationRad + Math.PI / 2) % (Math.PI * 2);
          room!.clampBed(bed);
          if (room!.bedIntersectsAnyFurniture(bed)) {
            // revert
            bed.xM = prev.xM;
            bed.yM = prev.yM;
            bed.rotationRad = prev.rot;
          } else {
            this.lastSafe[bed.id] = {
              xM: bed.xM,
              yM: bed.yM,
              rot: bed.rotationRad,
            };
          }
          this.requestRender();
        }
      }
    });

    // Overlay controls
    this.bedPanel = document.getElementById(
      "bed-panel"
    ) as HTMLDivElement | null;
    this.inpW = document.getElementById("bed-width") as HTMLInputElement | null;
    this.inpH = document.getElementById(
      "bed-height"
    ) as HTMLInputElement | null;
    this.cbLeft = document.getElementById(
      "bed-ns-left"
    ) as HTMLInputElement | null;
    this.cbRight = document.getElementById(
      "bed-ns-right"
    ) as HTMLInputElement | null;

    this.inpW?.addEventListener("input", () => this.applyDimFromInputs());
    this.inpH?.addEventListener("input", () => this.applyDimFromInputs());
    this.cbLeft?.addEventListener("change", () => this.applyNsFromInputs());
    this.cbRight?.addEventListener("change", () => this.applyNsFromInputs());
  }

  public draw(
    originX: number,
    originY: number,
    innerPxW: number,
    innerPxH: number,
    wallPx: number
  ) {
    this.originX = originX;
    this.originY = originY;
    this.innerPxW = innerPxW;
    this.innerPxH = innerPxH;
    this.wallPx = wallPx;
    const room = this.getRoom();
    if (!room) return;
    for (const bed of room.beds) this.drawBed(bed);

    // Update overlay panel for selected bed
    if (this.selectedId) this.updateOverlayPositionAndValues();
    else this.hideOverlay();
  }

  private drawBed(bed: Bed) {
    const scale = this.getScale();
    const cs = getComputedStyle(document.documentElement);
    const bedFill =
      cs.getPropertyValue("--planner-bed-fill").trim() || "#e2e8f0";
    const pillowFill =
      cs.getPropertyValue("--planner-pillow-fill").trim() || "#ffffff";
    const pillowStroke =
      cs.getPropertyValue("--planner-pillow-stroke").trim() || "#94a3b8";
    const nsFill = cs.getPropertyValue("--planner-ns-fill").trim() || "#f1f5f9";
    const nsStroke =
      cs.getPropertyValue("--planner-ns-stroke").trim() || "#64748b";
    const selection =
      cs.getPropertyValue("--planner-accent").trim() || "#f59e0b";
    // rotated AABB dims
    const TWO_PI = Math.PI * 2;
    const rot = ((bed.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4;
    const isPortrait = step % 2 === 1;
    const baseW = (isPortrait ? bed.heightM : bed.widthM) * scale;
    const baseH = (isPortrait ? bed.widthM : bed.heightM) * scale;
    const w = bed.widthM * scale;
    const h = bed.heightM * scale;
    // bed.xM/yM represent top-left of rotated AABB
    const cx = this.originX + this.wallPx + (bed.xM * scale + baseW / 2);
    const cy = this.originY + this.wallPx + (bed.yM * scale + baseH / 2);
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(bed.rotationRad);
    this.ctx.translate(-w / 2, -h / 2);

    // body
    this.ctx.fillStyle = bedFill; // themed
    this.ctx.strokeStyle = this.selectedId === bed.id ? selection : "#334155";
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.strokeRect(0, 0, w, h);

    // pillow (always near head, i.e., y=0 in local bed space before rotation)
    const pillowH = Math.min(0.25 * h, 0.35 * h);
    this.ctx.fillStyle = pillowFill;
    this.ctx.fillRect(4, 4, w - 8, pillowH - 8);
    this.ctx.strokeStyle = pillowStroke;
    this.ctx.strokeRect(4, 4, w - 8, pillowH - 8);

    // nightstands (bedside tables) on left/right, top-aligned to bed top edge
    const nsSize = bed.nightstandSizeM * scale;
    this.ctx.fillStyle = nsFill;
    this.ctx.strokeStyle = nsStroke;
    if (bed.nightstandLeft) {
      this.ctx.fillRect(-nsSize, 0, nsSize, nsSize);
      this.ctx.strokeRect(-nsSize, 0, nsSize, nsSize);
    }
    if (bed.nightstandRight) {
      this.ctx.fillRect(w, 0, nsSize, nsSize);
      this.ctx.strokeRect(w, 0, nsSize, nsSize);
    }

    this.ctx.restore();
  }

  private hitTest(px: number, py: number): string | null {
    const room = this.getRoom();
    if (!room) return null;
    const scale = this.getScale();
    for (const bed of [...room.beds].reverse()) {
      // transform point into bed local space
      const TWO_PI = Math.PI * 2;
      const rot = ((bed.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
      const step = Math.round(rot / (Math.PI / 2)) % 4;
      const isPortrait = step % 2 === 1;
      const baseW = (isPortrait ? bed.heightM : bed.widthM) * scale;
      const baseH = (isPortrait ? bed.widthM : bed.heightM) * scale;
      const w = bed.widthM * scale;
      const h = bed.heightM * scale;
      const cx = this.originX + this.wallPx + (bed.xM * scale + baseW / 2);
      const cy = this.originY + this.wallPx + (bed.yM * scale + baseH / 2);
      const dx = px - cx;
      const dy = py - cy;
      const cos = Math.cos(-bed.rotationRad);
      const sin = Math.sin(-bed.rotationRad);
      const lx = dx * cos - dy * sin + w / 2;
      const ly = dx * sin + dy * cos + h / 2;
      if (lx >= 0 && lx <= w && ly >= 0 && ly <= h) return bed.id;
    }
    return null;
  }

  private onPointerDown(e: PointerEvent) {
    const room = this.getRoom();
    if (!room) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const id = this.hitTest(px, py);
    if (!id) {
      this.selectedId = null;
      this.requestRender();
      return;
    }
    this.selectedId = id;
    this.draggingId = id;
    const scale = this.getScale();
    const bed = room.beds.find((b) => b.id === id)!;
    this.lastSafe[id] = { xM: bed.xM, yM: bed.yM, rot: bed.rotationRad };
    const TWO_PI = Math.PI * 2;
    const rot = ((bed.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4;
    const isPortrait = step % 2 === 1;
    const baseW = (isPortrait ? bed.heightM : bed.widthM) * scale;
    const baseH = (isPortrait ? bed.widthM : bed.heightM) * scale;
    // compute center from rotated AABB top-left
    const cx = this.originX + this.wallPx + (bed.xM * scale + baseW / 2);
    const cy = this.originY + this.wallPx + (bed.yM * scale + baseH / 2);
    this.dragDx = px - cx;
    this.dragDy = py - cy;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    this.requestRender();
  }

  private onPointerMove(e: PointerEvent) {
    const room = this.getRoom();
    if (!room || !this.draggingId) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const bed = room.beds.find((b) => b.id === this.draggingId)!;
    const scale = this.getScale();

    // Translate pointer center offset back to bed center, then to top-left in meters
    const cx = px - this.dragDx;
    const cy = py - this.dragDy;
    const TWO_PI = Math.PI * 2;
    const rot = ((bed.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4; // 0..3
    const isPortrait = step % 2 === 1;
    const baseW = isPortrait ? bed.heightM : bed.widthM;
    const baseH = isPortrait ? bed.widthM : bed.heightM;
    // set bed top-left from center without nightstand extras (extras handled by AABB during snap/clamp)
    bed.xM = (cx - (this.originX + this.wallPx)) / scale - baseW / 2;
    bed.yM = (cy - (this.originY + this.wallPx)) / scale - baseH / 2;

    // Snap to walls when near (magnet)
    const snapPx = 10; // threshold in pixels
    const leftPx = this.originX + this.wallPx;
    const topPx = this.originY + this.wallPx;
    const rightPx = leftPx + this.innerPxW;
    const bottomPx = topPx + this.innerPxH;
    const ns = bed.nightstandSizeM;
    // offsets of AABB relative to bed body depending on rotation
    // local-left/right nightstands extend on X in local bed space and map to world sides by rotation
    const off = { left: 0, right: 0, top: 0, bottom: 0 } as Record<
      "left" | "right" | "top" | "bottom",
      number
    >;
    if (step === 0) {
      if (bed.nightstandLeft) off.left = -ns;
      if (bed.nightstandRight) off.right = ns;
    } else if (step === 1) {
      if (bed.nightstandLeft) off.top = -ns;
      if (bed.nightstandRight) off.bottom = ns;
    } else if (step === 2) {
      if (bed.nightstandLeft) off.right = ns;
      if (bed.nightstandRight) off.left = -ns;
    } else if (step === 3) {
      if (bed.nightstandLeft) off.bottom = ns;
      if (bed.nightstandRight) off.top = -ns;
    }

    const bedLeftPx = leftPx + (bed.xM + off.left) * scale;
    const bedTopPx = topPx + (bed.yM + off.top) * scale;
    const bedRightPx = leftPx + (bed.xM + baseW + off.right) * scale;
    const bedBottomPx = topPx + (bed.yM + baseH + off.bottom) * scale;
    if (Math.abs(bedLeftPx - leftPx) < snapPx) bed.xM = -off.left;
    if (Math.abs(bedTopPx - topPx) < snapPx) bed.yM = -off.top;
    if (Math.abs(rightPx - bedRightPx) < snapPx)
      bed.xM = room.width - baseW - off.right;
    if (Math.abs(bottomPx - bedBottomPx) < snapPx)
      bed.yM = room.height - baseH - off.bottom;

    // Constrain inside room and prevent overlap with furniture
    room.clampBed(bed);
    if (room.bedIntersectsAnyFurniture(bed)) {
      const safe = this.lastSafe[bed.id];
      if (safe) {
        bed.xM = safe.xM;
        bed.yM = safe.yM;
        bed.rotationRad = safe.rot;
      }
    } else {
      this.lastSafe[bed.id] = { xM: bed.xM, yM: bed.yM, rot: bed.rotationRad };
    }
    this.requestRender();
  }

  private onPointerUp() {
    this.draggingId = null;
  }

  private updateOverlayPositionAndValues() {
    if (!this.bedPanel) return;
    const room = this.getRoom();
    if (!room || !this.selectedId) return;
    const bed = room.beds.find((b) => b.id === this.selectedId);
    if (!bed) return;
    const scale = this.getScale();
    // bed center in canvas px using rotated AABB dims
    const TWO_PI = Math.PI * 2;
    const rot = ((bed.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4;
    const isPortrait = step % 2 === 1;
    const baseW = (isPortrait ? bed.heightM : bed.widthM) * scale;
    const baseH = (isPortrait ? bed.widthM : bed.heightM) * scale;
    const cx = this.originX + this.wallPx + (bed.xM * scale + baseW / 2);
    const cy = this.originY + this.wallPx + (bed.yM * scale + baseH / 2);
    const objLeft = cx - baseW / 2;
    const objRight = cx + baseW / 2;
    const objTop = cy - baseH / 2;
    const objBottom = cy + baseH / 2;
    const cw = this.canvas.width / window.devicePixelRatio;
    const ch = this.canvas.height / window.devicePixelRatio;
    const panel = this.bedPanel;
    panel.style.display = "block";
    // measure panel
    const rect = panel.getBoundingClientRect();
    const pw = rect.width || 200;
    const ph = rect.height || 100;
    const m = 10;
    let left = objRight + m;
    let top = objTop;
    // choose side with most space
    const spaceRight = cw - (objRight + m) - pw;
    const spaceLeft = objLeft - m - pw;
    const spaceBelow = ch - (objBottom + m) - ph;
    const spaceAbove = objTop - m - ph;
    const options: Array<{ side: string; space: number }> = [
      { side: "right", space: spaceRight },
      { side: "left", space: spaceLeft },
      { side: "below", space: spaceBelow },
      { side: "above", space: spaceAbove },
    ].sort((a, b) => b.space - a.space);
    const best = options[0]?.side || "right";
    if (best === "left") {
      left = Math.max(0, objLeft - m - pw);
      top = objTop;
    } else if (best === "below") {
      left = objLeft;
      top = objBottom + m;
    } else if (best === "above") {
      left = objLeft;
      top = Math.max(0, objTop - m - ph);
    }
    // clamp
    left = Math.min(Math.max(0, left), Math.max(0, cw - pw));
    top = Math.min(Math.max(0, top), Math.max(0, ch - ph));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    if (this.inpW) this.inpW.value = bed.widthM.toFixed(2);
    if (this.inpH) this.inpH.value = bed.heightM.toFixed(2);
    if (this.cbLeft) this.cbLeft.checked = bed.nightstandLeft;
    if (this.cbRight) this.cbRight.checked = bed.nightstandRight;
    const ns = document.getElementById(
      "bed-ns-size"
    ) as HTMLInputElement | null;
    if (ns) ns.value = bed.nightstandSizeM.toFixed(2);
  }

  private hideOverlay() {
    if (this.bedPanel) this.bedPanel.style.display = "none";
  }

  private applyDimFromInputs() {
    const room = this.getRoom();
    if (!room || !this.selectedId) return;
    const bed = room.beds.find((b) => b.id === this.selectedId);
    if (!bed) return;
    const prev = { w: bed.widthM, h: bed.heightM, x: bed.xM, y: bed.yM };
    const w = parseFloat(this.inpW?.value || "");
    const h = parseFloat(this.inpH?.value || "");
    if (isFinite(w) && w > 0.5) bed.widthM = w;
    if (isFinite(h) && h > 0.5) bed.heightM = h;
    const ns = document.getElementById(
      "bed-ns-size"
    ) as HTMLInputElement | null;
    const nsv = parseFloat(ns?.value || "");
    if (isFinite(nsv) && nsv >= 0.2)
      room.beds.find((b) => b.id === this.selectedId)!.nightstandSizeM = nsv;
    room.clampBed(bed);
    if (room.bedIntersectsAnyFurniture(bed)) {
      bed.widthM = prev.w;
      bed.heightM = prev.h;
      bed.xM = prev.x;
      bed.yM = prev.y;
      room.clampBed(bed);
    }
    this.requestRender();
  }

  private applyNsFromInputs() {
    const room = this.getRoom();
    if (!room || !this.selectedId) return;
    const bed = room.beds.find((b) => b.id === this.selectedId);
    if (!bed) return;
    const prev = {
      l: bed.nightstandLeft,
      r: bed.nightstandRight,
      x: bed.xM,
      y: bed.yM,
    };
    bed.nightstandLeft = !!this.cbLeft?.checked;
    bed.nightstandRight = !!this.cbRight?.checked;
    room.clampBed(bed);
    if (room.bedIntersectsAnyFurniture(bed)) {
      bed.nightstandLeft = prev.l;
      bed.nightstandRight = prev.r;
      bed.xM = prev.x;
      bed.yM = prev.y;
      room.clampBed(bed);
      if (this.cbLeft) this.cbLeft.checked = bed.nightstandLeft;
      if (this.cbRight) this.cbRight.checked = bed.nightstandRight;
    }
    this.requestRender();
  }
}
