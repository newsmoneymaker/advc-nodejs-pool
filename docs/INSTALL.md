# Installing an AdventureCoin (ADVC) pool

Paths below are examples: the pool in `/opt/advc-nodejs-pool`, the node and its data in `/opt/advc`, all run by the user `advcpool`
(the systemd templates in `deployment/systemd/` use these paths).

## 1. AdventureCoin node and wallet

AdventureCoin Core (`https://github.com/AdventureCoin-ADVC/AdventureCoin`, MIT) is a Bitcoin Core fork (autotools build, `depends/` for a reproducible toolchain). It built
cleanly with this host's own GCC 8.3 -- no modern-toolchain workaround was needed.

```
git clone https://github.com/AdventureCoin-ADVC/AdventureCoin && cd AdventureCoin
# build dependencies: curl build-essential libtool autotools-dev automake pkg-config python3 bsdmainutils patch bison xz-utils unzip p7zip-full
make -C depends NO_QT=1 NO_UPNP=1 NO_ZMQ=1 -j4
./autogen.sh
CONFIG_SITE=$PWD/depends/x86_64-pc-linux-gnu/share/config.site ./configure --disable-tests --disable-bench --without-gui
make -j4                                                    # src/adventurecoind, src/adventurecoin-cli
```

**Note:** the `depends/config.guess` and `depends/config.sub` scripts in a fresh clone of this repo can lose their executable bit (seen on a real build, 2026-11-10) -- if
`make -C depends` fails with `Makefile:NN: builders/.mk: No such file or directory` / `No rule to make target 'builders/.mk'`, run `chmod +x depends/config.guess
depends/config.sub` first.

`/opt/advc/data/adventurecoin.conf`:

```
server=1
listen=1
daemon=0
rpcuser=advcpool
rpcpassword=<a long random password>
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcport=9982
port=5403
wallet=pool
```

**Real seed nodes exist in the node's own source** (`seed.adventurecoin.quest` plus 5 hardcoded IPs, `src/chainparams.cpp`), so a normal sync from genesis should work --
no snapshot is published. **Known real-world caveat (2026-11-10): at the time this pool was built, none of those seed nodes answered on their P2P port (5403) from this
project's own servers** (confirmed both via the daemon's own `connect()` failures in `debug.log` and by direct TCP probes to several unrelated ports on the same hosts) --
the daemon was left running under supervision to keep retrying; if this persists, ask the AdventureCoin community/Discord for a currently-reachable peer IP and `addnode` it
manually. Wallet creation and address generation do **not** need any chain sync (pure local key generation) and can be done immediately.

The default wallet of the node is the pool wallet:

```
adventurecoin-cli getnewaddress "pool"          # A... : the pool address (poolServer.poolAddress)
adventurecoin-cli dumpwallet /safe/place/advc-wallet-dump.txt   # the private keys (incl. the HD "extended private masterkey"): keep it offline, chmod 600
```

The wallet is HD (BIP32): the `dumpwallet` output's `# extended private masterkey:` line alone is enough to recover every address the wallet will ever generate.

**Developer fee (real, mandatory, consensus-level -- NOT this pool's own optional donation feature below).** From height 1 onward, `ConnectBlock` requires the coinbase's
SECOND output (`vout[1]`, by exact index) to pay a fixed address (`AeD4pPi3D5kB9aMEgH3eRHoD6XMKbrpRAW`) exactly 10% of that block's subsidy (not 10% of the miner's total
reward, and not of transaction fees). `lib/blockBuilder.js`'s `buildCoinbase` computes and places this independently of the template (see `lib/reward.js`); getting this
wrong means every block the pool finds is rejected outright by the real node.

## 2. yespowerADVC helper

The helper (`hasher/yphash`) is a tiny C program around the yespower sources of the node itself (`hasher/yespower-advc`, BSD license, vendored directly from
`src/crypto/yespower/`): `cd hasher && make` (needs only a C compiler; `STATIC=-static` for a binary that runs anywhere). Check it against the chain: `node
test/test-real-blocks.js` (ships with the real genesis block as a vector; add more real blocks to `test/real-blocks.json` once the node has synced past them).

## 3. Redis

Use a dedicated instance with a password and AOF (`deployment/redis-pool.conf.example`, unit `advc-pool-redis`, port 6408).

## 4. The pool

```
cd /opt/advc-nodejs-pool && npm install --production
cp config_examples/advc.json config.json      # then edit it
```

Edit `config.json`: `poolHost`, `poolServer.poolAddress` (the wallet address of step 1), the ports and the certificate for TLS (`poolServer.sslCert/sslKey`), `redis`,
`api.password`, `node.password` or `node.passwordFile`, `blockUnlocker.poolFee` and `donations`, `payments`. **Keep `payments.dryRun: true` until the rehearsal below.** If
the node runs on a different host than the pool (this project's own deployment: node on a separate server, pool reaching it over an SSH local-forward tunnel), point
`node.host`/`node.port` at the tunnel's local end, not at the node directly.

```
cp deployment/systemd/*.service /etc/systemd/system/ && systemctl daemon-reload
systemctl enable --now advc-pool-redis advc-node
systemctl enable --now advc-pool advc-pool-api advc-pool-unlocker advc-pool-payments advc-pool-charts
```

The pool runs as separate modules (`init.js -module=pool|api|unlocker|payments|chartsDataCollector`), each in its own unit. Until payouts are proven, restrict the stratum
ports with `poolServer.allowIPs`. Point a miner at it: `poolpayminer -a yespower-advc -o your.pool:5500 -u <an A... address> -p x`.

## 5. Website

Copy `website_example/` to the web root, set `poolHost`, the contact and links in `config.js`, and proxy `/api` to the pool API on 127.0.0.1:8150
(`deployment/apache-vhost.conf.example` exposes only the read-only methods).

## 6. Rehearse the payments

1. `payments.dryRun: true`: the log of `advc-pool-payments` shows what would be paid.
2. Fund the pool wallet with a few coins (or wait for the first block), credit a small balance in Redis to your own test addresses (`<coin>:workers:<address>`, field
   `balance`), set `payments.onlyAccounts` to them, `dryRun: false`, and watch the payout confirm.
3. Remove the test accounts from Redis and set `onlyAccounts` to `[]`.

Good to know: ADVC's own `COINBASE_MATURITY` is **30** blocks (about 1.5 hours at the real ~180s block time) -- NOT the standard Bitcoin Core 100;
`deployment/pause-payments.sh` stops new payouts at once; the wallet must stay unlocked and online for the payouts (leave the pool wallet unencrypted with only small
balances in it). Of a block the pool only gets the subsidy minus the real 10% developer fee described in step 1, plus the fees.
