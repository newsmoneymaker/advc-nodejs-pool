/**
 * Block reward of AdventureCoin (ADVC) mainnet (src/validation.cpp GetBlockSubsidy + src/miner.cpp
 * CreateNewBlock): standard Bitcoin-style halving, 300 ADVC base subsidy, halved every
 * consensus.nSubsidyHalvingInterval = 300000 blocks (chainparams.cpp). UNLIKE Tidecoin/Yenten, ADVC has a
 * REAL mandatory consensus-level developer fee: 10% of the SUBSIDY (not of fees, and not of the miner's
 * total reward) is carved out into a second coinbase output (vout[1]) to a fixed address
 * (AeD4pPi3D5kB9aMEgH3eRHoD6XMKbrpRAW), active from height 1 onward (nDeveloperFeeStart = 1 -- i.e. every
 * real block ever mined on this chain). ConnectBlock enforces vout[1]'s value/address exactly; a pool that
 * builds its own coinbase (see blockBuilder.js) MUST include this output correctly or the node will reject
 * the submitted block outright ("bad-cb-developer-fee-amount"/"bad-cb-developer-fee-address") -- same class
 * of bug as the real KCN/LCN dev-reward incidents, see critical-kcn-lcn-devreward-wrong-value-bug.
 * This function returns the MINER's own net share (subsidy minus the 10% dev fee), excluding transaction
 * fees (which vary block to block and are not part of a static "reward at height" display figure) --
 * mirrors what the pool's wallet actually receives in its own coinbase output.
 * Amounts in atomic units (1 ADVC = 1e8).
 **/
const COIN = 100000000;
const HALVING_INTERVAL = 300000;
const BASE_SUBSIDY = 300 * COIN;
const DEVFEE_PERCENT = 10;
const DEVFEE_START_HEIGHT = 1;

function subsidyAt (height) {
	let halvings = Math.floor(height / HALVING_INTERVAL);
	if (halvings >= 64) return 0;
	// mirrors C++ `nSubsidy >>= halvings` (nSubsidy is a 64 bit integer, BASE_SUBSIDY comfortably fits a JS Number here)
	return Math.floor(BASE_SUBSIDY / Math.pow(2, halvings));
};
exports.subsidyAt = subsidyAt;

exports.minerReward = function (height) {
	if (!(height >= 0)) return 0;
	let subsidy = subsidyAt(height);
	if (height >= DEVFEE_START_HEIGHT) {
		let devFee = Math.floor(subsidy * DEVFEE_PERCENT / 100);
		return subsidy - devFee;
	}
	return subsidy;
};

exports.DEVFEE_PERCENT = DEVFEE_PERCENT;
exports.DEVFEE_START_HEIGHT = DEVFEE_START_HEIGHT;
exports.DEVFEE_ADDRESS = 'AeD4pPi3D5kB9aMEgH3eRHoD6XMKbrpRAW';
exports.DEVFEE_SCRIPT_HEX = '76a914f6167db3b8ee8a9a221965a7da6eddb87485267388ac';
