import {
  DataType,
  MessageSecurityMode,
  OPCUAServer,
  SecurityPolicy,
  Variant,
  type UAObject,
  type UAVariable
} from "node-opcua";
import type { RuntimeTag, SimulatorConfig } from "../domain/types.js";
import { logger } from "../domain/logger.js";
import type { SimulationEngine } from "../simulation/simulationEngine.js";

const MINIMUM_SAMPLING_INTERVAL_MS = 1000;

export class TwynixOpcUaServer {
  private server?: OPCUAServer;
  private variables = new Map<string, UAVariable>();

  constructor(private readonly engine: SimulationEngine) {}

  async start(config: SimulatorConfig): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = new OPCUAServer({
      port: config.opcua.port,
      host: config.opcua.host,
      hostname: endpointHostname(config),
      advertisedEndpoints: config.opcua.advertisedEndpointUrl,
      resourcePath: config.opcua.resourcePath,
      allowAnonymous: true,
      securityModes: [MessageSecurityMode.None],
      securityPolicies: [SecurityPolicy.None],
      buildInfo: {
        productName: "TwynIX OPC UA Simulator",
        buildNumber: "1",
        buildDate: new Date()
      }
    });

    await this.server.initialize();
    this.buildAddressSpace(this.engine.getTags());
    await this.server.start();
    this.engine.setConnectedOpcUaClients(this.getConnectedClientCount());
    logger.info({ endpoint: this.getEndpointUrl() }, "OPC UA server started");
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    const server = this.server;
    this.server = undefined;
    this.variables.clear();
    await server.shutdown(1000);
    this.engine.setConnectedOpcUaClients(0);
    logger.info("OPC UA server stopped");
  }

  async restart(config: SimulatorConfig): Promise<void> {
    await this.stop();
    await this.start(config);
  }

  getEndpointUrl(): string {
    const endpointUrl = this.server?.endpoints[0]?.endpointDescriptions()[0]?.endpointUrl;
    if (endpointUrl) {
      return endpointUrl;
    }
    return "opc.tcp://0.0.0.0:4840/twynix/server";
  }

  getConnectedClientCount(): number {
    return this.server?.currentSessionCount ?? 0;
  }

  refreshClientMetric(): void {
    this.engine.setConnectedOpcUaClients(this.getConnectedClientCount());
  }

  private buildAddressSpace(tags: RuntimeTag[]): void {
    if (!this.server?.engine.addressSpace) {
      throw new Error("OPC UA address space is not initialized");
    }

    const addressSpace = this.server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();
    const objects = addressSpace.rootFolder.objects;
    const folders = new Map<string, UAObject>();

    for (const tag of tags) {
      let parent: UAObject = objects;
      let key = "";
      for (const part of tag.browsePath) {
        key = key ? `${key}/${part}` : part;
        let folder = folders.get(key);
        if (!folder) {
          folder = namespace.addFolder(parent, { browseName: part });
          folders.set(key, folder);
        }
        parent = folder;
      }

      const variable = namespace.addVariable({
        componentOf: parent,
        browseName: tag.name,
        nodeId: `s=${tag.id}`,
        dataType: toOpcUaDataType(tag.dataType),
        minimumSamplingInterval: MINIMUM_SAMPLING_INTERVAL_MS,
        value: {
          get: () => {
            const current = this.engine.getTag(tag.id);
            return new Variant({
              dataType: toOpcUaVariantDataType(tag.dataType),
              value: current?.value ?? tag.value
            });
          }
        }
      });
      this.variables.set(tag.id, variable);

      namespace.addVariable({
        componentOf: parent,
        browseName: `${tag.name}_AlarmActive`,
        nodeId: `s=${tag.id}.AlarmActive`,
        dataType: "Boolean",
        minimumSamplingInterval: MINIMUM_SAMPLING_INTERVAL_MS,
        value: {
          get: () => new Variant({ dataType: DataType.Boolean, value: this.engine.getTag(tag.id)?.alarm.active ?? false })
        }
      });

      namespace.addVariable({
        componentOf: parent,
        browseName: `${tag.name}_AlarmSeverity`,
        nodeId: `s=${tag.id}.AlarmSeverity`,
        dataType: "Int32",
        minimumSamplingInterval: MINIMUM_SAMPLING_INTERVAL_MS,
        value: {
          get: () => new Variant({ dataType: DataType.Int32, value: this.engine.getTag(tag.id)?.alarm.severity ?? 0 })
        }
      });
    }
  }
}

function toOpcUaDataType(type: RuntimeTag["dataType"]): string {
  switch (type) {
    case "Boolean":
      return "Boolean";
    case "Int32":
      return "Int32";
    case "Double":
      return "Double";
  }
}

function endpointHostname(config: SimulatorConfig): string {
  if (!config.opcua.advertisedEndpointUrl) {
    return config.opcua.host;
  }
  return new URL(config.opcua.advertisedEndpointUrl).hostname;
}

function toOpcUaVariantDataType(type: RuntimeTag["dataType"]): DataType {
  switch (type) {
    case "Boolean":
      return DataType.Boolean;
    case "Int32":
      return DataType.Int32;
    case "Double":
      return DataType.Double;
  }
}
