import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { SimulatorConfig } from "../domain/types.js";
import { defaultConfig } from "../simulation/factoryGenerator.js";

const dataTypeSchema = z.enum(["Boolean", "Double", "Int32"]);
const tagKindSchema = z.enum([
  "Temperature",
  "Pressure",
  "Flow",
  "Level",
  "Speed",
  "Vibration",
  "Current",
  "Voltage",
  "MotorRunning",
  "ValvePosition",
  "AlarmState",
  "ProductionCounter",
  "QualityRejectCounter"
]);
const modeSchema = z.enum(["constant", "random", "sine", "drift", "step", "noisy", "correlated", "fault"]);

const tagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  browsePath: z.array(z.string().min(1)).min(1),
  kind: tagKindSchema,
  dataType: dataTypeSchema,
  engineeringUnit: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  mode: modeSchema,
  alarmThresholds: z
    .object({
      lowLow: z.number().optional(),
      low: z.number().optional(),
      high: z.number().optional(),
      highHigh: z.number().optional()
    })
    .optional(),
  baseValue: z.union([z.number(), z.boolean()]).optional(),
  correlationKey: z.string().optional()
});

export const simulatorConfigSchema = z.object({
  name: z.string().min(1),
  seed: z.number().int(),
  updateIntervalMs: z.number().int().min(100),
  faultMode: z.boolean(),
  opcua: z.object({
    port: z.number().int().min(1).max(65535),
    host: z.string().min(1),
    resourcePath: z.string().min(1)
  }),
  topology: z.object({
    areas: z.number().int().min(1).max(100),
    linesPerArea: z.number().int().min(1).max(100),
    machinesPerLine: z.number().int().min(1).max(1000),
    tagsPerMachine: z.number().int().min(1).max(20),
    includeUtilities: z.boolean()
  }),
  tags: z.array(tagSchema).optional()
}) satisfies z.ZodType<SimulatorConfig>;

export class ConfigStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<SimulatorConfig> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return simulatorConfigSchema.parse(JSON.parse(raw));
    } catch (error) {
      if (isNotFound(error)) {
        const config = defaultConfig();
        await this.save(config);
        return config;
      }
      throw error;
    }
  }

  async save(config: SimulatorConfig): Promise<SimulatorConfig> {
    const parsed = simulatorConfigSchema.parse(config);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    return parsed;
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export function resolveConfigPath(): string {
  return process.env.TWYNIX_CONFIG_PATH ?? path.resolve(process.cwd(), "config/runtime.json");
}
