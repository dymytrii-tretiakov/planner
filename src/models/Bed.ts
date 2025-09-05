export class Bed {
  id: string;
  // position in meters relative to inner room top-left
  xM: number;
  yM: number;
  widthM: number; // horizontal size when rotation = 0
  heightM: number; // vertical size when rotation = 0
  rotationRad: number; // 0 or Math.PI/2 for now
  nightstandLeft: boolean;
  nightstandRight: boolean;
  nightstandSizeM: number;

  constructor(params: {
    id?: string;
    xM: number;
    yM: number;
    widthM: number;
    heightM: number;
    rotationRad?: number;
    nightstandLeft?: boolean;
    nightstandRight?: boolean;
    nightstandSizeM?: number;
  }) {
    this.id = params.id ?? `bed_${Math.random().toString(36).slice(2, 9)}`;
    this.xM = params.xM;
    this.yM = params.yM;
    this.widthM = params.widthM;
    this.heightM = params.heightM;
    this.rotationRad = params.rotationRad ?? 0;
    this.nightstandLeft = params.nightstandLeft ?? false;
    this.nightstandRight = params.nightstandRight ?? false;
    this.nightstandSizeM = params.nightstandSizeM ?? 0.45;
  }

  static createDefault(centerXM: number, centerYM: number) {
    const widthM = 1.6; // length
    const heightM = 2.0; // width
    return new Bed({
      xM: centerXM - widthM / 2,
      yM: centerYM - heightM / 2,
      widthM,
      heightM,
      nightstandSizeM: 0.45,
    });
  }
}
