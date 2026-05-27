import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { createApiRouter } from "../api/routes.js";
import type { ConfigStore } from "../config/configStore.js";
import type { SimulatorConfig } from "../domain/types.js";
import { logger } from "../domain/logger.js";
import type { SimulationEngine } from "../simulation/simulationEngine.js";
import type { TwynixOpcUaServer } from "../opcua/opcUaServer.js";
import { webHtml } from "./webHtml.js";

interface WebServerDependencies {
  configStore: ConfigStore;
  engine: SimulationEngine;
  opcuaServer: TwynixOpcUaServer;
  getConfig: () => SimulatorConfig;
  setConfig: (config: SimulatorConfig) => void;
}

export function createWebServer(deps: WebServerDependencies): express.Express {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use(pinoHttp({ logger }));
  app.use("/api", createApiRouter(deps));
  app.get("/", (_req, res) => res.type("html").send(webHtml));
  return app;
}
