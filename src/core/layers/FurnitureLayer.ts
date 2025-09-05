import type { Furniture } from "../../models/Furniture";
import type { Room } from "../../models/Room";

export class FurnitureLayer {
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
  private panel: HTMLDivElement | null = null;
  private inpW: HTMLInputElement | null = null;
  private inpH: HTMLInputElement | null = null;
  private inpLabel: HTMLInputElement | null = null;

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
        const it = room?.furniture.find((b) => b.id === this.selectedId);
        if (it) {
          const prev = { xM: it.xM, yM: it.yM, rot: it.rotationRad };
          it.rotationRad = (it.rotationRad + Math.PI / 2) % (Math.PI * 2);
          room!.clampFurniture(it);
          if (room!.furnitureIntersectsAnyBed(it)) {
            it.xM = prev.xM;
            it.yM = prev.yM;
            it.rotationRad = prev.rot;
          } else {
            this.lastSafe[it.id] = {
              xM: it.xM,
              yM: it.yM,
              rot: it.rotationRad,
            };
          }
          this.requestRender();
        }
      }
    });

    // Overlay controls
    this.panel = document.getElementById(
      "furniture-panel"
    ) as HTMLDivElement | null;
    this.inpW = document.getElementById(
      "furn-width"
    ) as HTMLInputElement | null;
    this.inpH = document.getElementById(
      "furn-height"
    ) as HTMLInputElement | null;
    this.inpLabel = document.getElementById(
      "furn-label"
    ) as HTMLInputElement | null;
    this.inpW?.addEventListener("input", () => this.applyFromInputs());
    this.inpH?.addEventListener("input", () => this.applyFromInputs());
    this.inpLabel?.addEventListener("input", () => this.applyFromInputs());
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
    for (const it of room.furniture) this.drawItem(it);
    if (this.selectedId) this.updateOverlay();
    else this.hideOverlay();
  }

  private drawItem(it: Furniture) {
    const scale = this.getScale();
    const cs = getComputedStyle(document.documentElement);
    const fill =
      cs.getPropertyValue("--planner-furniture-fill").trim() || "#cbd5e1";
    const strokeSel =
      cs.getPropertyValue("--planner-accent").trim() || "#f59e0b";
    const stroke =
      cs.getPropertyValue("--planner-furniture-stroke").trim() || "#334155";
    const label = cs.getPropertyValue("--planner-label").trim() || "#0f172a";
    const TWO_PI = Math.PI * 2;
    const rot = ((it.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4;
    const isPortrait = step % 2 === 1;
    const baseW = (isPortrait ? it.heightM : it.widthM) * scale;
    const baseH = (isPortrait ? it.widthM : it.heightM) * scale;
    const w = it.widthM * scale;
    const h = it.heightM * scale;
    const cx = this.originX + this.wallPx + (it.xM * scale + baseW / 2);
    const cy = this.originY + this.wallPx + (it.yM * scale + baseH / 2);
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(it.rotationRad);
    this.ctx.translate(-w / 2, -h / 2);

    this.ctx.fillStyle = fill;
    this.ctx.strokeStyle = this.selectedId === it.id ? strokeSel : stroke;
    this.ctx.lineWidth = 2;
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.strokeRect(0, 0, w, h);

    // Centered label
    this.ctx.fillStyle = label;
    this.ctx.font =
      "12px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(it.label, w / 2, h / 2);

    this.ctx.restore();
  }

  private hitTest(px: number, py: number): string | null {
    const room = this.getRoom();
    if (!room) return null;
    const scale = this.getScale();
    for (const it of [...room.furniture].reverse()) {
      const TWO_PI = Math.PI * 2;
      const rot = ((it.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
      const step = Math.round(rot / (Math.PI / 2)) % 4;
      const isPortrait = step % 2 === 1;
      const baseW = (isPortrait ? it.heightM : it.widthM) * scale;
      const baseH = (isPortrait ? it.widthM : it.heightM) * scale;
      const w = it.widthM * scale;
      const h = it.heightM * scale;
      const cx = this.originX + this.wallPx + (it.xM * scale + baseW / 2);
      const cy = this.originY + this.wallPx + (it.yM * scale + baseH / 2);
      const dx = px - cx;
      const dy = py - cy;
      const cos = Math.cos(-it.rotationRad);
      const sin = Math.sin(-it.rotationRad);
      const lx = dx * cos - dy * sin + w / 2;
      const ly = dx * sin + dy * cos + h / 2;
      if (lx >= 0 && lx <= w && ly >= 0 && ly <= h) return it.id;
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
    const it = room.furniture.find((b) => b.id === id)!;
    this.lastSafe[id] = { xM: it.xM, yM: it.yM, rot: it.rotationRad };
    const TWO_PI = Math.PI * 2;
    const rot = ((it.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4;
    const isPortrait = step % 2 === 1;
    const baseW = (isPortrait ? it.heightM : it.widthM) * this.getScale();
    const baseH = (isPortrait ? it.widthM : it.heightM) * this.getScale();
    const cx =
      this.originX + this.wallPx + (it.xM * this.getScale() + baseW / 2);
    const cy =
      this.originY + this.wallPx + (it.yM * this.getScale() + baseH / 2);
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
    const it = room.furniture.find((b) => b.id === this.draggingId)!;
    const scale = this.getScale();

    const cx = px - this.dragDx;
    const cy = py - this.dragDy;
    const TWO_PI = Math.PI * 2;
    const rot = ((it.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4;
    const isPortrait = step % 2 === 1;
    const baseW = isPortrait ? it.heightM : it.widthM;
    const baseH = isPortrait ? it.widthM : it.heightM;
    it.xM = (cx - (this.originX + this.wallPx)) / scale - baseW / 2;
    it.yM = (cy - (this.originY + this.wallPx)) / scale - baseH / 2;

    // Snap to walls (use AABB)
    const snapPx = 10;
    const leftPx = this.originX + this.wallPx;
    const topPx = this.originY + this.wallPx;
    const rightPx = leftPx + this.innerPxW;
    const bottomPx = topPx + this.innerPxH;
    const bedLeftPx = leftPx + it.xM * scale;
    const bedTopPx = topPx + it.yM * scale;
    const bedRightPx = bedLeftPx + baseW * scale;
    const bedBottomPx = bedTopPx + baseH * scale;
    if (Math.abs(bedLeftPx - leftPx) < snapPx) it.xM = 0;
    if (Math.abs(bedTopPx - topPx) < snapPx) it.yM = 0;
    if (Math.abs(rightPx - bedRightPx) < snapPx)
      it.xM = Math.max(0, room.width - baseW);
    if (Math.abs(bottomPx - bedBottomPx) < snapPx)
      it.yM = Math.max(0, room.height - baseH);

    room.clampFurniture(it);
    if (room.furnitureIntersectsAnyBed(it)) {
      const safe = this.lastSafe[it.id];
      if (safe) {
        it.xM = safe.xM;
        it.yM = safe.yM;
        it.rotationRad = safe.rot;
      }
    } else {
      this.lastSafe[it.id] = { xM: it.xM, yM: it.yM, rot: it.rotationRad };
    }
    this.requestRender();
  }

  private onPointerUp() {
    this.draggingId = null;
  }

  private updateOverlay() {
    if (!this.panel) return;
    const room = this.getRoom();
    if (!room || !this.selectedId) return;
    const it = room.furniture.find((b) => b.id === this.selectedId);
    if (!it) return;
    const scale = this.getScale();
    const TWO_PI = Math.PI * 2;
    const rot = ((it.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4;
    const isPortrait = step % 2 === 1;
    const baseW = (isPortrait ? it.heightM : it.widthM) * scale;
    const baseH = (isPortrait ? it.widthM : it.heightM) * scale;
    const cx = this.originX + this.wallPx + (it.xM * scale + baseW / 2);
    const cy = this.originY + this.wallPx + (it.yM * scale + baseH / 2);
    const objLeft = cx - baseW / 2;
    const objRight = cx + baseW / 2;
    const objTop = cy - baseH / 2;
    const objBottom = cy + baseH / 2;
    const cw = this.canvas.width / window.devicePixelRatio;
    const ch = this.canvas.height / window.devicePixelRatio;
    const panel = this.panel;
    panel.style.display = "block";
    const rect = panel.getBoundingClientRect();
    const pw = rect.width || 200;
    const ph = rect.height || 100;
    const m = 10;
    let left = objRight + m;
    let top = objTop;
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
    left = Math.min(Math.max(0, left), Math.max(0, cw - pw));
    top = Math.min(Math.max(0, top), Math.max(0, ch - ph));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    if (this.inpW) this.inpW.value = it.widthM.toFixed(2);
    if (this.inpH) this.inpH.value = it.heightM.toFixed(2);
    if (this.inpLabel) this.inpLabel.value = it.label;
  }

  private hideOverlay() {
    if (this.panel) this.panel.style.display = "none";
  }

  private applyFromInputs() {
    const room = this.getRoom();
    if (!room || !this.selectedId) return;
    const it = room.furniture.find((b) => b.id === this.selectedId);
    if (!it) return;
    const prev = { w: it.widthM, h: it.heightM, x: it.xM, y: it.yM };
    const w = parseFloat(this.inpW?.value || "");
    const h = parseFloat(this.inpH?.value || "");
    if (isFinite(w) && w > 0.2) it.widthM = w;
    if (isFinite(h) && h > 0.2) it.heightM = h;
    if (this.inpLabel) it.label = this.inpLabel.value || "";
    room.clampFurniture(it);
    if (room.furnitureIntersectsAnyBed(it)) {
      it.widthM = prev.w;
      it.heightM = prev.h;
      it.xM = prev.x;
      it.yM = prev.y;
      room.clampFurniture(it);
    }
    this.requestRender();
  }
}
