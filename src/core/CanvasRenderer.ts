import { Room } from "../models/Room";
import { BedsLayer } from "./layers/BedsLayer";
import { FurnitureLayer } from "./layers/FurnitureLayer";
import { OpeningsLayer } from "./layers/OpeningsLayer";
import { drawGrid } from "./render/grid";
import { drawWalls } from "./render/walls";
import { computeRoomMetrics } from "./utils/metrics";

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = Math.max(1, window.devicePixelRatio || 1);
  private scaleMetersToPixels = 50; // default scale: 1m = 50px
  private room: Room | null = null;
  private canvas: HTMLCanvasElement;
  private onMetrics?: (m: { scale: number }) => void;
  // Layers
  private openingsLayer!: OpeningsLayer;
  private bedsLayer!: BedsLayer;
  private furnitureLayer!: FurnitureLayer;

  constructor(
    canvas: HTMLCanvasElement,
    onMetrics?: (m: { scale: number }) => void
  ) {
    this.canvas = canvas;
    this.onMetrics = onMetrics;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context not available");
    this.ctx = ctx;
    this.resizeToContainer();
    window.addEventListener("resize", () => this.resizeToContainer());
    // Layer init
    this.openingsLayer = new OpeningsLayer(
      this.canvas,
      this.ctx,
      () => this.scaleMetersToPixels,
      () => this.dpr,
      () => this.room,
      () => this.render()
    );
    this.bedsLayer = new BedsLayer(
      this.canvas,
      this.ctx,
      () => this.scaleMetersToPixels,
      () => this.room,
      () => this.render()
    );
    this.furnitureLayer = new FurnitureLayer(
      this.canvas,
      this.ctx,
      () => this.scaleMetersToPixels,
      () => this.room,
      () => this.render()
    );
  }

  setRoom(room: Room | null) {
    this.room = room;
    this.render();
  }

  setScale(scale: number) {
    this.scaleMetersToPixels = Math.max(5, scale);
    this.onMetrics?.({ scale: this.scaleMetersToPixels });
    this.render();
  }

  fitRoomToView(paddingPx = 40) {
    if (!this.room) return;
    const { width: cw, height: ch } = this.canvas;
    const vw = cw / this.dpr - paddingPx * 2;
    const vh = ch / this.dpr - paddingPx * 2;
    // Room width/height are inner; outer adds two wall thicknesses
    const outerWm = this.room.width + this.room.wallThicknessM * 2;
    const outerHm = this.room.height + this.room.wallThicknessM * 2;
    const sx = vw / outerWm;
    const sy = vh / outerHm;
    const scale = Math.floor(Math.max(5, Math.min(sx, sy)));
    this.setScale(scale);
  }

  private resizeToContainer() {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.render();
  }

  private clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  private drawGrid(spacingPx = 50) {
    drawGrid(this.ctx, this.dpr, this.canvas, spacingPx);
  }

  private drawRoom() {
    if (!this.room) return;
    const m = computeRoomMetrics(
      this.room,
      this.scaleMetersToPixels,
      this.canvas,
      this.dpr
    );
    drawWalls(this.ctx, this.room, m);
    // Draw beds before openings (so openings overlay them on the wall)
    this.bedsLayer.draw(m.originX, m.originY, m.innerPxW, m.innerPxH, m.wallPx);
    this.furnitureLayer.draw(
      m.originX,
      m.originY,
      m.innerPxW,
      m.innerPxH,
      m.wallPx
    );
    this.openingsLayer.draw(
      m.originX,
      m.originY,
      m.innerPxW,
      m.innerPxH,
      m.wallPx
    );
  }

  render() {
    this.clear();
    this.drawGrid(50);
    this.drawRoom();
  }
}
