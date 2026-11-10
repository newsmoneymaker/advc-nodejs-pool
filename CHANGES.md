# Changes

## 1.0.0

* First release: AdventureCoin (ADVC, yespowerADVC = yespower 1.0 N=2048 r=32, personalization "Let the quest begin") pool, forked from tdc-nodejs-pool (itself derived from
  ytn-nodejs-pool/scash-nodejs-pool/veil-nodejs-pool/qwc-nodejs-pool/epic-nodejs-pool).
* The real consensus PoW parameters were independently re-derived from the node's own `CBlockHeader::GetPoWHash()` (`src/primitives/block.cpp`) -- NOT from the coin's own
  unused `src/crypto/yespower/yespower.c` wrapper, which an earlier research pass wrongly matched to `yespower-r16` (N=4096, r=16, no personalization). They are genuinely
  different: N=2048, r=32, personalization "Let the quest begin" (19 bytes).
* ADVC has a REAL mandatory consensus-level developer fee (UNLIKE Tidecoin/Yenten): 10% of the block subsidy is a required second coinbase output (vout[1], exact value AND
  address, to a fixed address) from height 1 onward. `lib/blockBuilder.js`'s `buildCoinbase` computes this independently from height (`lib/reward.js`'s `subsidyAt`), not by
  trusting the template to break out subsidy vs. fees, and places it at the correct index regardless of whether a witness commitment is also present -- a block missing this
  output, or with it at the wrong index, is rejected outright by the real node ("bad-cb-developer-fee-amount"/"bad-cb-developer-fee-address").
* The pool builds the blocks itself from `getblocktemplate` (called with the segwit rule; `lib/blockBuilder.js`): a coinbase with the BIP34 height, the extranonce, the pool's
  own reward output, the developer-fee output described above, the witness commitment if present), the merkle branch and the 80 byte header; a solved block is sent with
  `submitblock`.
* `lib/pool.js` speaks Bitcoin Stratum v1 (prevhash with every 4 byte word reversed, version / ntime / nbits big endian, the nonce as the hex of the number, extranonce1 of
  4 bytes and extranonce2 of 4 bytes). Job ids are per miner (`<job>.<n>`) and carry the difficulty of that miner: the miner applies a new difficulty with its next job.
* `hasher/yphash` is a small C program around the yespower sources of the AdventureCoin node itself (`hasher/yespower-advc`, BSD license, vendored directly from ADVC's own
  `src/crypto/yespower/`, not borrowed from a sibling coin): `make -C hasher`, no other dependency.
* Payments and unlocker as in Bitcoin based pools (`sendmany`, `gettransaction`); ADVC's own `COINBASE_MATURITY` is 30 (NOT the standard Bitcoin Core 100); base58 addresses
  (`A...` P2PKH -- the node's own default, confirmed via `OUTPUT_TYPE_DEFAULT = OUTPUT_TYPE_LEGACY` -- or `5...` P2SH), bech32 (`advc1...`) also accepted.
* The variable difficulty of a worker is remembered across reconnects.
* Tests: address handling (`test/test-account.js`), and the yespowerADVC hash of real mainnet blocks including the genesis block, independently verified to beat its own
  recorded difficulty target (`test/test-real-blocks.js`, `test/real-blocks.json`).
* Not yet checked on a block found on mainnet: the payout with the real wallet (`sendmany`). `payments.dryRun` stays `true` until a real block is found and paid correctly
  end-to-end.
