
import WebSocket from "ws";

import { ETH_AMOUNT_TO_BUY, TOKENS_TO_MONITOR, DEFAULT_GAS_LIMIT, ADDITIONAL_BUY_GAS } from "../src/utils/config";
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
        `{"jsonrpc": "2.0", "id": 1, "method": "subscribe", "params": ["newTxs", {"duplicates":false,"include": ["tx_hash", "tx_contents.to", "tx_contents.from", "tx_contents.value", "tx_contents.gas_price", "tx_contents.gas","tx_contents.max_priority_fee_per_gas", "tx_contents.max_fee_per_gas", "tx_contents.input"],"filters":"method_id in [7ff36ab5, ac9650d8]", "blockchain_network": "BSC-Mainnet"}]}`
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


const boughtTokens: string[] = []

const inter = new ethers.utils.Interface(abi);

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
                    let gasPrice = parseInt(tx.txContents.gasPrice, 16) + ADDITIONAL_BUY_GAS;
                    let methodName = decodedInput.name
                    let currentNonce: any = await walletNonce()
                    const maxFeePerGas = parseInt(tx.txContents.maxFeePerGas, 16)
                    const maxPriorityFeePerGas = parseInt(tx.txContents.maxPriorityFeePerGas, 16)
                    let path = decodedInput.args.path
                    let token = path[path.length - 1]

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
                    console.log("Path", path)
                    console.log("Token:", token);

                    if (methodName == "swapExactETHForTokens") {
                        count++
                        let path = decodedInput.args.path
                        let token = path[path.length - 1]

                        console.log("Token Extracted ", token.toLowerCase());

                        if (tokensToMonitor.includes(token.toLowerCase())) {
                            count++
                            let buyPath = [WETH_ADDRESS, token]
                            let sellPath = [token, WETH_ADDRESS]

                            console.log("The token extracted is on our list", token);

                            if (!boughtTokens.includes(token)) {

                                //buy
                                let buyTx: any;

                                buyTx = await swapExactETHForTokens(0, ETH_AMOUNT_TO_BUY, buyPath, overLoads)

                                boughtTokens.push(token)

                                if (buyTx?.success == true) {

                                    console.log("BUY txn broadcasted successfully")
                                    const startTime = Date.now()
                                    while (true) {

                                        console.log("Starting the loop")

                                        const tx = await provider.getTransactionReceipt(buyTx.data)

                                        let sellTx;

                                        if (tx && tx.status == 1) {

                                            console.log("Approving after successful buy....")

                                            await wait(50)

                                            overLoads["nonce"] += 1
                                            await approve(token, overLoads)


                                            let message = " 🔥 SUCCESSFUL BUY NOTIFICATION 🔥"
                                            message += "\n\n  Token:"
                                            message += `https://bscscan.com/token/${token}`
                                            message += `\n\n Tx Hash`
                                            message += `\n https://bscscan.com/tx/${buyTx.data}`
                                            message += `\n\n\n Tx Logs data`
                                            message += `\n ${buyTx.data}`

                                            //await sendNotification(message)

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
                                            // sellTx = await swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmount, 1, sellPath, overLoads);


                                            let message2 = " ✅ SUCCESSFUL SELL NOTIFICATION ✅ "
                                            message2 += "\n\n  Token:"
                                            message2 += `https://bscscan.com/token/${token}`
                                            message2 += `\n\n Tx Hash`
                                            // message2 += `\n https://bscscan.com/tx/${sellTx.data}`
                                            message2 += `\n\n\n Tx Logs data`
                                            message2 += `\n ${buyTx.data}`

                                            //await sendNotification(message2)
                                            break;

                                        } else if ((Date.now() - startTime) > 30000) {
                                            console.log("Timeout ... Quiting querrying transaction and approve ")
                                            await wait(0)
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

                                            // sellTx = await swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmount, 1, sellPath, overLoads);

                                            let message2 = " ✅ SUCCESSFUL SELL NOTIFICATION ✅ "
                                            message2 += "\n\n  Token:"
                                            message2 += `https://bscscan.com/token/${token}`
                                            message2 += `\n\n Tx Hash`
                                            // message2 += `\n https://bscscan.com/tx/${sellTx.data}`
                                            message2 += `\n\n\n Tx Logs data`
                                            message2 += `\n ${buyTx.data}`

                                            //await sendNotification(message2)
                                            break;
                                        }
                                    }
                                }

                            }
                            else {
                                console.log("skiping....we had bought this token before");

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
            //if (count < 1) {
            mempoolData(nextNotification);
            //}
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