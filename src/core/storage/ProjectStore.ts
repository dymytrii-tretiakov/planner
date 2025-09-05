import { Room } from "../../models/Room";
import type { ProjectData } from "../persistence/serialize";
import { deserializeRoom, serializeRoom } from "../persistence/serialize";

const DB_NAME = "planner-projects";
const DB_VERSION = 1;
const STORE = "projects";
const ACTIVE_KEY = "planner.activeProjectId";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProject(id: string, name: string, room: Room) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const now = Date.now();
  // Try to fetch existing to preserve createdAt
  const existing = await new Promise<ProjectData | undefined>(
    (resolve, reject) => {
      const g = store.get(id);
      g.onsuccess = () => resolve((g.result as ProjectData) ?? undefined);
      g.onerror = () => reject(g.error);
    }
  );
  const data: ProjectData = {
    id,
    name,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    room: serializeRoom(room),
  };
  await new Promise<void>((resolve, reject) => {
    const r = store.put(data);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  localStorage.setItem(ACTIVE_KEY, id);
}

export async function loadProject(id: string): Promise<ProjectData | null> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const data = await new Promise<ProjectData | null>((resolve, reject) => {
    const r = store.get(id);
    r.onsuccess = () => resolve((r.result as ProjectData) ?? null);
    r.onerror = () => reject(r.error);
  });
  return data;
}

export async function listProjects(): Promise<ProjectData[]> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const rows: ProjectData[] = await new Promise((resolve, reject) => {
    const out: ProjectData[] = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const c = req.result as IDBCursorWithValue | null;
      if (c) {
        out.push(c.value as ProjectData);
        c.continue();
      } else resolve(out.sort((a, b) => b.updatedAt - a.updatedAt));
    };
    req.onerror = () => reject(req.error);
  });
  return rows;
}

export function getActiveProjectId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProjectId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function toRoom(data: ProjectData): Room {
  return deserializeRoom(data.room);
}
