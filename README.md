# stacks-rpc-proxy

A Node.js based proxy for the `stacks-node`, designed to provide a host of features and improvements over the traditional `stacks-node` HTTP server. The proxy is dockerized for ease of deployment and management.

## Getting Started

Pull the Docker image:

```sh
docker pull hirosystems/stacks-rpc-proxy
```

## Features

- **CORS Support:** Handles CORS requests on behalf of the `stacks-node`, a feature that is not fully supported in their HTTP server.
- **Custom Regex-Path Based Cache-Control:** Allows custom, path-dependent caching strategies.
- **Transaction POST Multicast Support:** Enables sending the same transaction to multiple endpoints.
- **Prometheus Metrics:** Integration with Prometheus for robust monitoring.

## Implementation

- **Fastify:** Uses Fastify for routing and proxying.
- **Undici:** Uses undici, the latest and much-improved Node.js HTTP client, for proxy requests.
- **Pino Logging:** Includes comprehensive HTTP request logging using Pino.

## Configuration

The following environment variables are especially important in order to establish a connection to the upstream `stacks-node`:

- `STACKS_CORE_PROXY_HOST`: The hostname for the upstream `stacks-node`.
- `STACKS_CORE_PROXY_PORT`: The port for the upstream `stacks-node`.

Here are the possible configuration environment varialbles:
- `STACKS_CORE_PROXY_HOST`: The hostname for the upstream `stacks-node`. This is required.
- `STACKS_CORE_PROXY_PORT`: The port for the upstream `stacks-node`. This is required.
- `NODE_ENV`: The current environment mode. Accepts an Enum of Node Environment values. Defaults to 'production'.
- `LOG_LEVEL`: Controls the level of log verbosity. Defaults to 'debug'.
- `RPC_PROXY_HOST`: The hostname where the RPC Proxy will listen. Defaults to '0.0.0.0'.
- `RPC_PROXY_PORT`: The port on which the RPC Proxy will listen. Defaults to 5444.
- `STACKS_API_PROXY_CACHE_CONTROL_FILE`: (Optional) Path to a JSON file containing cache-control configuration for paths.
- `STACKS_API_EXTRA_TX_ENDPOINTS_FILE`: (Optional) Additional `stacks-node` endpoints to POST transactions to.
- `MAX_REQUEST_BODY_SIZE`: Max HTTP request body content size in bytes. Defaults to 2MB.
- `PROMETHEUS_HOST`: The host on which Prometheus will run. Defaults to '0.0.0.0'.
- `PROMETHEUS_PORT`: The port on which Prometheus will run. Defaults to 9153.
- `LOG_RESPONSES`: (Optional) Flag to print upstream response bodies. This increases memory and CPU usage and should only be used for debugging. Defaults to false.
- `LOG_REQUESTS`: (Optional) Flag to print request bodies. This increases memory and CPU usage and should only be used for debugging. Defaults to false.
