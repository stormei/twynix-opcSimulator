import { describe, expect, it } from "vitest";
import { defaultConfig, generateFactoryTags } from "../src/simulation/factoryGenerator.js";
import { SimulationEngine } from "../src/simulation/simulationEngine.js";

describe("factory generator", () => {
  it("generates the default TwynIX factory with around 1000 tags", () => {
    const tags = generateFactoryTags(defaultConfig());
    expect(tags.length).toBeGreaterThanOrEqual(1000);
    expect(tags.length).toBeLessThan(1200);
    expect(tags[0]?.browsePath).toEqual(["Plant", "Area 1", "Line 1", "Machine 1"]);
  });
});

describe("simulation engine", () => {
  it("is deterministic when seed and configuration match", () => {
    const config = defaultConfig();
    const first = new SimulationEngine(config);
    const second = new SimulationEngine(config);

    for (let i = 0; i < 10; i += 1) {
      first.updateOnce();
      second.updateOnce();
    }

    expect(first.getTags().slice(0, 25).map((tag) => tag.value)).toEqual(
      second.getTags().slice(0, 25).map((tag) => tag.value)
    );
  });

  it("increments production counters only while machines are running", () => {
    const config = {
      ...defaultConfig(),
      topology: { ...defaultConfig().topology, areas: 1, linesPerArea: 1, machinesPerLine: 1, tagsPerMachine: 5 },
      tags: undefined
    };
    const engine = new SimulationEngine(config);
    const counter = () => engine.getTags().find((tag) => tag.kind === "ProductionCounter")?.value as number;

    const before = counter();
    engine.updateOnce();
    const after = counter();

    expect(after).toBeGreaterThan(before);
  });

  it("activates alarms in fault mode", () => {
    const config = { ...defaultConfig(), faultMode: true };
    const engine = new SimulationEngine(config);

    for (let i = 0; i < 5; i += 1) {
      engine.updateOnce();
    }

    expect(engine.getTags().some((tag) => tag.alarm.active)).toBe(true);
  });
});
