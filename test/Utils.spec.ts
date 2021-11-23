import { BigNumber } from '@ethersproject/bignumber';
import {expect} from 'chai';
import {convertToPrice, calculateProfit, calculateAmountOther} from '../scripts/arbitrage/Utils'

describe("Utils module", () => {

    it("Should convert price and amount", async () => {
        const {price, volume} = convertToPrice({ 
            amountOtherIn: BigNumber.from('10000000000'), 
            amountOtherOut: BigNumber.from(0), 
            amountEthIn: BigNumber.from(0), 
            amountEthOut: BigNumber.from('2000000000000000000'), 
            decimalsOther: 6, 
            decimalsEth: 18
        });

        expect(price).to.equal(5000);
        expect(volume).to.equal(10000);
    });

    it("Should convert price and amount to negative", async () => {
        const {price, volume} = convertToPrice({ 
            amountOtherIn: BigNumber.from(0), 
            amountOtherOut: BigNumber.from('10000000000'), 
            amountEthIn: BigNumber.from('2000000000000000000'), 
            amountEthOut: BigNumber.from(0), 
            decimalsOther: 6, 
            decimalsEth: 18
        });

        expect(price).to.equal(5000);
        expect(volume).to.equal(-10000);
    });

    it("Should calcuate positive profit", async () => {
        const profit = calculateProfit(5000.17, 5050.65, 500);

        expect(profit).to.greaterThan(0);
    });

    it("Should calcuate negative profit", async () => {
        const profit = calculateProfit(5000.17, 5010.65, 500);

        expect(profit).to.lessThan(0);
    });

    it("Should calcuate positive profit regardless price order", async () => {
        const profit = calculateProfit(5050.65, 5000.17, 500);

        expect(profit).to.greaterThan(0);
    });

    it("Should calcuate negative profit regardless price order", async () => {
        const profit = calculateProfit(5010.65, 5000.17, 500);

        expect(profit).to.lessThan(0);
    });

    it("Should calcuate amount other with int number", async () => {
        const amountOther = calculateAmountOther(5000, 10, 6);

        expect(amountOther).to.equal(50000000000);
    });

    it("Should calcuate amount other with float number", async () => {
        const amountOther = calculateAmountOther(5000.12345678, 10.0, 6);

        expect(amountOther).to.equal(50001234568);
    });
});