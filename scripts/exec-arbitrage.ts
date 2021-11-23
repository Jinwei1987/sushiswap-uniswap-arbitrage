import dotenv from 'dotenv';
import ERC20 from '@openzeppelin/contracts/build/contracts/ERC20.json';
import IUniswapV2Factory from '@uniswap/v2-core/build/IUniswapV2Factory.json';
import IUniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json';
import {ethers} from 'ethers'
import {ArbitrageManager} from './arbitrage/ArbitrageManager';
// import Arbitrage from '../artifacts/contracts/Arbitrage.sol/Arbitrage.json';
// import { GasPriceOracle } from 'gas-price-oracle';
// import {sleep} from './arbitrage/Utils'


dotenv.config();
const network = process.env.NETWORK;
const infraProjectId = process.env.INFRA_PROJECT_ID;
const sFacotryAddress = process.env.S_FACTORY_ADDRESS;
const uFactoryAddress = process.env.U_FACTORY_ADDRESS;
const wethAddress = process.env.WETH_ADDRESS;
const tokenOtherAddresses = process.env.TOKEN_OTHER_ADDRESSES?.split(",");
// const arbitrageAddress = process.env.ARBITRAGE_ADDRESS;
// const fundingPrivateKey = process.env.FUNDING_PRIVATE_KEY;
// const fundingAmount = process.env.FUNDING_AMOUNT;

if (network && infraProjectId && sFacotryAddress && uFactoryAddress && wethAddress && tokenOtherAddresses) {
    const provider = new ethers.providers.InfuraWebSocketProvider(network, infraProjectId);
    const sFacotry = new ethers.Contract(sFacotryAddress, IUniswapV2Factory.abi, provider);
    const uFoctory = new ethers.Contract(uFactoryAddress, IUniswapV3Factory.abi, provider);
    const WETH = new ethers.Contract(wethAddress, ERC20.abi, provider);
    const arbitrageManager = new ArbitrageManager({ provider, sFacotry, uFoctory, WETH, tokenOtherAddresses});
    arbitrageManager.subscribePrices().then(() => {
        console.log('--------------------------');
    })
    // const providerEndpoint = `https://${network}.infura.io/v3/${infraProjectId}`;
    // const arbitrage = new ethers.Contract(arbitrageAddress, Arbitrage.abi, provider);
    // const fundingWallet = new ethers.Wallet(fundingPrivateKey, provider);
    // const gasPriceOracle = new GasPriceOracle({ defaultRpc: providerEndpoint });
    // const arbitrageManager = new ArbitrageManager({ provider, sFacotry, uFoctory, WETH, tokenOtherAddresses, arbitrage, fundingWallet, fundingAmount, gasPriceOracle });
    // arbitrageManager.subscribePrices().then(() => {
    //     provider.on("block", async blockNumber => {
    //         await sleep(500);
    //         await arbitrageManager.arbitrageOnBlock(blockNumber);
    //     });
    // });
} else {
    console.log("env is not set up properly!")
}


