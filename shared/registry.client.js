/**
 * Registry Client
 * Every microservice uses this to:
 *  1. Register itself on startup
 *  2. Send heartbeats every 30s
 *  3. Deregister on graceful shutdown
 */
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:3001';
const HEARTBEAT_INTERVAL_MS = 30_000;

class RegistryClient {
  constructor({ name, port, healthPath = '/health' }) {
    this.name = name;
    this.port = port;
    this.host = process.env.SERVICE_HOST || 'localhost';
    this.healthPath = healthPath;
    this.instanceId = `${name}-${uuidv4().slice(0, 8)}`;
    this._heartbeatTimer = null;
    this._isRegistering = false;
  }

  async register() {
    if (this._isRegistering) return;
    this._isRegistering = true;

    const payload = {
      instanceId: this.instanceId,
      name: this.name,
      host: this.host,
      port: this.port,
      healthUrl: `http://${this.host}:${this.port}${this.healthPath}`,
    };

    try {
      await axios.post(`${REGISTRY_URL}/register`, payload, { timeout: 3000 });
      console.log(`[Registry] ✓ Registered "${this.name}" (${this.instanceId}) with registry`);
      this._startHeartbeat();
    } catch (err) {
      console.warn(`[Registry] ⚠ Could not register with registry: ${err.message} (running standalone)`);
    } finally {
      this._isRegistering = false;
    }
  }

  _startHeartbeat() {
    if (this._heartbeatTimer) return;

    this._heartbeatTimer = setInterval(async () => {
      try {
        await axios.put(`${REGISTRY_URL}/heartbeat/${this.instanceId}`, {}, { timeout: 2000 });
      } catch (err) {
        if (err?.response?.status === 404) {
          console.warn(`[Registry] Heartbeat instance not found for ${this.instanceId}; attempting re-registration`);
          await this.register();
        }
        // otherwise silent — registry might be temporarily unavailable
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  async deregister() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    try {
      await axios.delete(`${REGISTRY_URL}/deregister/${this.name}/${this.instanceId}`, { timeout: 2000 });
      console.log(`[Registry] Deregistered "${this.name}"`);
    } catch {
      // silent
    }
  }

  // Graceful shutdown hook
  registerShutdownHook() {
    const shutdown = async () => {
      await this.deregister();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

module.exports = { RegistryClient };
