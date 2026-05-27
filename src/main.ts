import http from "node:http";
import { ConfigStore, resolveConfigPath } from "./config/configStore.js";
import { logger } from "./domain/logger.js";
import type { SimulatorConfig } from "./domain/types.js";
import { TwynixOpcUaServer } from "./opcua/opcUaServer.js";
import { SimulationEngine } from "./simulation/simulationEngine.js";
import { createWebServer } from "./web/webServer.js";

const configStore = new ConfigStore(resolveConfigPath());
let config: SimulatorConfig = await configStore.load();
if (process.env.TWYNIX_OPCUA_ADVERTISED_URL) {
  config = {
    ...config,
    opcua: {
      ...config.opcua,
      advertisedEndpointUrl: process.env.TWYNIX_OPCUA_ADVERTISED_URL
    }
  };
}

const engine = new SimulationEngine(config);
const opcuaServer = new TwynixOpcUaServer(engine);
const webServer = createWebServer({
  configStore,
  engine,
  opcuaServer,
  getConfig: () => config,
  setConfig: (next) => {
    config = next;
  }
});

const httpPort = Number(process.env.PORT ?? 3000);
const httpServer = http.createServer(webServer);

httpServer.listen(httpPort, () => {
  logger.info({ port: httpPort }, "TwynIX web server started");
});

engine.start();
await opcuaServer.start(config);

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down TwynIX simulator");
  engine.stop();
  await opcuaServer.stop();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}
