import { Bed } from "../../models/Bed";
import { Furniture } from "../../models/Furniture";
import { Opening } from "../../models/Opening";
import { Room } from "../../models/Room";

export type ProjectData = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  room: any;
};

export function serializeRoom(room: Room) {
  return {
    width: room.width,
    height: room.height,
    wallThicknessM: room.wallThicknessM,
    openings: room.openings.map((o) => ({
      id: o.id,
      type: o.type,
      wallSide: o.wallSide,
      offsetM: o.offsetM,
      lengthM: o.lengthM,
      doorOpen01: o.doorOpen01 ?? 0,
      doorHingeStart: !!o.doorHingeStart,
      doorMirrorH: !!o.doorMirrorH,
      doorMirrorV: !!o.doorMirrorV,
    })),
    beds: room.beds.map((b) => ({
      id: b.id,
      xM: b.xM,
      yM: b.yM,
      widthM: b.widthM,
      heightM: b.heightM,
      rotationRad: b.rotationRad,
      nightstandLeft: b.nightstandLeft,
      nightstandRight: b.nightstandRight,
      nightstandSizeM: b.nightstandSizeM,
    })),
    furniture: room.furniture.map((f) => ({
      id: f.id,
      xM: f.xM,
      yM: f.yM,
      widthM: f.widthM,
      heightM: f.heightM,
      rotationRad: f.rotationRad,
      label: f.label,
    })),
  };
}

export function deserializeRoom(data: any): Room {
  const room = new Room(data.width, data.height, data.wallThicknessM);
  if (Array.isArray(data.openings)) {
    for (const o of data.openings) {
      const op = new Opening(o.type, o.wallSide, o.offsetM, o.lengthM);
      op.id = o.id || op.id;
      op.doorOpen01 = o.doorOpen01 ?? 0;
      op.doorHingeStart = !!o.doorHingeStart;
      op.doorMirrorH = !!o.doorMirrorH;
      op.doorMirrorV = !!o.doorMirrorV;
      room.addOpening(op);
    }
  }
  if (Array.isArray(data.beds)) {
    for (const b of data.beds) {
      const bed = new Bed({
        id: b.id,
        xM: b.xM,
        yM: b.yM,
        widthM: b.widthM,
        heightM: b.heightM,
        rotationRad: b.rotationRad,
        nightstandLeft: b.nightstandLeft,
        nightstandRight: b.nightstandRight,
        nightstandSizeM: b.nightstandSizeM,
      });
      room.addBed(bed);
    }
  }
  if (Array.isArray(data.furniture)) {
    for (const f of data.furniture) {
      const item = new Furniture({
        id: f.id,
        xM: f.xM,
        yM: f.yM,
        widthM: f.widthM,
        heightM: f.heightM,
        rotationRad: f.rotationRad,
        label: f.label,
      });
      room.addFurniture(item);
    }
  }
  return room;
}
