# TwynIX OPC UA Simulator

TwynIX OPC UA Simulator is a TypeScript Node.js OPC UA server simulator for IIOT testbeds. It exposes a realistic plant hierarchy, updates simulated values every second by default, serves a small web configuration UI, and persists configuration as JSON.

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Web UI:

```text
http://localhost:3000
```

Default OPC UA endpoint:

```text
opc.tcp://localhost:4840/twynix/server
```

The server binds OPC UA to `0.0.0.0:4840` by default. Anonymous/no-credential OPC UA client connections are enabled for v1.

## Run With Docker

```bash
docker compose up --build
```

Published ports:

```text
3000/tcp web UI and REST API
4840/tcp OPC UA
```

## UaExpert Connection

1. Start the simulator.
2. Open UaExpert.
3. Add a server with endpoint `opc.tcp://localhost:4840/twynix/server`.
4. Use anonymous authentication.
5. Browse `Objects -> Plant -> Area -> Line -> Machine`.

Each process tag also exposes deterministic alarm companion variables such as `_AlarmActive` and `_AlarmSeverity`.

## Configuration

Runtime configuration is stored at:

```text
config/runtime.json
```

On first run it is created from the built-in default. An example is available at:

```text
config/example.config.json
```

You can change topology, update interval, seed, OPC UA port, and fault mode from the web UI. The UI also supports JSON export and import.

For custom tag names, ranges, simulation modes, and alarm thresholds, import a config with a `tags` array. When `tags` is omitted, TwynIX generates a synthetic plant from the topology settings.

## REST API

```text
GET  /api/config
PUT  /api/config
POST /api/simulator/start
POST /api/simulator/stop
POST /api/simulator/restart
GET  /api/tags
GET  /api/tags/:id
GET  /api/status
POST /api/config/export
POST /api/config/import
```

## Simulation Model

The default factory includes:

- 4 areas
- 5 lines per area
- 10 machines per line
- 5 tags per machine
- Shared utility systems for compressor, boiler, cooling water, main power, and storage tanks

Supported tag kinds include temperature, pressure, flow, level, speed, vibration, current, voltage, motor running state, valve position, alarm state, production counter, and quality reject counter.

Supported modes include constant, random, sine, drift, step, noisy, correlated, and fault. When a seed is configured, generated values are deterministic across runs with the same configuration.

## Development

```bash
npm run typecheck
npm test
npm run build
```

## Known Limitations

- No authentication or OPC UA user management in v1.
- Alarms are modeled as companion variables, not full OPC UA AlarmCondition event types.
- Configuration persists to JSON files only.
- The web UI focuses on common topology/runtime settings; detailed per-tag editing is done by JSON import.
- No bundled real industrial dataset. The default dataset is synthetic and generated locally.
