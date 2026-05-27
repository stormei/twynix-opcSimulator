import type { AlarmState, AlarmThresholds } from "../domain/types.js";

export function evaluateAlarm(tagName: string, value: number | boolean, thresholds?: AlarmThresholds): AlarmState {
  if (typeof value !== "number" || thresholds === undefined) {
    return { active: false, severity: 0, message: "" };
  }

  if (thresholds.highHigh !== undefined && value >= thresholds.highHigh) {
    return { active: true, severity: 900, message: `${tagName} HighHigh alarm` };
  }
  if (thresholds.lowLow !== undefined && value <= thresholds.lowLow) {
    return { active: true, severity: 900, message: `${tagName} LowLow alarm` };
  }
  if (thresholds.high !== undefined && value >= thresholds.high) {
    return { active: true, severity: 600, message: `${tagName} High alarm` };
  }
  if (thresholds.low !== undefined && value <= thresholds.low) {
    return { active: true, severity: 600, message: `${tagName} Low alarm` };
  }

  return { active: false, severity: 0, message: "" };
}
