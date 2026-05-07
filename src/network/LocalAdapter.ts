import { type INetworkAdapter, type NetworkMessage, PROTOCOL_VERSION } from '../types';

/**
 * No-op network adapter for singleplayer. Reports `connected = true` after `connect()`,
 * silently swallows sends, never delivers inbound messages.
 *
 * Useful as a default in code paths that need an adapter unconditionally.
 */
export class LocalAdapter implements INetworkAdapter {
  private _connected = false;
  private handlers = new Set<(msg: NetworkMessage) => void>();

  get connected(): boolean { return this._connected; }

  async connect(): Promise<void> { this._connected = true; }
  disconnect(): void { this._connected = false; this.handlers.clear(); }
  send(_msg: NetworkMessage): void { /* no-op */ }

  onMessage(handler: (msg: NetworkMessage) => void): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  /** Test/dev helper: synthesize an inbound message. Not part of INetworkAdapter. */
  _emit(msg: NetworkMessage): void {
    for (const h of this.handlers) {
      try { h(msg); } catch (err) { console.error('LocalAdapter handler error', err); }
    }
  }
}

/** Re-export for callers that want to assert protocol compatibility. */
export { PROTOCOL_VERSION };
