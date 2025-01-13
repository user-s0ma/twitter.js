type Interpolatable = number | boolean;

type InterpolatableArray = Array<Interpolatable>;

export function interpolate(fromList: InterpolatableArray, toList: InterpolatableArray, f: number): InterpolatableArray {
  if (fromList.length !== toList.length) {
    throw new Error(`Mismatched interpolation arguments ${fromList}: ${toList}`);
  }
  const out: InterpolatableArray = [];
  for (let i = 0; i < fromList.length; i++) {
    out.push(interpolateNum(fromList[i], toList[i], f));
  }
  return out;
}

function interpolateNum(fromVal: Interpolatable, toVal: Interpolatable, f: number): Interpolatable {
  if (typeof fromVal === "number" && typeof toVal === "number") {
    return fromVal * (1 - f) + toVal * f;
  }

  if (typeof fromVal === "boolean" && typeof toVal === "boolean") {
    return f < 0.5 ? fromVal : toVal;
  }

  throw new Error("Unsupported interpolation types");
}