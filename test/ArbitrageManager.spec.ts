import sinon = require('sinon');
import sinonChai = require("sinon-chai");
import {SinonStubbedInstance} from 'sinon';
import {ArbitrageManager} from '../scripts/arbitrage/ArbitrageManager';
import {ethers, waffle, artifacts} from 'hardhat';
import IUniswapV2Factory from '@uniswap/v2-core/build/IUniswapV2Factory.json';
import IUniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json';
import ERC20 from '@openzeppelin/contracts/build/contracts/ERC20.json';
import { MockContract } from 'ethereum-waffle';
import { BigNumber } from '@ethersproject/bignumber';
import { GasPriceOracle } from 'gas-price-oracle';
import { Wallet } from '@ethersproject/wallet';
import { JsonRpcProvider } from '@ethersproject/providers';
import { expect, use } from 'chai';

use(sinonChai);

describe("ArbitrageManager class", () => {

    const token1Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const token2Address = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599";
    const fundingAmount = "10";
    const tokenOtherAddresses = [token1Address, token2Address];
    let Arbitrage: any;
    let provider: JsonRpcProvider;
    let sFacotry: MockContract;
    let uFoctory: MockContract;
    let WETH: MockContract;
    let arbitrage: MockContract;
    let fundingWallet: Wallet;
    let gasPriceOracle: SinonStubbedInstance<GasPriceOracle>;

    before(async () => {
        const [signer] = await ethers.getSigners();
        provider = ethers.provider;
        Arbitrage = artifacts.readArtifactSync("Arbitrage");
        sFacotry = await waffle.deployMockContract(signer, IUniswapV2Factory.abi);
        uFoctory = await waffle.deployMockContract(signer, IUniswapV3Factory.abi);
        WETH = await waffle.deployMockContract(signer, ERC20.abi);
        arbitrage = await waffle.deployMockContract(signer, Arbitrage.abi);
        fundingWallet = waffle.provider.getWallets()[0];
        gasPriceOracle = sinon.createStubInstance(GasPriceOracle);
    });

    it("Should do sushiswap and uniswap", async () => {
        const arbitrageManager = new ArbitrageManager({ provider, sFacotry, uFoctory, WETH, arbitrage, tokenOtherAddresses, fundingWallet, fundingAmount, gasPriceOracle });
        const mocked = sinon.mock(arbitrageManager);
        mocked.expects('getSymbol').withArgs(token1Address).returns("USDT");
        mocked.expects('getDecimals').withArgs(token1Address).returns(6);
        mocked.expects('getSPrice').withArgs(token1Address).returns(5050);
        mocked.expects('getUPrice').withArgs(token1Address).returns(5000);
        mocked.expects('getUFee').withArgs(token1Address).returns(500);
        mocked.expects('getSymbol').withArgs(token2Address).returns("USDC");
        mocked.expects('getDecimals').withArgs(token2Address).returns(6);
        mocked.expects('getSPrice').withArgs(token2Address).returns(5060);
        mocked.expects('getUPrice').withArgs(token2Address).returns(5000);
        mocked.expects('getUFee').withArgs(token2Address).returns(500);
        mocked.expects('getSushiswapToUniswapEstimateGas').returns(new Promise(resolve => resolve(BigNumber.from(100000))));
        mocked.expects('getSushiswapToUniswapResponse').returns(new Promise(resolve => resolve("sushiswapToUniswap called")));
        gasPriceOracle.gasPrices.returns(new Promise(resolve => {
            resolve({instant: 150, fast: 100, standard: 80, low: 50});
        }));
        await arbitrage.mock.sushiswapToUniswap.returns();

        const response = await arbitrageManager.arbitrageOnBlock(1);

        expect(response).to.equals("sushiswapToUniswap called");
    });

    it("Should do sushiswap and uniswap", async () => {
        const arbitrageManager = new ArbitrageManager({ provider, sFacotry, uFoctory, WETH, arbitrage, tokenOtherAddresses, fundingWallet, fundingAmount, gasPriceOracle });
        const mocked = sinon.mock(arbitrageManager);
        mocked.expects('getSymbol').withArgs(token1Address).returns("USDT");
        mocked.expects('getDecimals').withArgs(token1Address).returns(6);
        mocked.expects('getSPrice').withArgs(token1Address).returns(5000);
        mocked.expects('getUPrice').withArgs(token1Address).returns(5050);
        mocked.expects('getUFee').withArgs(token1Address).returns(500);
        mocked.expects('getSymbol').withArgs(token2Address).returns("USDC");
        mocked.expects('getDecimals').withArgs(token2Address).returns(6);
        mocked.expects('getSPrice').withArgs(token2Address).returns(5000);
        mocked.expects('getUPrice').withArgs(token2Address).returns(5060);
        mocked.expects('getUFee').withArgs(token2Address).returns(500);
        mocked.expects('getUniswapToSushiswapEstimateGas').returns(new Promise(resolve => resolve(BigNumber.from(100000))));
        mocked.expects('getUniswapToSushiswapResponse').returns(new Promise(resolve => resolve("uniswapToSushiswap called")));
        gasPriceOracle.gasPrices.returns(new Promise(resolve => {
            resolve({instant: 150, fast: 100, standard: 80, low: 50});
        }));
        await arbitrage.mock.sushiswapToUniswap.returns();

        const response = await arbitrageManager.arbitrageOnBlock(1);

        expect(response).to.equals("uniswapToSushiswap called");
    });
});