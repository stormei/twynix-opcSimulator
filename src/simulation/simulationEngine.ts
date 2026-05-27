import { EventEmitter } from "node:events";
import type { RuntimeTag, SimulatorConfig, SimulatorMetrics, TagDefinition } from "../domain/types.js";
import { generateFactoryTags } from "./factoryGenerator.js";
import { SeededRandom } from "./random.js";
import { evaluateAlarm } from "./alarmEvaluator.js";

interface GroupState {
  running: boolean;
  valvePosition: number;
  flow: number;
  level: number;
  fault: boolean;
}

export class SimulationEngine extends EventEmitter {
  private tags = new Map<string, RuntimeTag>();
  private interval?: NodeJS.Timeout;
  private tick = 0;
  private random: SeededRandom;
  private startedAt?: Date;
  private updateDurationMs = 0;
  private connectedOpcUaClients = 0;

  constructor(private config: SimulatorConfig) {
    super();
    this.random = new SeededRandom(config.seed);
    this.reset(config);
  }

  reset(config: SimulatorConfig): void {
    this.stop();
    this.config = config;
    this.tick = 0;
    this.random = new SeededRandom(config.seed);
    this.tags.clear();

    for (const definition of generateFactoryTags(config)) {
      const value = initialValue(definition);
      this.tags.set(definition.id, {
        ...definition,
        value,
        previousValue: value,
        alarm: evaluateAlarm(definition.name, value, definition.alarmThresholds),
        lastUpdated: new Date(0).toISOString()
      });
    }
  }

  start(): void {
    if (this.interval) {
      return;
    }
    this.startedAt = new Date();
    this.updateOnce();
    this.interval = setInterval(() => this.updateOnce(), this.config.updateIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  updateOnce(): void {
    const started = performance.now();
    this.tick += 1;
    const now = new Date().toISOString();
    const groups = this.buildGroupState();

    for (const tag of this.tags.values()) {
      tag.previousValue = tag.value;
      tag.value = this.nextValue(tag, groups.get(tag.correlationKey ?? tag.id), this.tick);
      tag.alarm = evaluateAlarm(tag.name, tag.value, tag.alarmThresholds);
      tag.lastUpdated = now;
    }

    this.updateDurationMs = performance.now() - started;
    this.emit("updated", this.getTags());
  }

  getTags(): RuntimeTag[] {
    return Array.from(this.tags.values());
  }

  getTag(id: string): RuntimeTag | undefined {
    return this.tags.get(id);
  }

  getMetrics(): SimulatorMetrics {
    return {
      updateDurationMs: Number(this.updateDurationMs.toFixed(3)),
      tagCount: this.tags.size,
      connectedOpcUaClients: this.connectedOpcUaClients,
      serverUptimeSeconds: this.startedAt ? Math.floor((Date.now() - this.startedAt.getTime()) / 1000) : 0,
      startedAt: this.startedAt?.toISOString(),
      running: this.interval !== undefined
    };
  }

  setConnectedOpcUaClients(count: number): void {
    this.connectedOpcUaClients = count;
  }

  private buildGroupState(): Map<string, GroupState> {
    const groups = new Map<string, GroupState>();
    for (const tag of this.tags.values()) {
      const key = tag.correlationKey ?? tag.id;
      const current =
        groups.get(key) ??
        {
          running: true,
          valvePosition: 65,
          flow: 100,
          level: 55,
          fault: this.config.faultMode
        };

      if (tag.kind === "MotorRunning") {
        current.running = Boolean(tag.value);
      } else if (tag.kind === "ValvePosition" && typeof tag.value === "number") {
        current.valvePosition = tag.value;
      } else if (tag.kind === "Flow" && typeof tag.value === "number") {
        current.flow = tag.value;
      } else if (tag.kind === "Level" && typeof tag.value === "number") {
        current.level = tag.value;
      }

      groups.set(key, current);
    }
    return groups;
  }

  private nextValue(tag: RuntimeTag, group: GroupState | undefined, tick: number): number | boolean {
    if (tag.dataType === "Boolean") {
      return this.nextBoolean(tag, tick, group);
    }

    const min = tag.min ?? 0;
    const max = tag.max ?? 100;
    const base = typeof tag.baseValue === "number" ? tag.baseValue : midpoint(min, max);
    const previous = typeof tag.value === "number" ? tag.value : base;
    const fault = this.config.faultMode || group?.fault === true || tag.mode === "fault";
    let next: number;

    switch (tag.mode) {
      case "constant":
        next = base;
        break;
      case "random":
        next = this.random.between(min, max);
        break;
      case "sine":
        next = base + Math.sin(tick / 12) * (max - min) * 0.18;
        break;
      case "drift":
        next = previous + this.random.between(-1, 1) * (max - min) * 0.015;
        break;
      case "step":
        next = tick % 60 < 30 ? base : base + (max - min) * 0.2;
        break;
      case "noisy":
        next = base + this.random.between(-1, 1) * (max - min) * 0.04;
        break;
      case "correlated":
      case "fault":
        next = this.correlatedValue(tag, group, previous, tick, fault);
        break;
      default:
        next = base;
    }

    if (fault && isFaultAffected(tag.kind)) {
      next += (max - min) * 0.18;
    }

    if (tag.dataType === "Int32") {
      return Math.max(0, Math.floor(next));
    }

    return round(clamp(next, min, max), 3);
  }

  private nextBoolean(tag: RuntimeTag, tick: number, group: GroupState | undefined): boolean {
    if (tag.kind === "AlarmState") {
      return group?.fault === true || this.config.faultMode;
    }
    if (tag.kind === "MotorRunning") {
      return this.config.faultMode ? tick % 120 < 100 : tick % 180 < 165;
    }
    return Boolean(tag.baseValue);
  }

  private correlatedValue(
    tag: RuntimeTag,
    group: GroupState | undefined,
    previous: number,
    tick: number,
    fault: boolean
  ): number {
    const min = tag.min ?? 0;
    const max = tag.max ?? 100;
    const base = typeof tag.baseValue === "number" ? tag.baseValue : midpoint(min, max);
    const runningFactor = group?.running === false ? 0.15 : 1;

    switch (tag.kind) {
      case "Temperature":
        return base + 18 * runningFactor + Math.sin(tick / 25) * 4 + (fault ? 20 : 0);
      case "Vibration":
        return base * runningFactor + Math.abs(Math.sin(tick / 8)) * 1.2 + (fault ? 9 : 0);
      case "Current":
        return base * runningFactor + Math.sin(tick / 10) * 6 + (fault ? 35 : 0);
      case "Speed":
        return group?.running === false ? 0 : base + Math.sin(tick / 18) * 70;
      case "Flow": {
        const valve = group?.valvePosition ?? 65;
        return (max - min) * (valve / 100) * runningFactor + Math.sin(tick / 9) * 3;
      }
      case "Level": {
        const flow = group?.flow ?? 100;
        const target = clamp((flow / Math.max(max, 1)) * 100, 20, 85);
        return previous + (target - previous) * 0.08 + Math.sin(tick / 20) * 0.4;
      }
      case "ProductionCounter":
        return previous + (group?.running === false ? 0 : fault ? 2 : 7);
      case "QualityRejectCounter":
        return previous + (group?.running === false ? 0 : this.random.chance(fault ? 0.45 : 0.04) ? (fault ? 3 : 1) : 0);
      default:
        return base + this.random.between(-1, 1) * (max - min) * 0.02;
    }
  }
}

function initialValue(tag: TagDefinition): number | boolean {
  if (tag.dataType === "Boolean") {
    return Boolean(tag.baseValue);
  }
  if (typeof tag.baseValue === "number") {
    return tag.baseValue;
  }
  return midpoint(tag.min ?? 0, tag.max ?? 100);
}

function midpoint(min: number, max: number): number {
  return min + (max - min) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isFaultAffected(kind: RuntimeTag["kind"]): boolean {
  return kind === "Temperature" || kind === "Vibration" || kind === "Current";
}
