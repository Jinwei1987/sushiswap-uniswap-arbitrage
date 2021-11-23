import {expect} from 'chai';
import {ethers, waffle} from 'hardhat';
import IUniswapV2Router02 from '@uniswap/v2-periphery/build/IUniswapV2Router02.json';
import ISwapRouter from '@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json';
import ERC20 from '@openzeppelin/contracts/build/contracts/ERC20.json';
import { MockContract } from 'ethereum-waffle';
import { Contract } from '@ethersproject/contracts';
import { BigNumber } from '@ethersproject/bignumber';

describe("Arbitrage contract", () => {

  let weth: Contract;
  let mockSRouter: MockContract;
  let mockURouter: MockContract;
  let mockOtherToken: MockContract;
  let arbitrage: Contract;

  before(async () => {
    const [wethSigner, sRoutorSigner, uRoutorSigner, othertokenSigner, arbitrageSigner] = await ethers.getSigners();
    const WETH9 = await ethers.getContractFactory("WETH9", wethSigner);
    weth = await WETH9.deploy();
    mockSRouter = await waffle.deployMockContract(sRoutorSigner, IUniswapV2Router02.abi);
    mockURouter = await waffle.deployMockContract(uRoutorSigner, ISwapRouter.abi);
    mockOtherToken = await waffle.deployMockContract(othertokenSigner, ERC20.abi);
    const Arbitrage = await ethers.getContractFactory("Arbitrage", arbitrageSigner);
    arbitrage = await Arbitrage.deploy(weth.address, mockSRouter.address, mockURouter.address);
    await weth.deposit({value: ethers.utils.parseEther("100")});
    await weth.transfer(arbitrage.address, ethers.utils.parseEther("100"));
  });
  
  describe("Deployment", () => {
    it("Should set the right weth, sushiswap and uniswap router address", async () => {
      expect(await arbitrage.WETH()).to.equal(weth.address);
      expect(await arbitrage.sRouter()).to.equal(mockSRouter.address);
      expect(await arbitrage.uRouter()).to.equal(mockURouter.address);
    });

    it("Should inital balance euqal zero", async () => {
      const balance = await ethers.provider.getBalance(arbitrage.address);

      expect(balance).to.equal(0);
    });
  });

  describe("Transactions", () => {
    it("Should do sushiswap then uniswap to make a profit", async () => {
      const amountEth = ethers.utils.parseEther("1");
      const amountOtherOut = BigNumber.from(510000000);
      await mockSRouter.mock.swapExactTokensForTokens.returns([ethers.utils.parseEther("1"), amountOtherOut]);
      await mockOtherToken.mock.approve.withArgs(mockURouter.address, amountOtherOut).returns(true);
      await mockURouter.mock.exactInputSingle.returns(ethers.utils.parseEther("1.06"));
      
      const before = await arbitrage.signer.getBalance();
      const gasPrice = await ethers.provider.getGasPrice();
      const params = {
        otherToken: mockOtherToken.address,
        amountOtherMinimum: 500000000, 
        profitMinimum: BigNumber.from(0), 
        fee: 500,
        deadline: Math.round(Date.now()/1000) + 60
      }
      const estimateGas = await arbitrage.estimateGas.sushiswapToUniswap(params, {value: amountEth});
      const gasCost = gasPrice.mul(estimateGas);
      params.profitMinimum = gasCost;
      await arbitrage.sushiswapToUniswap(params, {value: amountEth});

      const after = await arbitrage.signer.getBalance();

      const profit = parseFloat(ethers.utils.formatEther(after.sub(before)));
      expect(profit).to.greaterThan(0);
    });

    it("Should revert sushiswapToUniswap if swap on sushiswap reverts", async () => {
      const amountEth = ethers.utils.parseEther("1");
      await mockSRouter.mock.swapExactTokensForTokens.revertsWithReason("Uniswap V2 Error");
      const params = {
        otherToken: mockOtherToken.address,
        amountOtherMinimum: 500000000, 
        profitMinimum: BigNumber.from(0), 
        fee: 500,
        deadline: Math.round(Date.now()/1000) + 60
      }

      await expect(arbitrage.sushiswapToUniswap(params, {value: amountEth})).to.be.revertedWith("Uniswap V2 Error");
    });

    it("Should revert sushiswapToUniswap if swap on uniswap reverts", async () => {
      const amountEth = ethers.utils.parseEther("1");
      const amountOtherOut = BigNumber.from(51000000);
      await mockSRouter.mock.swapExactTokensForTokens.returns([ethers.utils.parseEther("1"), amountOtherOut]);
      await mockOtherToken.mock.approve.withArgs(mockURouter.address, amountOtherOut).returns(true);
      await mockURouter.mock.exactInputSingle.revertsWithReason("Uniswap V3 Error");
      const params = {
        otherToken: mockOtherToken.address,
        amountOtherMinimum: 500000000, 
        profitMinimum: BigNumber.from(0), 
        fee: 500,
        deadline: Math.round(Date.now()/1000) + 60
      }

      await expect(arbitrage.sushiswapToUniswap(params, {value: amountEth})).to.be.revertedWith("Uniswap V3 Error");
    });

    it("Should do uniswap then sushiswap to make a profit", async () => {
      const amountEth = ethers.utils.parseEther("1");
      const amountOtherOut = BigNumber.from(51000000);
      await mockURouter.mock.exactInputSingle.returns(amountOtherOut);
      await mockOtherToken.mock.approve.withArgs(mockSRouter.address, amountOtherOut).returns(true);
      await mockSRouter.mock.swapExactTokensForTokens.returns([amountOtherOut, ethers.utils.parseEther("1.06")]);
      
      const before = await arbitrage.signer.getBalance();
      const gasPrice = await ethers.provider.getGasPrice();
      const params = {
        otherToken: mockOtherToken.address,
        amountOtherMinimum: 500000000, 
        profitMinimum: BigNumber.from(0), 
        fee: 500,
        deadline: Math.round(Date.now()/1000) + 60
      }
      const estimateGas = await arbitrage.estimateGas.uniswapToSushiswap(params, {value: amountEth});
      const gasCost = gasPrice.mul(estimateGas);
      params.profitMinimum = gasCost;
      await arbitrage.uniswapToSushiswap(params, {value: amountEth});

      const after = await arbitrage.signer.getBalance();

      const profit = parseFloat(ethers.utils.formatEther(after.sub(before)));
      expect(profit).to.greaterThan(0);
    });

    it("Should revert uniswapToSushiswap if swap on uniswap reverts", async () => {
      const amountEth = ethers.utils.parseEther("1");
      await mockURouter.mock.exactInputSingle.revertsWithReason("Uniswap V3 Error");
      const params = {
        otherToken: mockOtherToken.address,
        amountOtherMinimum: 500000000, 
        profitMinimum: BigNumber.from(0), 
        fee: 500,
        deadline: Math.round(Date.now()/1000) + 60
      }

      await expect(arbitrage.uniswapToSushiswap(params, {value: amountEth})).to.be.revertedWith("Uniswap V3 Error");
    });

    it("Should revert uniswapToSushiswap if swap on sushiswap reverts", async () => {
      const amountEth = ethers.utils.parseEther("1");
      const amountOtherOut = BigNumber.from(51000000);
      await mockURouter.mock.exactInputSingle.returns(amountOtherOut);
      await mockOtherToken.mock.approve.withArgs(mockSRouter.address, amountOtherOut).returns(true);
      await mockSRouter.mock.swapExactTokensForTokens.revertsWithReason("Uniswap V2 Error");
      const params = {
        otherToken: mockOtherToken.address,
        amountOtherMinimum: 500000000, 
        profitMinimum: BigNumber.from(0), 
        fee: 500,
        deadline: Math.round(Date.now()/1000) + 60
      }

      await expect(arbitrage.uniswapToSushiswap(params, {value: amountEth})).to.be.revertedWith("Uniswap V2 Error");
    });
  })

});
