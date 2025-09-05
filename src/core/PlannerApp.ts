import { Bed } from "../models/Bed";
import { Furniture } from "../models/Furniture";
import type { WallSide } from "../models/Opening";
import { Opening } from "../models/Opening";
import { Room } from "../models/Room";
import { CanvasRenderer } from "./CanvasRenderer";
import {
  getActiveProjectId,
  listProjects,
  loadProject,
  saveProject,
  setActiveProjectId,
  toRoom,
} from "./storage/ProjectStore";

export class PlannerApp {
  private renderer: CanvasRenderer;
  private currentRoom: Room | null = null;

  constructor(root: HTMLElement) {
    const canvas = root.querySelector<HTMLCanvasElement>("#planner-canvas");
    if (!canvas) throw new Error("Canvas element not found");
    this.renderer = new CanvasRenderer(canvas, (m) => this.updateMetrics(m));
    this.bindUI();
  }

  private bindUI() {
    const newBtn = document.getElementById("new-room-btn");
    const projectSelect = document.getElementById(
      "project-select"
    ) as HTMLSelectElement | null;
    const saveBtn = document.getElementById("save-project");
    const loadBtn = document.getElementById("load-project");
    const activeIndicator = document.getElementById("active-project-indicator");
    const addWindowBtn = document.getElementById("add-window");
    const addDoorBtn = document.getElementById("add-door");
    const addBedBtn = document.getElementById("add-bed");
    const addFurnitureBtn = document.getElementById("add-furniture");
    const dlg = document.getElementById(
      "room-dialog"
    ) as HTMLDialogElement | null;
    const form = document.getElementById("room-form") as HTMLFormElement | null;
    const cancel = document.getElementById(
      "dialog-cancel"
    ) as HTMLButtonElement | null;
    newBtn?.addEventListener("click", () => {
      if (!dlg) return;
      const wInM = 6;
      const hInM = 4;
      (document.getElementById("room-width") as HTMLInputElement).value =
        String(wInM);
      (document.getElementById("room-height") as HTMLInputElement).value =
        String(hInM);
      dlg.showModal();
    });
    cancel?.addEventListener("click", () => dlg?.close());
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const width = parseFloat(
        (document.getElementById("room-width") as HTMLInputElement).value
      );
      const height = parseFloat(
        (document.getElementById("room-height") as HTMLInputElement).value
      );
      if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0)
        return;
      this.currentRoom = new Room(width, height);
      this.renderer.setRoom(this.currentRoom);
      this.renderer.fitRoomToView();
      this.updateRoomProps(this.currentRoom);
      dlg?.close();
    });

    // --- Project persistence wiring ---
    const refreshProjects = async () => {
      const optionsHtml: string[] = ['<option value="">— Projects —</option>'];
      const items = await listProjects();
      const activeId = getActiveProjectId();
      for (const p of items) {
        const selected = p.id === activeId ? " selected" : "";
        optionsHtml.push(
          `<option value="${p.id}"${selected}>${p.name}</option>`
        );
      }
      if (projectSelect) projectSelect.innerHTML = optionsHtml.join("");
      if (activeIndicator)
        activeIndicator.textContent = activeId
          ? `Active: ${items.find((i) => i.id === activeId)?.name ?? activeId}`
          : "No project";
    };

    const ensureProjectName = () => {
      const name = prompt("Project name:", "My room");
      return name?.trim() || null;
    };

    const getOrCreateProjectId = () => {
      return (
        getActiveProjectId() ||
        `proj_${Math.random().toString(36).slice(2, 8)}${Date.now()}`
      );
    };

    saveBtn?.addEventListener("click", async () => {
      if (!this.currentRoom) return;
      const id = getOrCreateProjectId();
      let name = (projectSelect?.selectedOptions[0]?.textContent || "").trim();
      if (!name || name === "— Projects —") {
        const n = ensureProjectName();
        if (!n) return;
        name = n;
      }
      await saveProject(id, name, this.currentRoom);
      setActiveProjectId(id);
      await refreshProjects();
    });

    const loadProjectIntoApp = async (id: string) => {
      const data = await loadProject(id);
      if (!data) return;
      this.currentRoom = toRoom(data);
      this.renderer.setRoom(this.currentRoom);
      this.renderer.fitRoomToView();
      this.updateRoomProps(this.currentRoom);
      setActiveProjectId(id);
      await refreshProjects();
      this.renderer.render();
    };

    loadBtn?.addEventListener("click", async () => {
      const id = projectSelect?.value;
      if (!id) return;
      await loadProjectIntoApp(id);
    });

    projectSelect?.addEventListener("change", async () => {
      const nextId = projectSelect.value;
      const prevId = getActiveProjectId();
      // Auto-save current project before switching
      if (this.currentRoom && prevId) {
        const prevName = projectSelect.querySelector(
          `option[value="${prevId}"]`
        )?.textContent;
        await saveProject(prevId, prevName || "Untitled", this.currentRoom);
      }
      if (!nextId) return;
      await loadProjectIntoApp(nextId);
    });

    // initial projects list
    refreshProjects().then(async () => {
      const activeId = getActiveProjectId();
      if (activeId) await loadProjectIntoApp(activeId);
    });

    const addRandomOpening = (type: "window" | "door") => {
      if (!this.currentRoom) return;
      const sides: WallSide[] = ["N", "E", "S", "W"];
      const side = sides[Math.floor(Math.random() * sides.length)];
      const lengthM = type === "window" ? 1.2 : 0.9;
      const wallLen = this.currentRoom.getWallLength(side);
      const maxOffset = Math.max(0, wallLen - lengthM);
      const offset = Math.random() * maxOffset;
      const opening =
        type === "window"
          ? Opening.createWindow(side, offset)
          : Opening.createDoor(side, offset);
      this.currentRoom.addOpening(opening);
      this.renderer.render();
    };

    addWindowBtn?.addEventListener("click", () => addRandomOpening("window"));
    addDoorBtn?.addEventListener("click", () => addRandomOpening("door"));
    addBedBtn?.addEventListener("click", () => {
      if (!this.currentRoom) return;
      const cx = this.currentRoom.width / 2;
      const cy = this.currentRoom.height / 2;
      const bed = Bed.createDefault(cx, cy);
      this.currentRoom.addBed(bed);
      this.resolveBedPlacement(bed);
      this.renderer.render();
    });
    addFurnitureBtn?.addEventListener("click", () => {
      if (!this.currentRoom) return;
      const cx = this.currentRoom.width / 2;
      const cy = this.currentRoom.height / 2;
      const item = Furniture.createDefault(cx, cy);
      this.currentRoom.addFurniture(item);
      this.resolveFurniturePlacement(item);
      this.renderer.render();
    });
  }

  private updateRoomProps(room: Room) {
    document.getElementById("prop-width")!.textContent = `${room.width.toFixed(
      2
    )} m`;
    document.getElementById(
      "prop-height"
    )!.textContent = `${room.height.toFixed(2)} m`;
    document.getElementById("prop-wall")!.textContent = `${Math.round(
      room.wallThicknessM * 1000
    )} mm`;
  }

  private updateMetrics(m: { scale: number }) {
    document.getElementById("prop-scale")!.textContent = `${m.scale.toFixed(
      0
    )} px/m`;
  }

  private resolveBedPlacement(bed: Bed) {
    const room = this.currentRoom;
    if (!room) return;
    room.clampBed(bed);
    if (!room.bedIntersectsAnyFurniture(bed)) return;
    const deltas: Array<[number, number]> = [];
    const maxR = 10; // up to 2m radius in 0.2m steps
    for (let r = 1; r <= maxR; r++) {
      const d = r * 0.2;
      deltas.push([d, 0], [-d, 0], [0, d], [0, -d]);
    }
    const { xM: x0, yM: y0 } = bed;
    for (const [dx, dy] of deltas) {
      bed.xM = x0 + dx;
      bed.yM = y0 + dy;
      room.clampBed(bed);
      if (!room.bedIntersectsAnyFurniture(bed)) return;
    }
    // if unresolved, put back original
    bed.xM = x0;
    bed.yM = y0;
    room.clampBed(bed);
  }

  private resolveFurniturePlacement(item: Furniture) {
    const room = this.currentRoom;
    if (!room) return;
    room.clampFurniture(item);
    if (!room.furnitureIntersectsAnyBed(item)) return;
    const deltas: Array<[number, number]> = [];
    const maxR = 10;
    for (let r = 1; r <= maxR; r++) {
      const d = r * 0.2;
      deltas.push([d, 0], [-d, 0], [0, d], [0, -d]);
    }
    const { xM: x0, yM: y0 } = item;
    for (const [dx, dy] of deltas) {
      item.xM = x0 + dx;
      item.yM = y0 + dy;
      room.clampFurniture(item);
      if (!room.furnitureIntersectsAnyBed(item)) return;
    }
    item.xM = x0;
    item.yM = y0;
    room.clampFurniture(item);
  }
}
