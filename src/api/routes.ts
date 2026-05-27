import { Router, type Request, type Response } from "express";
import { ZodError } from "zod";
import { simulatorConfigSchema, type ConfigStore } from "../config/configStore.js";
import type { SimulatorConfig } from "../domain/types.js";
import type { SimulationEngine } from "../simulation/simulationEngine.js";
import type { TwynixOpcUaServer } from "../opcua/opcUaServer.js";

interface ApiDependencies {
  configStore: ConfigStore;
  engine: SimulationEngine;
  opcuaServer: TwynixOpcUaServer;
  getConfig: () => SimulatorConfig;
  setConfig: (config: SimulatorConfig) => void;
}

export function createApiRouter(deps: ApiDependencies): Router {
  const router = Router();

  router.get("/config", (_req, res) => {
    res.json(deps.getConfig());
  });

  router.put("/config", async (req, res, next) => {
    try {
      const config = simulatorConfigSchema.parse(req.body);
      await deps.configStore.save(config);
      deps.setConfig(config);
      deps.engine.reset(config);
      res.json(config);
    } catch (error) {
      next(error);
    }
  });

  router.post("/simulator/start", async (_req, res, next) => {
    try {
      deps.engine.start();
      await deps.opcuaServer.start(deps.getConfig());
      res.json({ running: true, endpointUrl: deps.opcuaServer.getEndpointUrl() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/simulator/stop", async (_req, res, next) => {
    try {
      deps.engine.stop();
      await deps.opcuaServer.stop();
      res.json({ running: false });
    } catch (error) {
      next(error);
    }
  });

  router.post("/simulator/restart", async (_req, res, next) => {
    try {
      deps.engine.reset(deps.getConfig());
      deps.engine.start();
      await deps.opcuaServer.restart(deps.getConfig());
      res.json({ running: true, endpointUrl: deps.opcuaServer.getEndpointUrl() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/tags", (_req, res) => {
    res.json(deps.engine.getTags());
  });

  router.get("/tags/:id", (req, res) => {
    const tag = deps.engine.getTag(req.params.id);
    if (!tag) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    res.json(tag);
  });

  router.get("/status", (_req, res) => {
    deps.opcuaServer.refreshClientMetric();
    res.json({
      metrics: deps.engine.getMetrics(),
      endpointUrl: deps.opcuaServer.getEndpointUrl()
    });
  });

  router.post("/config/export", (_req, res) => {
    res.setHeader("Content-Disposition", "attachment; filename=twynix-config.json");
    res.json(deps.getConfig());
  });

  router.post("/config/import", async (req, res, next) => {
    try {
      const config = simulatorConfigSchema.parse(req.body);
      await deps.configStore.save(config);
      deps.setConfig(config);
      deps.engine.reset(config);
      res.json(config);
    } catch (error) {
      next(error);
    }
  });

  router.use((error: unknown, _req: Request, res: Response, _next: () => void) => {
    if (error instanceof ZodError) {
      res.status(400).json({ error: "Invalid configuration", details: error.flatten() });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected server error" });
  });

  return router;
}
