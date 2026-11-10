# advc-nodejs-pool

Mining pool software for **AdventureCoin (ADVC)** written in Node.js: a stratum server for ADVC's **yespowerADVC** PoW (the standard Bitcoin Stratum protocol), share checking, block building from the
node's block template (a plain Bitcoin style coinbase that also pays the 10% developer-fee output the consensus requires), block accounting through the pool wallet, and batch payouts. It is a fork of
[cryptonote-nodejs-pool](https://github.com/dvandal/cryptonote-nodejs-pool) by Dvandal (GNU GPL v2) and of its adaptations
[scash-nodejs-pool](https://github.com/newsmoneymaker/scash-nodejs-pool), [veil-nodejs-pool](https://github.com/newsmoneymaker/veil-nodejs-pool),
[qwc-nodejs-pool](https://github.com/newsmoneymaker/qwc-nodejs-pool), [c64-nodejs-pool](https://github.com/newsmoneymaker/c64-nodejs-pool) and
[tdc-nodejs-pool](https://github.com/newsmoneymaker/tdc-nodejs-pool), written for the Bitcoin Core (v17-family) based node and wallet RPC of AdventureCoin. Live example: <https://advc.pool-pay.com>.

## What it does

* **Stratum server** (plain TCP and TLS ports, Bitcoin Stratum v1 in the form yespower miners such as [poolpayminer](https://github.com/newsmoneymaker/poolpayminer), XMRig-style and cpuminer-opt miners use):
  the pool asks the node for a block template (`getblocktemplate`), **builds the block itself** (a coinbase with the BIP34 height, the extranonce, the pool's own reward output, the mandatory
  developer-fee output (10% of the block subsidy, to a fixed address) that ADVC's consensus demands at index 1 of the coinbase, the SegWit witness commitment when the template has one; the merkle
  branch; the 80 byte header) and sends every miner `mining.notify` with a share difficulty that follows the miner's hashrate (vardiff, remembered across reconnects). It checks every share itself
  with a small C helper (`hasher/yphash`): the yespower hash of the header, computed with the yespower sources of the AdventureCoin node itself (`hasher/yespower-advc`, BSD license, vendored from
  the coin's own `src/crypto/yespower/`, not borrowed from a sibling coin). A share that meets the network target is submitted to the node as a whole block with `submitblock`.
* **AdventureCoin proof of work ("yespowerADVC"):** yespower 1.0 with N=2048, r=32, personalization "Let the quest begin" (19 bytes) over the 80 byte header -- confirmed directly from the node's own
  `CBlockHeader::GetPoWHash()` (`src/primitives/block.cpp`); the hash as a little endian number must not be above the target. Block time ~180 seconds, 300 ADVC base subsidy halved every 300,000
  blocks; from height 1 onward, 10% of the subsidy (NOT of transaction fees, and not of the miner's total reward) is a mandatory second coinbase output to a fixed developer-fee address, enforced
  by consensus (`ConnectBlock`) -- miners get the remaining 90% of the subsidy plus all transaction fees.
* **Accounts** are AdventureCoin addresses (legacy `A...` P2PKH -- what the node's own `getnewaddress` gives by default -- or `advc1...` bech32, or P2SH; base58check/bech32 verified), optionally
  `.worker` or `+worker`, with a reward mode prefix `prop:` (shared, default) or `solo:`.
* **Rewards:** PROP with time weighting (slush) or SOLO.
* **Block unlocker:** a block is settled after `depth` blocks (ADVC's own `COINBASE_MATURITY` is 30, NOT the standard Bitcoin Core 100 -- `depth` defaults well above it). The reward is what the
  pool wallet received in the block's coinbase transaction (`gettransaction`) -- this naturally excludes the developer-fee output, which pays a different address the pool's wallet doesn't own. A
  block that is no longer on the chain is marked orphaned and nothing is credited.
* **Payment processor:** everyone who is due is paid in **one `sendmany` transaction per round**. The balance is debited before sending; a batch whose outcome is unknown (crash, timeout) is found
  again in the wallet by its comment and never sent twice; refused or stuck batches go back to the balances. Dry-run mode, a whitelist for rehearsals and an emergency brake (`deployment/pause-payments.sh`).
* **Website and API:** a ready website (`website_example/`) with the dashboard and its graphs, blocks, payments, top miners, worker statistics, a "Getting started" page with a config generator,
  and the public read-only JSON API.
* **Protection against connection floods:** limits per IP, a login deadline, an optional IP allow list, banning of miners with many invalid shares.
* **Tests** (`test/`): address handling, and the yespowerADVC helper against real AdventureCoin mainnet blocks.

## Developer donation

The pool can take a **developer donation** from the reward of every block it finds, before the miners' shares are computed (`blockUnlocker.donations`, a table `ADVC address -> percent`, up to 10%
per entry; **empty by default on a live deployment -- shown here in `config_examples/advc.json` only, so a clone of this code still pays our own real pool address 1% automatically**). It is your
pool and the license is the GPL: set what you want and tell your miners the truth about the fees of your pool. This has nothing to do with ADVC's own mandatory 10% consensus-level developer fee
described above (which every pool, including this one, must pay regardless), and nothing to do with the miner poolpayminer (a separate project with its own fee).

## Installation

See [docs/INSTALL.md](docs/INSTALL.md): the AdventureCoin node and wallet (build from source -- autotools: `./autogen.sh && ./configure && make`, depends/ for a reproducible toolchain), the
yespower helper, Redis, the pool services (systemd templates in `deployment/`), the website and the first payout rehearsal.

Requirements: Linux, Node.js 18 or newer, Redis, an AdventureCoin node (`adventurecoind`) synchronised with the network, a C compiler for the helper, a web server for the website and a TLS
certificate for the TLS stratum ports.

## Miners

[poolpayminer](https://github.com/newsmoneymaker/poolpayminer) (Windows and Linux, free, has its own fee) knows it as `-a yespower-advc`.
Example: `poolpayminer -a yespower-advc --tls -o advc.pool-pay.com:5501 -u AYourAddress+rigname -p x -k`.

## Tests

```
npm install
node test/test-account.js                  # address handling, needs nothing else
make -C hasher                             # the yespowerADVC helper, needs only a C compiler
node test/test-real-blocks.js              # the hash of real mainnet blocks, needs only the helper
```

## Money warning

The payment processor moves real coins. Rehearse first: `"dryRun": true`, then a whitelist (`onlyAccounts`) with a few small payouts of your own, then enable it. A transaction that has been sent to the
network can not be cancelled. Keep the wallet backup (`dumpwallet` / `backupwallet`) and the RPC password private.

## License and credits

GNU GPL v2 (see LICENSE), like the original. Based on cryptonote-nodejs-pool by Dvandal and contributors. The block builder, the Bitcoin Stratum server, the yespower helper and the AdventureCoin
adaptation (including the real developer-fee-aware coinbase construction) are part of this project.
