export type OpeningType = "window" | "door";
export type WallSide = "N" | "E" | "S" | "W"; // clockwise, starting at top

let __id = 0;
function genId(prefix: string) {
  __id += 1;
  return `${prefix}-${__id}`;
}

export class Opening {
  id: string;
  type: OpeningType;
  wallSide: WallSide;
  offsetM: number; // distance along wall from top-left (N), top-right (E), bottom-right (S), bottom-left (W)
  lengthM: number; // opening length along wall
  // Door-specific
  doorOpen01?: number; // 0..1 where 0=closed, 1=fully open (90 deg)
  doorHingeStart?: boolean; // true: hinge at start (offset side); false: hinge at end
  doorMirrorH?: boolean; // mirror horizontally (flip swing along X for N/S walls)
  doorMirrorV?: boolean; // mirror vertically (flip swing along Y for E/W walls)

  constructor(
    type: OpeningType,
    wallSide: WallSide,
    offsetM: number,
    lengthM: number
  ) {
    this.id = genId(type);
    this.type = type;
    this.wallSide = wallSide;
    this.offsetM = Math.max(0, offsetM);
    this.lengthM = Math.max(0, lengthM);
  }

  static createWindow(wallSide: WallSide, offsetM: number) {
    // default window ~1.2m
    return new Opening("window", wallSide, offsetM, 1.2);
  }

  static createDoor(wallSide: WallSide, offsetM: number) {
    // default door ~0.9m
    const d = new Opening("door", wallSide, offsetM, 0.9);
    d.doorOpen01 = 0;
    d.doorHingeStart = true;
    d.doorMirrorH = false;
    d.doorMirrorV = false;
    return d;
  }
}
