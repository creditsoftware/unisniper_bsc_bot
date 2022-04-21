// Enter the ETH amount to use 
const ETH_AMOUNT_TO_BUY = 0.0001 * 10 ** 18

// Enter the tokens to monitor so that the bot can buy them
const TOKENS_TO_MONITOR = [
    "",
    "",
    "",
]

const DEFAULT_GAS_LIMIT = 1000000
const ADDITIONAL_SELL_GAS = 10 * 10 ** 9;
const TRIAL_TIME_CAP = 10000
const NO_OF_BUYS = 1
const ADDITIONAL_BUY_GAS = 2 * 10 ** 9;

export { NO_OF_BUYS, TRIAL_TIME_CAP, TOKENS_TO_MONITOR, ETH_AMOUNT_TO_BUY, DEFAULT_GAS_LIMIT, ADDITIONAL_SELL_GAS, ADDITIONAL_BUY_GAS }