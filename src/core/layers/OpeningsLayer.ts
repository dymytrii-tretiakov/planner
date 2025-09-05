import type { WallSide } from "../../models/Opening";
import type { Room } from "../../models/Room";

type HitBox = {
  id: string;
  side: WallSide;
  x: number;
  y: number;
  w: number;
  h: number;
};

export class OpeningsLayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private getScale: () => number;
  private getDpr: () => number;
  private getRoom: () => Room | null;
  private requestRender: () => void;

  // Interaction state
  private openingsLayout: Map<string, HitBox[]> = new Map();
  private draggingId: string | null = null;
  private dragSide: WallSide | null = null;
  private dragOffsetToCursorPx = 0;
  private selectedId: string | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    getScale: () => number,
    getDpr: () => number,
    getRoom: () => Room | null,
    requestRender: () => void
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.getScale = getScale;
    this.getDpr = getDpr;
    this.getRoom = getRoom;
    this.requestRender = requestRender;

    // Pointer interactions
    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", () => this.onPointerUp());

    // Overlay input listeners (length editor)
    const input = document.getElementById(
      "opening-length"
    ) as HTMLInputElement | null;
    input?.addEventListener("input", () => this.onOverlayLengthInput());

    const doorOpen = document.getElementById(
      "door-open"
    ) as HTMLInputElement | null;
    doorOpen?.addEventListener("input", () => this.onOverlayDoorOpenInput());
    const doorHinge = document.getElementById(
      "door-hinge"
    ) as HTMLInputElement | null;
    doorHinge?.addEventListener("change", () => this.onOverlayDoorHinge());
    const mirrorH = document.getElementById(
      "door-mirror-h"
    ) as HTMLButtonElement | null;
    mirrorH?.addEventListener("click", (e) => {
      e.preventDefault();
      this.onOverlayDoorMirror("H");
    });
    const mirrorV = document.getElementById(
      "door-mirror-v"
    ) as HTMLButtonElement | null;
    mirrorV?.addEventListener("click", (e) => {
      e.preventDefault();
      this.onOverlayDoorMirror("V");
    });
  }

  public draw(
    originX: number,
    originY: number,
    innerPxW: number,
    innerPxH: number,
    wallPx: number
  ) {
    const room = this.getRoom();
    if (!room) return;
    const scale = this.getScale();
    const cs = getComputedStyle(document.documentElement);
    const doorFill =
      cs.getPropertyValue("--planner-door-fill").trim() || "#8b5cf61a";
    const doorStroke =
      cs.getPropertyValue("--planner-door-stroke").trim() || "#8b5cf6";
    const doorArc =
      cs.getPropertyValue("--planner-door-arc").trim() || "#8b5cf6aa";
    const winFill =
      cs.getPropertyValue("--planner-window-fill").trim() || "#60a5fa1a";
    const winStroke =
      cs.getPropertyValue("--planner-window-stroke").trim() || "#60a5fa";
    const sel = cs.getPropertyValue("--planner-accent").trim() || "#f59e0b";
    const hitBoxes: HitBox[] = [];

    for (const open of room.openings) {
      const lenPx = open.lengthM * scale;
      const t = open.offsetM * scale; // distance along wall
      const thickness = wallPx;
      let rx = 0,
        ry = 0,
        rw = 0,
        rh = 0;
      switch (open.wallSide) {
        case "N":
          rx = originX + wallPx + t;
          ry = originY;
          rw = lenPx;
          rh = thickness;
          break;
        case "S":
          rx = originX + wallPx + t;
          ry = originY + wallPx + innerPxH;
          rw = lenPx;
          rh = thickness;
          break;
        case "W":
          rx = originX;
          ry = originY + wallPx + t;
          rw = thickness;
          rh = lenPx;
          break;
        case "E":
          rx = originX + wallPx + innerPxW;
          ry = originY + wallPx + t;
          rw = thickness;
          rh = lenPx;
          break;
      }

      const { ctx } = this;
      ctx.save();
      ctx.fillStyle = open.type === "door" ? doorFill : winFill;
      ctx.strokeStyle = open.type === "door" ? doorStroke : winStroke;
      ctx.lineWidth = 2;
      const isSelected = this.selectedId === open.id;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = sel;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(rx - 2, ry - 2, rw + 4, rh + 4);
        ctx.restore();
      }
      // Door swing: draw leaf and arc
      if (open.type === "door") {
        const open01 = Math.max(0, Math.min(1, open.doorOpen01 ?? 0));
        const maxAngle = (170 * Math.PI) / 180; // 179 degrees max
        const angle = open01 * maxAngle; // 0..179deg
        // Hinge point, closed base orientation along wall, rotation sign opens into room
        let hx = 0,
          hy = 0,
          base = 0,
          s = 1;
        if (open.wallSide === "N") {
          // Top wall: interior is +Y (down)
          hx = open.doorHingeStart ? rx : rx + rw;
          hy = ry + rh;
          base = open.doorHingeStart ? 0 : Math.PI; // along +X or -X
          s = open.doorHingeStart ? 1 : -1; // rotate CW into room
          if (open.doorMirrorH) s *= -1;
        } else if (open.wallSide === "S") {
          // Bottom wall: interior is -Y (up)
          hx = open.doorHingeStart ? rx : rx + rw;
          hy = ry;
          base = open.doorHingeStart ? 0 : Math.PI;
          s = open.doorHingeStart ? -1 : 1; // rotate CCW into room
          if (open.doorMirrorH) s *= -1;
        } else if (open.wallSide === "W") {
          // Left wall: interior is +X (right)
          hx = rx + rw;
          hy = open.doorHingeStart ? ry : ry + rh;
          base = open.doorHingeStart ? Math.PI / 2 : -Math.PI / 2; // along +Y or -Y
          s = open.doorHingeStart ? -1 : 1; // rotate toward +X
          if (open.doorMirrorV) s *= -1;
        } else if (open.wallSide === "E") {
          // Right wall: interior is -X (left)
          hx = rx;
          hy = open.doorHingeStart ? ry : ry + rh;
          base = open.doorHingeStart ? Math.PI / 2 : -Math.PI / 2;
          s = open.doorHingeStart ? 1 : -1; // rotate toward -X
          if (open.doorMirrorV) s *= -1;
        }
        this.drawDoorLeafAndArc(hx, hy, lenPx, s * angle, base, {
          arc: doorArc,
          fill: doorFill,
          stroke: doorStroke,
        });
      }
      ctx.restore();

      hitBoxes.push({
        id: open.id,
        side: open.wallSide,
        x: rx,
        y: ry,
        w: rw,
        h: rh,
      });
    }

    const byId = new Map<string, HitBox[]>();
    for (const hb of hitBoxes) byId.set(hb.id, [hb]);
    this.openingsLayout = byId;

    // Update panel and dimensions if selection exists
    if (this.selectedId)
      this.updateOverlayAndDimensions(
        hitBoxes,
        originX,
        originY,
        innerPxW,
        innerPxH,
        wallPx
      );
    else this.hideOverlayAndDimensions();
  }

  private drawDoorLeafAndArc(
    hx: number,
    hy: number,
    leafLenPx: number,
    angle: number,
    baseAngle: number,
    theme?: { arc: string; fill: string; stroke: string }
  ) {
    const ctx = this.ctx;
    ctx.save();
    // Arc (semi-circle path from closed to open)
    const start = baseAngle;
    const end = baseAngle + angle;
    if (angle !== 0) {
      ctx.beginPath();
      ctx.strokeStyle = theme?.arc ?? "#8b5cf6aa";
      ctx.setLineDash([3, 3]);
      ctx.arc(hx, hy, leafLenPx, start, end, angle < 0);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Door leaf
    ctx.translate(hx, hy);
    ctx.rotate(end);
    ctx.fillStyle = theme?.fill ?? "#8b5cf633";
    ctx.strokeStyle = theme?.stroke ?? "#8b5cf6";
    ctx.lineWidth = 2;
    // draw a thin rectangle representing the leaf thickness (use wall thickness style ~6px)
    const leafTh = 6;
    ctx.beginPath();
    ctx.rect(0, -leafTh, leafLenPx, leafTh);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private updateOverlayAndDimensions(
    hitBoxes: HitBox[],
    x: number,
    y: number,
    innerPxW: number,
    innerPxH: number,
    wallPx: number
  ) {
    const room = this.getRoom();
    if (!room) return;
    const dpr = this.getDpr();
    const cs = getComputedStyle(document.documentElement);
    const dimColor = cs.getPropertyValue("--planner-dim").trim() || "#94a3b8";
    const item = hitBoxes.find((h) => h.id === this.selectedId!);
    const panel = document.getElementById(
      "opening-panel"
    ) as HTMLDivElement | null;
    const input = document.getElementById(
      "opening-length"
    ) as HTMLInputElement | null;
    const dimStart = document.getElementById(
      "dim-start-label"
    ) as HTMLDivElement | null;
    const dimEnd = document.getElementById(
      "dim-end-label"
    ) as HTMLDivElement | null;
    if (!item || !panel || !input || !dimStart || !dimEnd) return;

    // Place the panel adjacent to the opening rect (best available side)
    panel.style.display = "block";
    const cw = this.canvas.width / dpr;
    const ch = this.canvas.height / dpr;
    const panelRect = panel.getBoundingClientRect();
    const pw = panelRect.width || 220;
    const ph = panelRect.height || 120;
    const m = 10;
    const objLeft = item.x;
    const objRight = item.x + item.w;
    const objTop = item.y;
    const objBottom = item.y + item.h;
    let left = objRight + m;
    let top = objTop;
    const spaceRight = cw - (objRight + m) - pw;
    const spaceLeft = objLeft - m - pw;
    const spaceBelow = ch - (objBottom + m) - ph;
    const spaceAbove = objTop - m - ph;
    const options: Array<{
      side: "right" | "left" | "below" | "above";
      space: number;
    }> = [
      { side: "right" as const, space: spaceRight },
      { side: "left" as const, space: spaceLeft },
      { side: "below" as const, space: spaceBelow },
      { side: "above" as const, space: spaceAbove },
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
    // clamp to canvas bounds
    left = Math.min(Math.max(0, left), Math.max(0, cw - pw));
    top = Math.min(Math.max(0, top), Math.max(0, ch - ph));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;

    const opening = room.openings.find((o) => o.id === this.selectedId);
    if (opening) {
      input.value = opening.lengthM.toString();
      const title = document.getElementById("overlay-title");
      if (title)
        title.textContent = opening.type === "door" ? "Door" : "Window";
      // Setup door UI state
      const doorRow = document.getElementById("door-open")?.parentElement
        ?.parentElement as HTMLDivElement | undefined;
      const hingeRow = document.getElementById("door-hinge")?.parentElement
        ?.parentElement as HTMLDivElement | undefined;
      if (opening.type === "door") {
        const slider = document.getElementById(
          "door-open"
        ) as HTMLInputElement | null;
        const hinge = document.getElementById(
          "door-hinge"
        ) as HTMLInputElement | null;
        const mirrorRow =
          (document.getElementById("door-mirror-h")
            ?.parentElement as HTMLDivElement) || undefined;
        if (slider)
          slider.value = String(Math.round((opening.doorOpen01 ?? 0) * 100));
        if (hinge) hinge.checked = !!opening.doorHingeStart;
        if (doorRow) doorRow.style.display = "grid";
        if (hingeRow) hingeRow.style.display = "grid";
        if (mirrorRow) mirrorRow.style.display = "grid";
      } else {
        if (doorRow) doorRow.style.display = "none";
        if (hingeRow) hingeRow.style.display = "none";
        const mirrorRow =
          (document.getElementById("door-mirror-h")
            ?.parentElement as HTMLDivElement) || undefined;
        if (mirrorRow) mirrorRow.style.display = "none";
      }
    }

    if (!opening) return;

    const { ctx } = this;
    const scale = this.getScale();
    ctx.save();
    ctx.strokeStyle = dimColor;
    ctx.fillStyle = dimColor;
    ctx.lineWidth = 1.5;

    // Geometry helpers
    const isHoriz = item.w >= item.h; // N/S
    const isTop = item.y === y; // N
    const isLeft = item.x === x; // W

    const startX = isHoriz ? item.x : item.x + (isLeft ? wallPx : 0);
    const startY = isHoriz ? item.y + (isTop ? wallPx : 0) : item.y;
    const endX = isHoriz
      ? item.x + item.w
      : item.x + (isLeft ? wallPx : item.w);
    const endY = isHoriz ? item.y + (isTop ? wallPx : item.h) : item.y + item.h;

    const cornerAX = isHoriz ? x + wallPx : item.x;
    const cornerAY = isHoriz ? item.y + (isTop ? wallPx : 0) : y + wallPx;
    const cornerBX = isHoriz
      ? x + wallPx + innerPxW
      : item.x + (isLeft ? 0 : wallPx);
    const cornerBY = isHoriz
      ? item.y + (isTop ? wallPx : 0)
      : y + wallPx + innerPxH;

    const startDist = isHoriz ? startX - cornerAX : startY - cornerAY;
    const endDist = isHoriz ? cornerBX - endX : cornerBY - endY;

    const drawDim = (sx: number, sy: number, ex: number, ey: number) => {
      const vx = ex - sx;
      const vy = ey - sy;
      const len = Math.hypot(vx, vy) || 1;
      const ux = vx / len;
      const uy = vy / len;
      const nx = -uy;
      const ny = ux;
      const off = 12;
      const osx = sx + nx * off;
      const osy = sy + ny * off;
      const oex = ex + nx * off;
      const oey = ey + ny * off;
      this.ctx.beginPath();
      this.ctx.moveTo(osx, osy);
      this.ctx.lineTo(oex, oey);
      this.ctx.stroke();
      const ah = 6;
      const aw = 4;
      const drawHead = (bx: number, by: number, dir: number) => {
        const hx = bx - ux * ah * dir;
        const hy = by - uy * ah * dir;
        this.ctx.beginPath();
        this.ctx.moveTo(bx, by);
        this.ctx.lineTo(hx + ny * aw, hy - nx * aw);
        this.ctx.lineTo(hx - ny * aw, hy + nx * aw);
        this.ctx.closePath();
        this.ctx.fill();
      };
      drawHead(osx, osy, -1);
      drawHead(oex, oey, 1);
      return { mx: (osx + oex) / 2, my: (osy + oey) / 2 };
    };

    const mid1 = drawDim(
      isHoriz ? cornerAX : cornerAX,
      isHoriz ? cornerAY : cornerAY,
      isHoriz ? startX : startX,
      isHoriz ? startY : startY
    );
    const mid2 = drawDim(
      isHoriz ? endX : endX,
      isHoriz ? endY : endY,
      isHoriz ? cornerBX : cornerBX,
      isHoriz ? cornerBY : cornerBY
    );

    dimStart.style.display = "block";
    dimEnd.style.display = "block";
    dimStart.style.left = `${mid1.mx}px`;
    dimStart.style.top = `${mid1.my}px`;
    dimEnd.style.left = `${mid2.mx}px`;
    dimEnd.style.top = `${mid2.my}px`;
    dimStart.textContent = `${(startDist / scale).toFixed(2)} m`;
    dimEnd.textContent = `${(endDist / scale).toFixed(2)} m`;

    const makeEditable = (
      el: HTMLDivElement,
      initial: number,
      apply: (valM: number) => void
    ) => {
      el.onclick = (ev) => {
        ev.stopPropagation();
        if (el.querySelector("input")) return;
        const inp = document.createElement("input");
        inp.type = "number";
        inp.min = "0";
        inp.step = "0.01";
        inp.value = initial.toFixed(2);
        inp.style.width = "72px";
        inp.style.background = "transparent";
        inp.style.color = "inherit";
        inp.style.border = "none";
        inp.style.outline = "none";
        el.textContent = "";
        el.appendChild(inp);
        inp.focus();
        inp.select();
        const commit = () => {
          const v = parseFloat(inp.value);
          if (isFinite(v) && v >= 0) apply(v);
        };
        inp.addEventListener("keydown", (ke) => {
          if (ke.key === "Enter") commit();
          if (ke.key === "Escape") this.requestRender();
        });
        inp.addEventListener("blur", () => commit());
      };
    };

    makeEditable(dimStart, startDist / scale, (valM) => {
      const wallLen =
        opening.wallSide === "N" || opening.wallSide === "S"
          ? room.width
          : room.height;
      const maxStart = Math.max(0, wallLen - opening.lengthM);
      opening.offsetM = Math.max(0, Math.min(valM, maxStart));
      this.requestRender();
    });
    makeEditable(dimEnd, endDist / scale, (valM) => {
      const wallLen =
        opening.wallSide === "N" || opening.wallSide === "S"
          ? room.width
          : room.height;
      const start = Math.max(0, wallLen - opening.lengthM - valM);
      opening.offsetM = start;
      this.requestRender();
    });

    ctx.restore();
  }

  private hideOverlayAndDimensions() {
    const panel = document.getElementById(
      "opening-panel"
    ) as HTMLDivElement | null;
    if (panel) panel.style.display = "none";
    const dimStart = document.getElementById(
      "dim-start-label"
    ) as HTMLDivElement | null;
    const dimEnd = document.getElementById(
      "dim-end-label"
    ) as HTMLDivElement | null;
    if (dimStart) dimStart.style.display = "none";
    if (dimEnd) dimEnd.style.display = "none";
  }

  private onOverlayLengthInput() {
    const room = this.getRoom();
    if (!room || !this.selectedId) return;
    const input = document.getElementById(
      "opening-length"
    ) as HTMLInputElement | null;
    if (!input) return;
    const opening = room.openings.find((o) => o.id === this.selectedId);
    if (!opening) return;
    const v = parseFloat(input.value);
    if (!isFinite(v) || v <= 0) return;
    opening.lengthM = v;
    const wallLen =
      opening.wallSide === "N" || opening.wallSide === "S"
        ? room.width
        : room.height;
    opening.offsetM = Math.max(
      0,
      Math.min(opening.offsetM, Math.max(0, wallLen - opening.lengthM))
    );
    this.requestRender();
  }

  private onOverlayDoorOpenInput() {
    const room = this.getRoom();
    if (!room || !this.selectedId) return;
    const slider = document.getElementById(
      "door-open"
    ) as HTMLInputElement | null;
    if (!slider) return;
    const opening = room.openings.find((o) => o.id === this.selectedId);
    if (!opening || opening.type !== "door") return;
    const v = parseFloat(slider.value);
    if (!isFinite(v)) return;
    opening.doorOpen01 = Math.max(0, Math.min(1, v / 100));
    this.requestRender();
  }

  private onOverlayDoorHinge() {
    const room = this.getRoom();
    if (!room || !this.selectedId) return;
    const hinge = document.getElementById(
      "door-hinge"
    ) as HTMLInputElement | null;
    if (!hinge) return;
    const opening = room.openings.find((o) => o.id === this.selectedId);
    if (!opening || opening.type !== "door") return;
    opening.doorHingeStart = !!hinge.checked;
    this.requestRender();
  }

  private onOverlayDoorMirror(axis: "H" | "V") {
    const room = this.getRoom();
    if (!room || !this.selectedId) return;
    const opening = room.openings.find((o) => o.id === this.selectedId);
    if (!opening || opening.type !== "door") return;
    if (axis === "H") opening.doorMirrorH = !opening.doorMirrorH;
    else opening.doorMirrorV = !opening.doorMirrorV;
    this.requestRender();
  }

  private hitTestOpenings(px: number, py: number) {
    for (const [id, boxes] of this.openingsLayout) {
      for (const b of boxes) {
        if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
          return { id, side: b.side } as { id: string; side: WallSide };
        }
      }
    }
    return null;
  }

  private onPointerDown(e: PointerEvent) {
    const room = this.getRoom();
    if (!room) return;
    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const hit = this.hitTestOpenings(px, py);
    if (!hit) {
      // background click: deselect
      this.selectedId = null;
      this.hideOverlayAndDimensions();
      this.requestRender();
      return;
    }
    // Start drag
    this.draggingId = hit.id;
    this.dragSide = hit.side;
    this.selectedId = hit.id;
    const layout = this.openingsLayout.get(hit.id)?.[0];
    if (layout) {
      if (hit.side === "N" || hit.side === "S")
        this.dragOffsetToCursorPx = px - layout.x;
      else this.dragOffsetToCursorPx = py - layout.y;
    }
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  private onPointerMove(e: PointerEvent) {
    const room = this.getRoom();
    if (!room || !this.draggingId || !this.dragSide) return;

    const rect = this.canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const scale = this.getScale();
    const wallPx = room.wallThicknessM * scale;
    const innerPxW = room.width * scale;
    const innerPxH = room.height * scale;
    const w = this.canvas.width / this.getDpr();
    const h = this.canvas.height / this.getDpr();
    const outerPxW = innerPxW + wallPx * 2;
    const outerPxH = innerPxH + wallPx * 2;
    const x = (w - outerPxW) / 2;
    const y = (h - outerPxH) / 2;

    let alongPx = 0;
    const opening = room.openings.find((o) => o.id === this.draggingId);
    if (!opening) return;

    const lenPx = opening.lengthM * scale;
    const limitH = Math.max(0, innerPxW - lenPx);
    const limitV = Math.max(0, innerPxH - lenPx);

    if (this.dragSide === "N") {
      alongPx = px - this.dragOffsetToCursorPx - (x + wallPx);
      if (alongPx < 0) {
        const newOffsetPx = Math.min(-alongPx, limitV);
        opening.wallSide = "W";
        opening.offsetM = newOffsetPx / scale;
        this.dragSide = "W";
        this.dragOffsetToCursorPx = py - (y + wallPx + newOffsetPx);
      } else if (alongPx > limitH) {
        const overflow = alongPx - limitH;
        const newOffsetPx = Math.min(overflow, limitV);
        opening.wallSide = "E";
        opening.offsetM = newOffsetPx / scale;
        this.dragSide = "E";
        this.dragOffsetToCursorPx = py - (y + wallPx + newOffsetPx);
      } else {
        opening.offsetM = alongPx / scale;
      }
    } else if (this.dragSide === "S") {
      alongPx = px - this.dragOffsetToCursorPx - (x + wallPx);
      if (alongPx < 0) {
        const newOffsetPx = Math.min(-alongPx, limitV);
        opening.wallSide = "W";
        opening.offsetM = newOffsetPx / scale;
        this.dragSide = "W";
        this.dragOffsetToCursorPx = py - (y + wallPx + newOffsetPx);
      } else if (alongPx > limitH) {
        const overflow = alongPx - limitH;
        const newOffsetPx = Math.min(overflow, limitV);
        opening.wallSide = "E";
        opening.offsetM = newOffsetPx / scale;
        this.dragSide = "E";
        this.dragOffsetToCursorPx = py - (y + wallPx + newOffsetPx);
      } else {
        opening.offsetM = alongPx / scale;
      }
    } else if (this.dragSide === "W") {
      alongPx = py - this.dragOffsetToCursorPx - (y + wallPx);
      if (alongPx < 0) {
        const newOffsetPx = Math.min(-alongPx, limitH);
        opening.wallSide = "N";
        opening.offsetM = newOffsetPx / scale;
        this.dragSide = "N";
        this.dragOffsetToCursorPx = px - (x + wallPx + newOffsetPx);
      } else if (alongPx > limitV) {
        const overflow = alongPx - limitV;
        const newOffsetPx = Math.min(overflow, limitH);
        opening.wallSide = "S";
        opening.offsetM = newOffsetPx / scale;
        this.dragSide = "S";
        this.dragOffsetToCursorPx = px - (x + wallPx + newOffsetPx);
      } else {
        opening.offsetM = alongPx / scale;
      }
    } else if (this.dragSide === "E") {
      alongPx = py - this.dragOffsetToCursorPx - (y + wallPx);
      if (alongPx < 0) {
        const newOffsetPx = Math.min(-alongPx, limitH);
        opening.wallSide = "N";
        opening.offsetM = newOffsetPx / scale;
        this.dragSide = "N";
        this.dragOffsetToCursorPx = px - (x + wallPx + newOffsetPx);
      } else if (alongPx > limitV) {
        const overflow = alongPx - limitV;
        const newOffsetPx = Math.min(overflow, limitH);
        opening.wallSide = "S";
        opening.offsetM = newOffsetPx / scale;
        this.dragSide = "S";
        this.dragOffsetToCursorPx = px - (x + wallPx + newOffsetPx);
      } else {
        opening.offsetM = alongPx / scale;
      }
    }

    this.requestRender();
  }

  private onPointerUp() {
    this.draggingId = null;
    this.dragSide = null;
  }
}
