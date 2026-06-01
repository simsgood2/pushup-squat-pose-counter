export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Returns the angle ABC in degrees using 3D vectors. */
export function angleDegrees(a: Point3D, b: Point3D, c: Point3D): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const abz = a.z - b.z;

  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const cbz = c.z - b.z;

  const abLen = Math.sqrt(abx * abx + aby * aby + abz * abz);
  const cbLen = Math.sqrt(cbx * cbx + cby * cby + cbz * cbz);

  if (abLen === 0 || cbLen === 0) return 0;

  const cosine = (abx * cbx + aby * cby + abz * cbz) / (abLen * cbLen);
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}

/** Returns the average of an array of numbers, ignoring nulls. */
export function average(values: (number | null | undefined)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}
