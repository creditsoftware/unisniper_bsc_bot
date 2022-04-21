import {
    ChainId,
    Fetcher,
    Pair,
    Route,
    Token,
    TokenAmount,
    Trade,
    TradeType,
} from "@uniswap/sdk";
import { readFileSync } from "fs";
import Web3 from "web3";
import { botParams, provider } from "../src/utils/common";

if (!process.env.JSON_RPC) {
    throw new Error("JSON_RPC was not provided in .env file");
}

const web3 = new Web3(process.env.JSON_RPC!);

const uniswapABI = JSON.parse(
    readFileSync("src/utils/abiPancakeswap.json", "utf8")
);

/**
 *
 * @param tokenAddress Contract address of the token to check for approved amount
 * @param walletAddress Wallet address to check amount approved
 * @returns The amount of tokens approved in that token
 */
const tokenAllowance = async (tokenAddress: string, walletAddress: string) => {
    try {
        const tokenContract = new web3.eth.Contract(uniswapABI, tokenAddress);
        return await tokenContract.methods
            .allowance(walletAddress, botParams.uniswapv2Router)
            .call();
    } catch (error) {
        console.log("Error fetching the allowance amount ", error);
    }
};

/**
 * Gets the current average gas Price from the network
 * @returns gasPrice
 */
const fetchgasPrice = async () => {
    try {
        let gasPrice = await provider.getGasPrice();
        return parseInt(gasPrice._hex, 16);
    } catch (error) {
        console.log("Error fetching gas Price ", error);
    }
};
/**
 * This function gets a pair of the token which takes two params: token $$ tokenDecimals
 * @param token 
 * @param tokenDecimals 
 * @returns 
 */
const getTokenPair = async (token: string, tokenDecimals: number) => {
    let newToken = new Token(ChainId.RINKEBY, token, tokenDecimals);

    const pair = await Fetcher.fetchPairData(
        newToken,
        botParams.wethToken,
        provider
    );

    return pair;
};

/**
 * This function Gets the trade and takes in two params: pair && tokenAmount
 * @param pair 
 * @param tokenAmount 
 * @returns 
 */
const getTrade = (pair: Pair, tokenAmount: number) => {
    const route = new Route([pair], botParams.wethToken);

    let trade = new Trade(
        route,
        new TokenAmount(botParams.wethToken, tokenAmount.toString()),
        TradeType.EXACT_INPUT
    );

    return trade;
};

export { tokenAllowance, getTrade, getTokenPair, fetchgasPrice };
