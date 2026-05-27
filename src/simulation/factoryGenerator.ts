import type { SimulatorConfig, TagDefinition, TagKind } from "../domain/types.js";

const MACHINE_TAG_CYCLE: TagKind[] = [
  "Temperature",
  "Vibration",
  "Current",
  "MotorRunning",
  "ProductionCounter",
  "Pressure",
  "Flow",
  "Speed",
  "ValvePosition",
  "QualityRejectCounter"
];

const KIND_DEFAULTS: Record<
  TagKind,
  {
    dataType: "Boolean" | "Double" | "Int32";
    unit?: string;
    min?: number;
    max?: number;
    mode: TagDefinition["mode"];
    baseValue?: number | boolean;
  }
> = {
  Temperature: { dataType: "Double", unit: "degC", min: 15, max: 95, mode: "correlated", baseValue: 42 },
  Pressure: { dataType: "Double", unit: "bar", min: 0, max: 12, mode: "noisy", baseValue: 5.5 },
  Flow: { dataType: "Double", unit: "m3/h", min: 0, max: 250, mode: "correlated", baseValue: 120 },
  Level: { dataType: "Double", unit: "%", min: 0, max: 100, mode: "correlated", baseValue: 55 },
  Speed: { dataType: "Double", unit: "rpm", min: 0, max: 1800, mode: "correlated", baseValue: 1200 },
  Vibration: { dataType: "Double", unit: "mm/s", min: 0, max: 20, mode: "correlated", baseValue: 2.3 },
  Current: { dataType: "Double", unit: "A", min: 0, max: 160, mode: "correlated", baseValue: 45 },
  Voltage: { dataType: "Double", unit: "V", min: 360, max: 430, mode: "noisy", baseValue: 400 },
  MotorRunning: { dataType: "Boolean", mode: "step", baseValue: true },
  ValvePosition: { dataType: "Double", unit: "%", min: 0, max: 100, mode: "sine", baseValue: 65 },
  AlarmState: { dataType: "Boolean", mode: "correlated", baseValue: false },
  ProductionCounter: { dataType: "Int32", unit: "count", min: 0, max: 2147483647, mode: "correlated", baseValue: 0 },
  QualityRejectCounter: { dataType: "Int32", unit: "count", min: 0, max: 2147483647, mode: "correlated", baseValue: 0 }
};

export function defaultConfig(): SimulatorConfig {
  return {
    name: "TwynIX OPC UA Simulator",
    seed: 424242,
    updateIntervalMs: 1000,
    faultMode: false,
    opcua: {
      port: 4840,
      host: "0.0.0.0",
      resourcePath: "/twynix/server"
    },
    topology: {
      areas: 4,
      linesPerArea: 5,
      machinesPerLine: 10,
      tagsPerMachine: 5,
      includeUtilities: true
    }
  };
}

export function generateFactoryTags(config: SimulatorConfig): TagDefinition[] {
  if (config.tags?.length) {
    return config.tags;
  }

  const tags: TagDefinition[] = [];
  const { areas, linesPerArea, machinesPerLine, tagsPerMachine, includeUtilities } = config.topology;

  for (let area = 1; area <= areas; area += 1) {
    for (let line = 1; line <= linesPerArea; line += 1) {
      for (let machine = 1; machine <= machinesPerLine; machine += 1) {
        const correlationKey = `A${area}.L${line}.M${machine}`;
        const path = ["Plant", `Area ${area}`, `Line ${line}`, `Machine ${machine}`];
        for (let index = 0; index < tagsPerMachine; index += 1) {
          const kind = MACHINE_TAG_CYCLE[index % MACHINE_TAG_CYCLE.length]!;
          tags.push(createTag(kind, path, `${correlationKey}.${kind}`, correlationKey));
        }
      }
    }
  }

  if (includeUtilities) {
    addUtilityTags(tags);
  }

  return tags;
}

function addUtilityTags(tags: TagDefinition[]): void {
  const utilities: Array<{ system: string; kinds: TagKind[] }> = [
    { system: "Compressor", kinds: ["Pressure", "Temperature", "Current", "MotorRunning", "AlarmState"] },
    { system: "Boiler", kinds: ["Temperature", "Pressure", "Level", "Flow", "AlarmState"] },
    { system: "Cooling Water", kinds: ["Temperature", "Pressure", "Flow", "ValvePosition", "Level"] },
    { system: "Main Power", kinds: ["Voltage", "Current", "AlarmState", "ProductionCounter", "QualityRejectCounter"] },
    { system: "Storage Tanks", kinds: ["Level", "Flow", "ValvePosition", "Temperature", "AlarmState"] }
  ];

  for (const utility of utilities) {
    for (let unit = 1; unit <= 3; unit += 1) {
      const key = `UTIL.${utility.system.replaceAll(" ", "")}.${unit}`;
      const path = ["Plant", "Utilities", utility.system, `Unit ${unit}`];
      for (const kind of utility.kinds) {
        tags.push(createTag(kind, path, `${key}.${kind}`, key));
      }
    }
  }
}

function createTag(kind: TagKind, browsePath: string[], id: string, correlationKey: string): TagDefinition {
  const defaults = KIND_DEFAULTS[kind];
  const name = kind;
  return {
    id,
    name,
    browsePath,
    kind,
    dataType: defaults.dataType,
    engineeringUnit: defaults.unit,
    min: defaults.min,
    max: defaults.max,
    mode: defaults.mode,
    baseValue: defaults.baseValue,
    correlationKey,
    alarmThresholds: numericThresholds(defaults.min, defaults.max)
  };
}

function numericThresholds(min?: number, max?: number): TagDefinition["alarmThresholds"] {
  if (min === undefined || max === undefined || max <= min) {
    return undefined;
  }

  const span = max - min;
  return {
    lowLow: min + span * 0.05,
    low: min + span * 0.1,
    high: min + span * 0.9,
    highHigh: min + span * 0.95
  };
}
