
import WebSocket from "ws";

import { ETH_AMOUNT_TO_BUY, TOKENS_TO_MONITOR, DEFAULT_GAS_LIMIT, NO_OF_BUYS, ADDITIONAL_BUY_GAS } from "../src/utils/config";
import {
    swapExactTokensForETHSupportingFeeOnTransferTokens,
    approve, swapExactETHForTokens
} from "../src/utils/uniswap";
import { getTokenBalance, provider, sleep, wait, walletNonce } from "./utils/common";
import { readFileSync } from "fs";
import { ethers } from "ethers";
import { sendNotification } from "./utils/telegram";

const WETH_ADDRESS = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c".toLowerCase()
const BLOXROUTE_WS = process.env.WS_BLOXROUTE!;

const UNISWAP_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E".toLowerCase()

function subscribe() {
    ws.send(
        `{"jsonrpc": "2.0", "id": 1, "method": "subscribe", "params": ["newTxs", {"duplicates":false,"include": ["tx_hash", "tx_contents.to", "tx_contents.from", "tx_contents.value", "tx_contents.gas_price", "tx_contents.gas","tx_contents.max_priority_fee_per_gas", "tx_contents.max_fee_per_gas", "tx_contents.input"],"filters":"method_id in [f305d719,e8e33700,7ff36ab5, a9b70727,e8078d94,c9567bf9,293230b8,01339c21,8a8c523c]", "blockchain_network": "BSC-Mainnet"}]}`
    );
}

const openWebsocketConnection = () => {

    console.log("Creating a connection ...")

    const ws = new WebSocket(
        BLOXROUTE_WS,
        {
            headers: {
                "Authorization": process.env.BLOXROUTE_AUTHORIZATION_HEADER!
            },
            rejectUnauthorized: false,
        }
    );

    return ws;
};

let ws = openWebsocketConnection();

var abi = JSON.parse(
    readFileSync(`${__dirname}/utils/abiPancakeswap.json`, "utf8")
);


const LIQUIDITY_METHODS: string[] = [
    "a9b70727",
    "e8078d94",//addLiquidity()
    "c9567bf9",//openTrading()
    "293230b8",//startTrading()
    "8a8c523c",// enableTrading()
    "0bd05b69",// activateTrading()
    "01339c21",//aunch()
    "58780a82",// SetupEnableTrading()
    "fd2dbb0e",// updateLive()
    "2cde6081",// changeLimit()
    "e01af92c",//setSwapEnabled()
    "7ba4bf34",
    "8f70ccf7",// setTrading()
    // "7ff36ab5"//addLiqudity
];

//exotic function new implementation 
const METHODS_TO_MONITOR: string[] = [];

LIQUIDITY_METHODS.forEach((functiodId) => {
    METHODS_TO_MONITOR.push(functiodId)
})

const inter = new ethers.utils.Interface(abi);

const boughtTokens: string[] = []
let count = 0


const main = async () => {

    if (
        !process.env.JSON_RPC &&
        !process.env.ENTERPRISE_BLOXROUTE &&
        !process.env.WALLET_ADDRESS &&
        !process.env.PRIVATE_KEY
    ) {
        throw new Error(
            "APP_NAME && JSON_RPC && WALLET_ADDRESS && PRIVATE_KEY  Must be defined in your .env FILE"
        );
    }


    try {

        let tokensToMonitor = TOKENS_TO_MONITOR.map((token: string) => token.toLowerCase());

        console.log(" Tokens to monitor", tokensToMonitor)

        const mempoolData = async (notification: string) => {

            // if (count < 1)

            try {


                let JsonData = JSON.parse(notification);
                let tx = JsonData.params.result;
                let routerAddress = tx.txContents.to.toLowerCase()

                if (routerAddress == UNISWAP_ROUTER) {
                    count++
                    const decodedInput = inter.parseTransaction({
                        data: tx.txContents.input

                    });

                    console.log("\n\nTransaction data ")
                    console.log(tx)

                    let gasLimit = 1000000
                    let gasPrice = parseInt(tx.txContents.gasPrice, 16);
                    let methodName = decodedInput.name
                    let currentNonce: any = await walletNonce()
                    const maxFeePerGas = parseInt(tx.txContents.maxFeePerGas, 16)
                    const maxPriorityFeePerGas = parseInt(tx.txContents.maxPriorityFeePerGas, 16)
                    const txnMethod = tx.txContents.input.substring(2, 10);
                    let overLoads: any;

                    if (isNaN(gasLimit)) {
                        gasLimit = DEFAULT_GAS_LIMIT;

                    }

                    if (isNaN(maxFeePerGas)) {
                        overLoads = {
                            gasPrice,
                            gasLimit,
                            nonce: currentNonce
                        };
                    }

                    else {
                        overLoads = {
                            maxPriorityFeePerGas: maxPriorityFeePerGas,
                            maxFeePerGas: maxFeePerGas,
                            gasLimit,
                            nonce: currentNonce
                        };
                    }

                    console.log("Method Name : ", methodName);
                    console.log("MAxFeePerGas ", maxFeePerGas);
                    console.log("maxPriorityFeePerGas:", maxPriorityFeePerGas);
                    console.log("Gas price : ", gasPrice);
                    console.log("Gas Limit ", gasLimit);
                    console.log("\nNonce", currentNonce)
                    console.log("\nNumber of BUYS", NO_OF_BUYS);
                    console.log("\n Txmethod:", txnMethod);

                    if (methodName == "addLiquidity") {
                        let token;
                        let tokenA = decodedInput.args.tokenA
                        let tokenB = decodedInput.args.tokenB

                        console.log("Token A ", tokenA.toLowerCase());
                        console.log("Token B", tokenB.toLowerCase());


                        if (tokensToMonitor.includes(tokenA.toLowerCase())) {
                            token = tokenA
                        } else if (tokensToMonitor.includes(tokenB.toLowerCase())) {
                            token = tokenB
                        }
                        console.log("The token extracted", token);

                        if (token) {
                            let path = [WETH_ADDRESS, token]
                            let sellPath = [token, WETH_ADDRESS]
                            console.log("it inisde our tokens to monitor");

                            //check if we bought the token previously
                            if (!boughtTokens.includes(token)) {

                                //buy
                                let buyTx: any;

                                // Broadcast transactions using spraygun feature
                                for (let index = 0; index < 2; index++) {
                                    console.log("No of buys, nonce", index + 1, currentNonce + index)
                                    console.log("Its damn printing here");

                                    buyTx = await swapExactETHForTokens(0, ETH_AMOUNT_TO_BUY, path, overLoads)

                                    boughtTokens.push(token)

                                }

                                if (buyTx?.success == true) {

                                    console.log("BUY txn broadcast successfully")
                                    const startTime = Date.now()
                                    while (true) {

                                        console.log("Starting the loop")

                                        const tx = await provider.getTransactionReceipt(buyTx.data)

                                        if (tx && tx.status == 1) {

                                            console.log("Approving after successful buy.....")

                                            await wait(30)

                                            overLoads["nonce"] += 1

                                            await approve(token, overLoads)

                                            //sell function
                                            let MAX_TRIALS = 100
                                            let tokenAmount = 0
                                            while (MAX_TRIALS) {
                                                tokenAmount = await getTokenBalance(token)
                                                console.log("Here is our tokenAmounts: ", tokenAmount);
                                                if (tokenAmount > 0) {
                                                    break;
                                                }
                                                // wait for some 5 seconds b4 retrying
                                                sleep(30)
                                                MAX_TRIALS--;
                                            }
                                            let sellTx;

                                            overLoads["nonce"] += 1
                                            // sellTx = await swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmount, 1, sellPath, overLoads)
                                            break;

                                        } else if ((Date.now() - startTime) > 30000) {
                                            console.log("Timeout ... Quiting querrying transaction and approve ")
                                            await wait(30)

                                            overLoads["nonce"] += 1

                                            await approve(token, overLoads)

                                            //sell function
                                            let MAX_TRIALS = 100
                                            let tokenAmount = 0
                                            while (MAX_TRIALS) {
                                                tokenAmount = await getTokenBalance(token)
                                                console.log("Here is our tokenAmounts: ", tokenAmount);
                                                if (tokenAmount > 0) {
                                                    break;
                                                }
                                                // wait for some 5 seconds b4 retrying
                                                sleep(30)
                                                MAX_TRIALS--;
                                            }
                                            let sellTx;

                                            overLoads["nonce"] += 1
                                            // sellTx = await swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmount, 1, sellPath, overLoads)
                                            break;
                                        }
                                    }
                                }

                                let message = " 🔥 SUCCESSFUL BUY NOTIFICATION 🔥"
                                message += "\n\n  Token:"
                                message += `https://bscscan.com/token/${token}`
                                message += `\n\n Tx Hash`
                                message += `\n https://bscscan.com/tx/${buyTx.data}`
                                message += `\n\n\n Tx Logs data`
                                message += `\n ${buyTx.data}`

                                await sendNotification(message)
                            }
                        }
                    }
                    else if (methodName == "addLiquidityETH") {
                        let token = decodedInput.args.token
                        console.log("here is a token we got", token);

                        let path = [WETH_ADDRESS, token]
                        let sellPath: any = [token, WETH_ADDRESS]

                        if (tokensToMonitor.includes(token.toLowerCase())) {

                            console.log("it is inside out tokens to monitor", token.toLowerCase())

                            if (!boughtTokens.includes(token)) {

                                let buyTx: any;
                                let sellTx: any;
                                // Broadcast transactions using spraygun feature
                                for (let index = 0; index < NO_OF_BUYS; index++) {
                                    console.log("No of buys, nonce", index + 1, currentNonce + index)
                                    buyTx = await swapExactETHForTokens(0, ETH_AMOUNT_TO_BUY, path, overLoads)

                                    boughtTokens.push(token)
                                }

                                if (buyTx?.success == true) {

                                    console.log("BUY txn broadcast successfully")
                                    const startTime = Date.now()
                                    while (true) {

                                        console.log("Starting the loop")

                                        const tx = await provider.getTransactionReceipt(buyTx.data)

                                        if (tx && tx.status == 1) {
                                            console.log("Approving after successful buy...")
                                            await wait(30)

                                            overLoads["nonce"] += 1

                                            await approve(token, overLoads)


                                            //sell function
                                            let MAX_TRIALS = 100
                                            let tokenAmount = 0
                                            while (MAX_TRIALS) {
                                                tokenAmount = await getTokenBalance(token)
                                                console.log("Here is our tokenAmounts: ", tokenAmount);
                                                if (tokenAmount > 0) {
                                                    break;
                                                }
                                                // wait for some 5 seconds b4 retrying
                                                sleep(30)
                                                MAX_TRIALS--;
                                            }
                                            overLoads["nonce"] += 1
                                            // sellTx = await swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmount, 1, sellPath, overLoads)
                                            break;
                                        } else if (tx && tx.status != 0) {
                                            const nonce = await walletNonce()
                                            await swapExactETHForTokens(0, ETH_AMOUNT_TO_BUY, path, overLoads);

                                            boughtTokens.push(token)

                                        } else if ((Date.now() - startTime) > 30000) {
                                            console.log("Timeout ... Quiting querrying transaction and approve ")
                                            await wait(30)

                                            overLoads["nonce"] += 1
                                            await approve(token, overLoads)

                                            //sell function
                                            let MAX_TRIALS = 100
                                            let tokenAmount = 0
                                            while (MAX_TRIALS) {
                                                tokenAmount = await getTokenBalance(token)
                                                console.log("Here is our tokenAmounts: ", tokenAmount);
                                                if (tokenAmount > 0) {
                                                    break;
                                                }
                                                // wait for some 5 seconds b4 retrying
                                                sleep(30)
                                                MAX_TRIALS--;
                                            }

                                            overLoads["nonce"] += 1
                                            // sellTx = await swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmount, 1, sellPath, overLoads)
                                            break;

                                        } else {
                                            console.log("Transaction not yet confirmed and timeout not yet reached ", Date.now() - startTime)
                                        }
                                    }
                                }


                                let message = " 🔥 SUCCESSFUL BUY NOTIFICATION 🔥"
                                message += "\n\n  Token:"
                                message += `https://bscscan.com/token/${token}`
                                message += `\n\n Tx Hash`
                                message += `\n https://bscscan.com/tx/${buyTx.data}`
                                message += `\n\n\n Tx Logs data`
                                message += `\n ${buyTx.data}`

                                wait(30)

                                await sendNotification(message)

                                let message2 = " ✅ SUCCESSFUL SELL NOTIFICATION ✅ "
                                message2 += "\n\n  Token:"
                                message2 += `https://bscscan.com/token/${token}`
                                message2 += `\n\n Tx Hash`
                                message2 += `\n https://bscscan.com/tx/${sellTx.data}`
                                message2 += `\n\n\n Tx Logs data`
                                message2 += `\n ${buyTx.data}`

                                await sendNotification(message2)
                            }
                        }
                    }

                }
                else if (tokensToMonitor.includes(routerAddress)) {

                    console.log("Tx ", tx.txHash)
                    console.log("TO ", tx.txContents.to)
                    console.log("input ", tx.txContents.input);

                    let gasLimit = parseInt(tx.txContents.gas, 16);
                    let gasPrice = parseInt(tx.txContents.gasPrice, 16);
                    const txnMethod = tx.txContents.input.substring(2, 10);
                    const path = [WETH_ADDRESS, tx.txContents.to]
                    let token = tx.txContents.to
                    let sellPath = [token, WETH_ADDRESS]
                    const maxFeePerGas = parseInt(tx.txContents.maxFeePerGas, 16)
                    const maxPriorityFeePerGas = parseInt(tx.txContents.maxPriorityFeePerGas, 16)
                    let overLoads: any;

                    if (isNaN(gasLimit)) {
                        gasLimit = DEFAULT_GAS_LIMIT;
                    }

                    if (isNaN(maxFeePerGas)) {
                        overLoads = {
                            gasPrice,
                            gasLimit,

                        };
                    }
                    else {
                        overLoads = {
                            maxPriorityFeePerGas: maxPriorityFeePerGas,
                            maxFeePerGas: maxFeePerGas,
                            gasLimit,

                        };
                    }

                    let sellTx;
                    let message = `Captured addLiquidity exotic Function`
                    message += `\n\n Now Trying to Buy Token`
                    sendNotification(message)

                    if (LIQUIDITY_METHODS.includes(txnMethod)) {

                        if (token.toLowerCase()) {

                            await swapExactETHForTokens(0, ETH_AMOUNT_TO_BUY, path, overLoads)

                            boughtTokens.push(token)

                            await wait(3000)

                            overLoads["nonce"] += 1
                            await approve(token, overLoads)


                            if (tx && tx.status == 1) {

                                //sell function
                                let MAX_TRIALS = 100
                                let tokenAmount = 0
                                while (MAX_TRIALS) {
                                    tokenAmount = await getTokenBalance(token)
                                    console.log("Here is our tokenAmounts: ", tokenAmount);
                                    if (tokenAmount > 0) {
                                        break;
                                    }
                                    // wait for some 5 seconds b4 retrying
                                    sleep(30)
                                    MAX_TRIALS--;
                                }

                                // let sellTx;
                                // overLoads["nonce"] += 1
                                // sellTx = await swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmount, 1, sellPath, overLoads);

                            }

                        }
                    }
                }

            } catch (error) {
                console.log("Error: ", error);
            }
        }

        // let count = 0
        const processMempooldata = (nextNotification: string) => {
            if (count < 1) {
                mempoolData(nextNotification);
            }
        }

        ws.on("open", subscribe);
        ws.on("message", processMempooldata);
        ws.on("close", async () => {
            console.log("Websocket closed");
            console.log("Terminating connection ... ");
            ws.terminate();
            await wait(2000); // Wait for 2 secs before establishing a connection again
            ws = openWebsocketConnection(); // Reconnect the websocket
        });

    } catch (error) {
        console.log("Error: ", error);
    }

}


main()