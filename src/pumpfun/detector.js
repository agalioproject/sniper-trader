const WebSocket = require('ws');
const { HELIUS_WSS_URL } = require('../config');
const { getConnection } = require('../solana/wallet');
const runtime = require('../live/runtime');
const { LAUNCHPADS, matchLaunchpad, enabledLaunchpads } = require('./launchpads');
const { getConfig } = require('../live/liveConfig');

const STALL_MS = Number(process.env.DETECTOR_STALL_MS || 60000);
const CONNECT_TIMEOUT_MS = 30000;

async function resolveLaunchedMint(signature) {
  const connection = getConnection();
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: 'confirmed',
  });
  if (!tx || !tx.meta) return null;

  const preMints = new Set((tx.meta.preTokenBalances || []).map((b) => b.mint));
  const postMints = (tx.meta.postTokenBalances || []).map((b) => b.mint);
  const newMint = postMints.find((m) => !preMints.has(m));
  return newMint || null;
}

/**
 * Subscribes to logs on every known launchpad program (pump.fun, LaunchLab/LetsBonk,
 * Meteora DBC/Believe, Moonshot, Boop). One WS, multiple logsSubscribe.
 */
class PumpFunDetector {
  constructor(onLaunch) {
    this.onLaunch = onLaunch;
    this.ws = null;
    this.reconnectDelayMs = 1000;
    this.lastMsgAt = Date.now();
    this.connectStartedAt = Date.now();
    this.watchdog = null;
    this.subIdToProgram = new Map(); // rpc id -> programId
    this.nextSubId = 1;
  }

  startWatchdog() {
    if (this.watchdog) return;
    this.watchdog = setInterval(() => {
      const ws = this.ws;
      if (!ws) return;
      const silentFor = Date.now() - this.lastMsgAt;
      const stalledOpen = ws.readyState === WebSocket.OPEN && silentFor > STALL_MS;
      const stuckConnecting =
        ws.readyState === WebSocket.CONNECTING && Date.now() - this.connectStartedAt > CONNECT_TIMEOUT_MS;
      if (!stalledOpen && !stuckConnecting) return;

      console.warn(
        `[launchpad-detector] feed stalled (${Math.round(silentFor / 1000)}s silence) — forcing reconnect`
      );
      runtime.setDetector('solana', 'stalled');
      try {
        require('../telegram/bot').notify('⚠️ Solana multi-launchpad feed silent — reconnecting.');
      } catch (_) {
        /* telegram optional */
      }
      this.lastMsgAt = Date.now();
      try {
        ws.terminate();
      } catch (_) {
        /* ignore */
      }
    }, Math.min(15000, Math.max(1000, STALL_MS / 4)));
  }

  start() {
    runtime.setDetector('solana', 'connecting');
    this.connectStartedAt = Date.now();
    this.lastMsgAt = Date.now();
    this.subIdToProgram.clear();
    this.nextSubId = 1;
    this.ws = new WebSocket(HELIUS_WSS_URL);
    this.startWatchdog();

    this.ws.on('open', () => {
      const pads = enabledLaunchpads(getConfig());
      const names = pads.map((p) => p.name).join(', ') || '(none enabled)';
      console.log(`[launchpad-detector] connected — subscribing to: ${names}`);
      runtime.setDetector('solana', 'connected');
      this.lastMsgAt = Date.now();
      this.reconnectDelayMs = 1000;

      for (const pad of pads) {
        const id = this.nextSubId++;
        this.subIdToProgram.set(id, pad.programId);
        this.ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            method: 'logsSubscribe',
            params: [{ mentions: [pad.programId] }, { commitment: 'confirmed' }],
          })
        );
      }
    });

    this.ws.on('message', (raw) => {
      this.lastMsgAt = Date.now();
      runtime.touch('solana');
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // subscription ack
      if (msg.id && msg.result != null && this.subIdToProgram.has(msg.id)) {
        return;
      }

      if (msg.method !== 'logsNotification') return;

      const result = msg.params && msg.params.result;
      const logs = result && result.value && result.value.logs;
      const signature = result && result.value && result.value.signature;
      if (!logs || !signature) return;

      // Identify which program this notification is for from subscription
      const sub = msg.params && msg.params.subscription;
      // We may not have sub->program map from server; scan logs for known program mentions is hard.
      // Match create hints against ALL pads — first match wins.
      const active = enabledLaunchpads(getConfig());
      let pad = null;
      for (const candidate of active) {
        pad = matchLaunchpad(logs, candidate.programId);
        if (pad) break;
      }
      // If no create-like instruction, skip (trade noise)
      if (!pad) {
        const looksCreate = logs.some((l) =>
          /Instruction:\s*(Create|CreateV2|Initialize|InitializeV2|TokenMint)/i.test(String(l))
        );
        if (!looksCreate) return;
        pad = { id: 'unknown', name: 'unknown launchpad', programId: null };
      }

      this.handleLaunch(signature, pad).catch((err) =>
        console.error(`[launchpad-detector] onLaunch failed (${pad.name}):`, err.message)
      );
    });

    this.ws.on('close', () => {
      console.warn('[launchpad-detector] disconnected, reconnecting...');
      runtime.setDetector('solana', 'reconnecting');
      setTimeout(() => this.start(), this.reconnectDelayMs);
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 30000);
    });

    this.ws.on('error', (err) => {
      console.error('[launchpad-detector] websocket error:', err.message);
    });
  }

  async handleLaunch(signature, pad) {
    const mint = await resolveLaunchedMint(signature);
    if (!mint) {
      console.warn(`[launchpad-detector] could not resolve mint for ${signature} (${pad.name})`);
      return;
    }
    console.log(`[launchpad-detector] new token on ${pad.name}: ${mint}`);
    await this.onLaunch({ signature, mint, launchpad: pad.id, launchpadName: pad.name });
  }
}

module.exports = { PumpFunDetector, resolveLaunchedMint };
