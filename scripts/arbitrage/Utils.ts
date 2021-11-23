import {BigNumber, BigNumberish, ethers} from 'ethers'

export function convertToPrice(args: { 
    amountOtherIn: BigNumber, 
    amountOtherOut: BigNumber, 
    amountEthIn: BigNumber, 
    amountEthOut: BigNumber, 
    decimalsOther: BigNumberish, 
    decimalsEth: BigNumberish 
}) {
    const {amountOtherIn, amountOtherOut, amountEthIn, amountEthOut, decimalsOther: decimalsOther, decimalsEth: decimalsEth} = args;
    const amountOther = amountOtherIn.eq(0) ? amountOtherOut.mul(-1) : amountOtherIn;
    const amountEth = amountEthIn.eq(0) ? amountEthOut.mul(-1) : amountEthIn;
    const amountOtherFloat = parseFloat(ethers.utils.formatUnits(amountOther, decimalsOther));
    const amountEthFloat = parseFloat(ethers.utils.formatUnits(amountEth, decimalsEth));
  
    const priceAgainstEth = amountEthFloat != 0 ? amountOtherFloat / amountEthFloat : 0;
    return { price: Math.abs(priceAgainstEth), volume: amountOtherFloat };
}

export function calculateProfit(price1: number, price2: number, fee: number) {
    return ((price1 > price2) ? price1 / price2 : price2 / price1) * 997 / 1000 * (10000 - fee/100) / 10000 - 1;
}

export function calculateAmountOther(price: number, ether: number, decimalsOther: number) {
    return Math.round(price * ether * 10 ** decimalsOther);
}

export function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function logUpdate(source: string, pairSymbol: string, price: BigNumberish, volume: BigNumberish, event: any) {
    console.log(`${new Date().toISOString()} ${event.blockNumber} ${source} ${pairSymbol} price: ${price}, volume: ${volume}, txhash: ${event.transactionHash}`);
}