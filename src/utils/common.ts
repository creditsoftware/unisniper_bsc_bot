import { readFileSync } from "fs";
import Web3 from "web3";
import { ethers } from "ethers";
import { ChainId, Token } from "@uniswap/sdk";
import axios from "axios";

const provider = ethers.getDefaultProvider(process.env.JSON_RPC!);
const web3 = new Web3(process.env.JSON_RPC!)

let walletAddress = ethers.utils.getAddress(process.env.WALLET_ADDRESS!)

//reading data from the uniswap ABI
var tokenABI = JSON.parse(
    readFileSync(`src/utils/abiPancakeswap.json`, "utf8")
);


function toHex(currencyAmount: any) {
    if (currencyAmount.toString().includes("e")) {
        let hexedAmount = (currencyAmount).toString(16)

        return `0x${hexedAmount}`
    } else {
        let parsedAmount = parseInt(currencyAmount)
        let hexedAmount = (parsedAmount).toString(16)
        return `0x${hexedAmount}`
    }
}



const tokenBalance = async (tokenAddress: string, walletAddress: string) => {
    try {
        const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);

        return await tokenContract.methods.balanceOf(walletAddress).call();
    } catch (error) {
        console.log("Error getting token balance ", error);
    }
};


const getTokensInWallet = async (token: string) => {

    const contract = new web3.eth.Contract(tokenABI, token)

    const tokenBalance = await contract.methods.balanceOf(process.env.WALLET_ADDRESS!).call()

    return tokenBalance


}


const getTokenBalance = async (tokenAddress: string) => {
    try {
        const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);

        return await tokenContract.methods
            .balanceOf(process.env.WALLET_ADDRESS)
            .call();
    } catch (error) {
        console.log("Error getting token balance ", error);
    }
};

const walletNonce = async () => {
    try {
        let nonce = await web3.eth.getTransactionCount(walletAddress)

        if (nonce) {
            return nonce
        } else {
            let nonce = await web3.eth.getTransactionCount(walletAddress)
            return nonce
        }

    } catch (error) {
        console.log("Error fetching Wallet nonce ", error)
    }
}


const wait = async (ms: number) => {
    console.log("\n\n Waiting ... \n\n")
    return new Promise(resolve => setTimeout(resolve, ms));
}

const botParams = {
    uniswapv2Router: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    wethAddress: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    wethToken: new Token(
        56,
        "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        18
    ),
};


/**
 * Fetch wallet nonce
 * @param walletAddres The wallet address to fetch nonce value
 * @returns Nonce of a wallet
 */
const getWalletNonce = async (walletAddres: string) => {
    try {
        const nonce = await provider.getTransactionCount(walletAddres, "pending");
        return nonce;
    } catch (error) {
        console.log("Error getting wallet nonce ", error);
    }
};


const getTokenDecimals = async (tokenAddress: string) => {
    try {
        //console.log("\n\n\n\n\n\nTokens ", tokenAddress)
        const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
        return await tokenContract.methods.decimals().call();
    } catch (error) {
        //console.log("Error fetching token decimals ", error);
    }
};


const sleep = async (seconds: number) => {
    let ms = seconds * 1e3
    return new Promise(resolve => setTimeout(resolve, ms));
}

const verifyTokens = async (tokenAddress: any) => {
    let { data } = await axios({
        method: 'get',
        url: `https://honeypot.api.rugdoc.io/api/honeypotStatus.js?address=${tokenAddress}&chain=eth`
    });
    if (data.status == "1") {
        return tokenAddress
    }
}

export { verifyTokens, sleep, getTokenDecimals, getWalletNonce, botParams, provider, toHex, tokenBalance, walletNonce, wait, getTokensInWallet, getTokenBalance }