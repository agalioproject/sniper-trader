/**
 * Known Solana meme launchpad program IDs.
 * LetsBonk / many branded pads run ON Raydium LaunchLab (same program).
 * Believe / others often run ON Meteora DBC.
 *
 * Verify IDs against explorers before relying in production — upgrades happen.
 */
const LAUNCHPADS = [
  {
    id: 'pumpfun',
    name: 'pump.fun',
    programId: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    createLogHints: ['Instruction: Create', 'Instruction: CreateV2'],
  },
  {
    id: 'raydium_launchlab',
    name: 'Raydium LaunchLab / LetsBonk',
    // Official Raydium LaunchLab — powers LetsBonk and other Platform PDAs
    programId: 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj',
    createLogHints: ['Instruction: Initialize', 'Instruction: InitializeV2', 'Instruction: InitializeWithToken2022'],
  },
  {
    id: 'meteora_dbc',
    name: 'Meteora DBC / Believe',
    programId: 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN',
    createLogHints: ['Instruction: InitializeVirtualPool', 'Instruction: initialize_virtual_pool', 'Instruction: Initialize'],
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    programId: 'MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG',
    createLogHints: ['Instruction: TokenMint', 'Instruction: token_mint', 'Instruction: Create'],
  },
  {
    id: 'boop',
    name: 'Boop.fun',
    // Social launchpad; ID truncated in some docs — override via env if needed
    programId: process.env.BOOP_PROGRAM_ID || 'boop8hVGQGqezHQMUMzRQRJ99nCmSP4zjaGE75tfj957',
    createLogHints: ['Instruction: Create', 'Instruction: Initialize'],
  },
];

function allProgramIds() {
  return LAUNCHPADS.map((p) => p.programId);
}

function matchLaunchpad(logs, mentionedProgramId) {
  const byId = LAUNCHPADS.find((p) => p.programId === mentionedProgramId);
  if (!byId) return null;
  const hit = byId.createLogHints.some((h) => logs.some((l) => String(l).includes(h)));
  // Fallback: any "Instruction: Create" style on that program still counts
  if (hit) return byId;
  if (logs.some((l) => /Instruction:\s*(Create|Initialize)/i.test(String(l)))) return byId;
  return null;
}

module.exports = { LAUNCHPADS, allProgramIds, matchLaunchpad };
