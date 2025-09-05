export class Furniture {
  id: string;
  // position in meters relative to inner room top-left (top-left of rotated AABB)
  xM: number;
  yM: number;
  widthM: number; // local X when rotation=0
  heightM: number; // local Y when rotation=0
  rotationRad: number; // multiples of 90° supported via R
  label: string;

  constructor(params: {
    id?: string;
    xM: number;
    yM: number;
    widthM: number;
    heightM: number;
    rotationRad?: number;
    label?: string;
  }) {
    this.id = params.id ?? `f_${Math.random().toString(36).slice(2, 9)}`;
    this.xM = params.xM;
    this.yM = params.yM;
    this.widthM = params.widthM;
    this.heightM = params.heightM;
    this.rotationRad = params.rotationRad ?? 0;
    this.label = params.label ?? "Item";
  }

  static createDefault(centerXM: number, centerYM: number) {
    const widthM = 1.2;
    const heightM = 0.6;
    return new Furniture({
      xM: centerXM - widthM / 2,
      yM: centerYM - heightM / 2,
      widthM,
      heightM,
      label: "Table",
    });
  }
}
