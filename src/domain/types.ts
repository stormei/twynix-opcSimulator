export type DataTypeName = "Boolean" | "Double" | "Int32";

export type TagKind =
  | "Temperature"
  | "Pressure"
  | "Flow"
  | "Level"
  | "Speed"
  | "Vibration"
  | "Current"
  | "Voltage"
  | "MotorRunning"
  | "ValvePosition"
  | "AlarmState"
  | "ProductionCounter"
  | "QualityRejectCounter";

export type SimulationMode =
  | "constant"
  | "random"
  | "sine"
  | "drift"
  | "step"
  | "noisy"
  | "correlated"
  | "fault";

export interface AlarmThresholds {
  lowLow?: number;
  low?: number;
  high?: number;
  highHigh?: number;
}

export interface AlarmState {
  active: boolean;
  severity: number;
  message: string;
}

export interface TagDefinition {
  id: string;
  name: string;
  browsePath: string[];
  kind: TagKind;
  dataType: DataTypeName;
  engineeringUnit?: string;
  min?: number;
  max?: number;
  mode: SimulationMode;
  alarmThresholds?: AlarmThresholds;
  baseValue?: number | boolean;
  correlationKey?: string;
}

export interface RuntimeTag extends TagDefinition {
  value: number | boolean;
  previousValue: number | boolean;
  alarm: AlarmState;
  lastUpdated: string;
}

export interface TopologyConfig {
  areas: number;
  linesPerArea: number;
  machinesPerLine: number;
  tagsPerMachine: number;
  includeUtilities: boolean;
}

export interface OpcUaConfig {
  port: number;
  host: string;
  resourcePath: string;
}

export interface SimulatorConfig {
  name: string;
  seed: number;
  updateIntervalMs: number;
  opcua: OpcUaConfig;
  topology: TopologyConfig;
  faultMode: boolean;
  tags?: TagDefinition[];
}

export interface SimulatorMetrics {
  updateDurationMs: number;
  tagCount: number;
  connectedOpcUaClients: number;
  serverUptimeSeconds: number;
  startedAt?: string;
  running: boolean;
}

export interface SimulatorStatus {
  metrics: SimulatorMetrics;
  endpointUrl: string;
}
