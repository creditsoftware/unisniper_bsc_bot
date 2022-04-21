
// Approve token
import { ethers } from 'ethers'
import { overLoads } from '../types';
const abi = ["function approve(address _spender, uint256 _value) public returns (bool success)"]
const provider = ethers.getDefaultProvider(process.env.JSON_RPC)
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!);
const account = signer.connect(provider);

const MAX_INT = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

const approve = async (tokenToapprove: string, overLoads: overLoads) => {

    console.log("Here is our Nonce", overLoads.nonce)

    try {
        let contract = new ethers.Contract(tokenToapprove, abi, account)

        console.log(`Gas price : ${overLoads.gasPrice} \n\n GasLimit ${overLoads.gasLimit} \n\n Nonce ${overLoads.nonce}`)

        delete overLoads.value

        const tx = await contract.approve("0x10ED43C718714eb63d5aA57B78B54704E256024E", MAX_INT,
            overLoads
        )

        console.log("\n\n\n ************** APPROVE ***************")
        console.log("Transaction hash: ", tx.hash);
        console.log("*********************************************")
    } catch (error) {
        console.log("Error => ", error);
    }
};


export { approve }