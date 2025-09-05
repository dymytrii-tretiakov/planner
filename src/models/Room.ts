export class Room {
  width: number;
  height: number;
  // wall thickness in meters (default 0.1m = 100mm)
  wallThicknessM: number;
  openings: import("./Opening").Opening[] = [];
  beds: import("./Bed").Bed[] = [];
  furniture: import("./Furniture").Furniture[] = [];
  constructor(width: number, height: number, wallThicknessM: number = 0.1) {
    this.width = width;
    this.height = height;
    this.wallThicknessM = wallThicknessM;
  }

  addOpening(opening: import("./Opening").Opening) {
    this.openings.push(opening);
    this.clampOpening(opening);
  }

  clampOpening(opening: import("./Opening").Opening) {
    const wallLen = this.getWallLength(opening.wallSide);
    opening.offsetM = Math.max(
      0,
      Math.min(opening.offsetM, Math.max(0, wallLen - opening.lengthM))
    );
  }

  getWallLength(side: import("./Opening").WallSide) {
    switch (side) {
      case "N":
      case "S":
        return this.width;
      case "E":
      case "W":
        return this.height;
    }
  }

  addBed(bed: import("./Bed").Bed) {
    this.beds.push(bed);
    this.clampBed(bed);
  }

  clampBed(bed: import("./Bed").Bed) {
    // Compute AABB including nightstand offset aligned to the top of the bed, rotated to world sides.
    const TWO_PI = Math.PI * 2;
    const rot = ((bed.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4; // 0..3
    const isPortrait = step % 2 === 1;
    const baseW = isPortrait ? bed.heightM : bed.widthM;
    const baseH = isPortrait ? bed.widthM : bed.heightM;
    const ns = bed.nightstandSizeM;
    const off = { left: 0, right: 0, top: 0, bottom: 0 } as Record<
      "left" | "right" | "top" | "bottom",
      number
    >;
    // Nightstands are on local left/right; map to world by rotation.
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
    // Clamp so that [x+off.left, x+baseW+off.right] and [y+off.top, y+baseH+off.bottom] stay within [0,width] and [0,height]
    const minX = -off.left;
    const maxX = this.width - baseW - off.right;
    const minY = -off.top;
    const maxY = this.height - baseH - off.bottom;
    bed.xM = Math.max(minX, Math.min(bed.xM, Math.max(minX, maxX)));
    bed.yM = Math.max(minY, Math.min(bed.yM, Math.max(minY, maxY)));
  }

  addFurniture(item: import("./Furniture").Furniture) {
    this.furniture.push(item);
    this.clampFurniture(item);
  }

  clampFurniture(item: import("./Furniture").Furniture) {
    const TWO_PI = Math.PI * 2;
    const rot = ((item.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4;
    const isPortrait = step % 2 === 1;
    const baseW = isPortrait ? item.heightM : item.widthM;
    const baseH = isPortrait ? item.widthM : item.heightM;
    item.xM = Math.max(0, Math.min(item.xM, Math.max(0, this.width - baseW)));
    item.yM = Math.max(0, Math.min(item.yM, Math.max(0, this.height - baseH)));
  }

  // --- Intersection helpers (meters, using rotated AABBs) ---
  private getBedOffsets(bed: import("./Bed").Bed) {
    const TWO_PI = Math.PI * 2;
    const rot = ((bed.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4;
    const ns = bed.nightstandSizeM;
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
    return { step, off };
  }

  getBedAABB(bed: import("./Bed").Bed) {
    const { step, off } = this.getBedOffsets(bed);
    const isPortrait = step % 2 === 1;
    const baseW = isPortrait ? bed.heightM : bed.widthM;
    const baseH = isPortrait ? bed.widthM : bed.heightM;
    const left = bed.xM + off.left;
    const top = bed.yM + off.top;
    const right = bed.xM + baseW + off.right;
    const bottom = bed.yM + baseH + off.bottom;
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  getFurnitureAABB(item: import("./Furniture").Furniture) {
    const TWO_PI = Math.PI * 2;
    const rot = ((item.rotationRad % TWO_PI) + TWO_PI) % TWO_PI;
    const step = Math.round(rot / (Math.PI / 2)) % 4;
    const isPortrait = step % 2 === 1;
    const baseW = isPortrait ? item.heightM : item.widthM;
    const baseH = isPortrait ? item.widthM : item.heightM;
    return { x: item.xM, y: item.yM, w: baseW, h: baseH };
  }

  private boxesIntersect(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ) {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }

  bedIntersectsAnyFurniture(bed: import("./Bed").Bed) {
    const a = this.getBedAABB(bed);
    for (const f of this.furniture) {
      const b = this.getFurnitureAABB(f);
      if (this.boxesIntersect(a, b)) return true;
    }
    return false;
  }

  furnitureIntersectsAnyBed(item: import("./Furniture").Furniture) {
    const b = this.getFurnitureAABB(item);
    for (const bed of this.beds) {
      const a = this.getBedAABB(bed);
      if (this.boxesIntersect(a, b)) return true;
    }
    return false;
  }
}
