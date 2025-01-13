export function convertRotationToMatrix(rotation: number): number[] {
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [cos, -sin, sin, cos];
}

export function convertRotationToExtendedMatrix(degrees: number): number[] {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [cos, sin, -sin, cos, 0, 0];
}