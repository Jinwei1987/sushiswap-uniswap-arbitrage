import {ethers, ContractInterface, BigNumber} from 'ethers';
import { GasPriceOracle } from 'gas-price-oracle';
import ERC20 from '@openzeppelin/contracts/build/contracts/ERC20.json';
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';
import IUniswapV3Pool from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import {convertToPrice, logUpdate, sleep, calculateProfit, calculateAmountOther} from './Utils'

export interface InitParams {
    provider: ethers.providers.JsonRpcProvider;
    sFacotry: ethers.Contract;
    uFoctory: ethers.Contract;
    WETH: ethers.Contract;
    arbitrage: ethers.Contract;
    tokenOtherAddresses: string[];
    fundingWallet: ethers.Wallet;
    fundingAmount: string;
    gasPriceOracle: GasPriceOracle;
}

export class ArbitrageManager {
    readonly provider: ethers.providers.JsonRpcProvider;
    readonly sFacotry: ethers.Contract;
    readonly uFoctory: ethers.Contract;
    readonly WETH: ethers.Contract;
    readonly arbitrage: ethers.Contract;
    readonly tokenOtherAddresses: string[];
    readonly fundingWallet: ethers.Wallet;
    readonly fundingAmount: string;
    readonly gasPriceOracle: GasPriceOracle;
    readonly state: {
        symbols: Map<string, string>,
        decimals: Map<String, any>,
        sPrices: Map<string, number>,
        uPrices: Map<string, number>,
        uFees: Map<string, number>
    };

    constructor(initParams: InitParams) {
        this.provider = initParams.provider;
        this.sFacotry = initParams.sFacotry;
        this.uFoctory = initParams.uFoctory;
        this.WETH = initParams.WETH;
        this.arbitrage = initParams.arbitrage;
        this.tokenOtherAddresses = initParams.tokenOtherAddresses;
        this.fundingWallet = initParams.fundingWallet;
        this.fundingAmount = initParams.fundingAmount;
        this.gasPriceOracle = initParams.gasPriceOracle;
        this.state = {
            symbols: new Map(),
            decimals: new Map(),
            sPrices: new Map(),
            uPrices: new Map(),
            uFees: new Map()
        }
    }

    async arbitrageOnBlock(blockNumber: any) {
        //sleep 1 seconds waiting for latest price to be processed
        let otherAddress;
        let sPrice;
        let uPrice;
        let uFee;
        let profit = 0;
        for (let index = 0; index < this.tokenOtherAddresses.length; index++) {
            otherAddress = this.tokenOtherAddresses[index];
            sPrice = this.getSPrice(otherAddress);
            uPrice = this.getUPrice(otherAddress);
            uFee = this.getUFee(otherAddress);
            if (sPrice && uPrice && uFee) {
                const newProfit = calculateProfit(sPrice, uPrice, uPrice);
                if (newProfit > profit) {
                    profit = newProfit;
                }
            }
        }
        if (profit > 0 && otherAddress && sPrice && uPrice && uFee) {
            return this.doArbitrage(blockNumber, otherAddress, profit, sPrice, uPrice, uFee);
        } else {
            console.log(`!${blockNumber} profit is less than zero, give up!`);
        }
    }

    async subscribePrices() {
        // const otherAddress = await sFacotry.allPairs(0);
        for (let index = 0; index < this.tokenOtherAddresses.length; index++) {
            const otherAddress = this.tokenOtherAddresses[index];
            await this.subscribePrice(otherAddress);
        }
    }

    erc20(address: string, abi: ContractInterface) {
        return new ethers.Contract(address, abi, this.provider);
    }

    getSymbol(address: string) {
        return this.state.symbols.get(address);
    }

    getDecimals(address: string) {
        return this.state.decimals.get(address);
    }

    getSPrice(address: string) {
        return this.state.sPrices.get(address);
    }

    getUPrice(address: string) {
        return this.state.uPrices.get(address);
    }

    getUFee(address: string) {
        return this.state.uFees.get(address);
    }

    async getSushiswapToUniswapEstimateGas(params: any, amountEth: BigNumber) {
        return await this.arbitrage.estimateGas.sushiswapToUniswap(params, {value: amountEth});
    }

    async getUniswapToSushiswapEstimateGas(params: any, amountEth: BigNumber) {
        return await this.arbitrage.estimateGas.uniswapToSushiswap(params, {value: amountEth});
    }

    async getSushiswapToUniswapResponse(params: any, amountEth: BigNumber) {
        return await this.arbitrage.sushiswapToUniswap(params, {value: amountEth});
    }

    async getUniswapToSushiswapResponse(params: any, amountEth: BigNumber) {
        return await this.arbitrage.uniswapToSushiswap(params, {value: amountEth});
    }

    private async doArbitrage(blockNumber: any, otherAddress: string, profit: number, sPrice: number, uPrice: number, uFee: number) {
        const gasPrices = await this.gasPriceOracle.gasPrices();
        const fastGasPrice = gasPrices.fast;
        const symbolOther = this.getSymbol(otherAddress);
        console.log(`!${blockNumber} chance of profit ${profit}, ${symbolOther}, fast ${fastGasPrice} gwei!`);
        const decimalsOther = this.getDecimals(otherAddress);
        const amountOther = calculateAmountOther(Math.max(sPrice, uPrice), +this.fundingAmount, decimalsOther);
        const params = {
            otherToken: otherAddress,
            amountOtherMinimum: amountOther, 
            profitMinimum: BigNumber.from(0), 
            fee: uFee,
            deadline: Math.round(Date.now()/1000) + 60
        }
        const amountEth = ethers.utils.parseEther(this.fundingAmount);
        const balance = await this.fundingWallet.getBalance();
        if (balance.lt(amountOther)) {
            console.log(`!funding account does not have enough balance!`);
        } else {
            let gasCostFloat;
            let totalProfit
            let transactionResponse;
            if (sPrice > uPrice) {
                const estimateGas = await this.getSushiswapToUniswapEstimateGas(params, amountEth);
                const gasCost = ethers.utils.parseUnits(fastGasPrice.toString(), 'gwei').mul(estimateGas);
                gasCostFloat = +ethers.utils.formatEther(gasCost);
                totalProfit = profit * +this.fundingAmount;
                if (totalProfit > gasCostFloat) {
                    params.profitMinimum = gasCost;
                    transactionResponse = await this.getSushiswapToUniswapResponse(params, amountEth);
                }
            } else {
                const estimateGas = await this.getUniswapToSushiswapEstimateGas(params, amountEth);
                const gasCost = ethers.utils.parseUnits(fastGasPrice.toString(), 'gwei').mul(estimateGas);
                gasCostFloat = +ethers.utils.formatEther(gasCost);
                totalProfit = profit * +this.fundingAmount;
                if (totalProfit > gasCostFloat) {
                    params.profitMinimum = gasCost;
                    transactionResponse = await this.getUniswapToSushiswapResponse(params, amountEth);
                }
            }
            if (transactionResponse) {
                console.log(`!${blockNumber} execute arbitrage with response: ${transactionResponse}!`);
                return transactionResponse;
            } else {
                 console.log(`!${blockNumber} give up the chance, gasCost[${gasCostFloat}] > totalProfit[${totalProfit}], ${symbolOther}!`);
            }
        }
    }

    private async subscribePrice(otherAddress: string) {
        const tokenOther = this.erc20(otherAddress, ERC20.abi);
        const symbolOther = await tokenOther.symbol();
        this.state.symbols.set(otherAddress, symbolOther);
        console.log("--------------------------")
        console.log(`token address ${otherAddress} map to symbol ${symbolOther}`);
        const wethAddress = this.WETH.address;
        const sPairAddress = await this.sFacotry.getPair(wethAddress, otherAddress);
        const uLowFeePoolAddress = await this.uFoctory.getPool(wethAddress, otherAddress, 500);
        const uPoolAddress = uLowFeePoolAddress == ethers.constants.AddressZero ? await this.uFoctory.getPool(wethAddress, otherAddress, 3000) : uLowFeePoolAddress;
        if (sPairAddress == ethers.constants.AddressZero || uPoolAddress == ethers.constants.AddressZero) {
            console.log(`don't subscribe prices due to zero address, sushiswap pair address: ${sPairAddress}, uniswap pool address: ${uPoolAddress}`)
        } else {
            await this.subscribeSushiswapPrice(otherAddress, sPairAddress);
            await this.subscribeUniswapPrice(otherAddress, uPoolAddress);
        }
    }
    
    private async subscribeSushiswapPrice(otherAddress: string, sPairAddress: string) {
        const wethAddress = this.WETH.address;
        const tokenOther = this.erc20(otherAddress, ERC20.abi);
        const symbolOther = await tokenOther.symbol();
        const sPair = new ethers.Contract(sPairAddress, IUniswapV2Pair.abi, this.provider);
        const sToken0Address = await sPair.token0();
        const decimalsEth = await this.WETH.decimals();
        const decimalsOther = await tokenOther.decimals();
        const sFilter = sPair.filters.Swap();
        if (sToken0Address == wethAddress) {
            const pairSymbol = `WETH-${symbolOther}`;
            console.log(`get sushiswap ${pairSymbol} pair address ${sPairAddress}`);
            //const events = await pair.queryFilter(filter, 13601182);
            //console.log(events);
            sPair.on(sFilter, (_from, amount0In, amount1In, amount0Out, amount1Out, _to, event) => {
                const {price, volume} = convertToPrice({ 
                    amountOtherIn: amount1In, 
                    amountOtherOut: amount1Out, 
                    amountEthIn: amount0In, 
                    amountEthOut: amount0Out, 
                    decimalsOther, 
                    decimalsEth 
                });
                this.state.sPrices.set(otherAddress, price);
                logUpdate("sushiswap", pairSymbol, price, volume, event);
            })
        } else {
            const pairSymbol = `${symbolOther}-WETH`;
            console.log(`get sushiswap ${pairSymbol} pair address ${sPairAddress}`);
            //const events = await pair.queryFilter(filter, 13601182);
            //console.log(events);
            sPair.on(sFilter, (_from, amount0In, amount1In, amount0Out, amount1Out, _to, event) => {
                const {price, volume} = convertToPrice({ 
                    amountOtherIn: amount0In, 
                    amountOtherOut: amount0Out, 
                    amountEthIn: amount1In, 
                    amountEthOut: amount1Out, 
                    decimalsOther, 
                    decimalsEth 
                });
                this.state.sPrices.set(otherAddress, price);
                logUpdate("sushiswap", pairSymbol, price, volume, event);
            })
        }
    }
    
    private async subscribeUniswapPrice(otherAddress: string, uPoolAddress: string) {
        const wethAddress = this.WETH.address;
        const tokenOther = this.erc20(otherAddress, ERC20.abi);
        const symbolOther = await tokenOther.symbol();
        const uPool = new ethers.Contract(uPoolAddress, IUniswapV3Pool.abi, this.provider);
        const uToken0Address = await uPool.token0();
        const decimalsEth = await this.WETH.decimals();
        const decimalsOther = await tokenOther.decimals();
        const fee = await uPool.fee();
        const feePercentage = fee / 10000
        this.state.uFees.set(otherAddress, fee);
        const uFilter = uPool.filters.Swap();
        if (uToken0Address == wethAddress)  {
            const pairSymbol = `WETH-${symbolOther}`;
            console.log(`get uniswap ${pairSymbol} ${feePercentage}% pool address ${uPoolAddress}`);
            uPool.on(uFilter, (_sender, _recipient, _amount0, amount1, sqrtPriceX96, _liquidity, _tick, event) => {
                const price = (sqrtPriceX96 ** 2 / 2 ** 192 ) * 10 ** (decimalsEth - decimalsOther);
                const volume = parseFloat(ethers.utils.formatUnits(amount1, decimalsOther));
                this.state.uPrices.set(otherAddress, price);
                logUpdate("uniswap", pairSymbol, price, volume, event);
            })
        } else {
            const pairSymbol = `${symbolOther}-WETH`;
            console.log(`get uniswap ${pairSymbol} ${feePercentage}% pool address ${uPoolAddress}`);
            uPool.on(uFilter, (_sender, _recipient, amount0, _amount1, sqrtPriceX96, _liquidity, _tick, event) => {
                const price = (2 ** 192 / sqrtPriceX96 ** 2) * 10 ** (decimalsEth - decimalsOther);
                const volume = parseFloat(ethers.utils.formatUnits(amount0, decimalsOther));
                this.state.uPrices.set(otherAddress, price);
                logUpdate("uniswap", pairSymbol, price, volume, event);
            })
        }
    }
}