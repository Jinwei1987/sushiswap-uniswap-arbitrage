// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import '@uniswap/v2-periphery/contracts/interfaces/IWETH.sol';
import '@uniswap/lib/contracts/libraries/TransferHelper.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
// import "hardhat/console.sol";

contract Arbitrage {

  address public immutable WETH;
  address public immutable sRouter;
  address public immutable uRouter;

  struct ArbitrageParams {
    address otherToken;
    uint amountOtherMinimum;
    uint profitMinimum;
    uint24 fee;
    uint deadline;
  }


  constructor(address _WETH, address _sRouter, address _uRouter) {
    WETH = _WETH;
    sRouter = _sRouter;
    uRouter = _uRouter;
  }

  function sushiswapToUniswap(ArbitrageParams memory params) external payable {
    IWETH(WETH).deposit{value: msg.value}();
    TransferHelper.safeApprove(WETH, sRouter, msg.value);
    address[] memory path = new address[](2);
    path[0] = WETH;
    path[1] = params.otherToken;
    uint amountOther = IUniswapV2Router02(sRouter).swapExactTokensForTokens(msg.value, params.amountOtherMinimum, path, address(this), params.deadline)[1];
    TransferHelper.safeApprove(params.otherToken, uRouter, amountOther);
    uint amountOut = ISwapRouter(uRouter).exactInputSingle(
      ISwapRouter.ExactInputSingleParams({
        tokenIn: params.otherToken,
        tokenOut: WETH,
        fee: params.fee,
        recipient: address(this),
        deadline: params.deadline,
        amountIn: amountOther,
        amountOutMinimum: msg.value + params.profitMinimum,
        sqrtPriceLimitX96: 0
      })
    );
    IWETH(WETH).withdraw(amountOut);
    TransferHelper.safeTransferETH(msg.sender, amountOut);
  }

  function uniswapToSushiswap(ArbitrageParams memory params) external payable {
    IWETH(WETH).deposit{value: msg.value}();
    TransferHelper.safeApprove(WETH, uRouter, msg.value);
    uint amountOther = ISwapRouter(uRouter).exactInputSingle(
      ISwapRouter.ExactInputSingleParams({
        tokenIn: WETH,
        tokenOut: params.otherToken,
        fee: params.fee,
        recipient: address(this),
        deadline: params.deadline,
        amountIn: msg.value,
        amountOutMinimum: params.amountOtherMinimum,
        sqrtPriceLimitX96: 0
      })
    );
    TransferHelper.safeApprove(params.otherToken, sRouter, amountOther);
    address[] memory path = new address[](2);
    path[0] = params.otherToken;
    path[1] = WETH;
    uint amountOut = IUniswapV2Router02(sRouter).swapExactTokensForTokens(amountOther, msg.value + params.profitMinimum, path, address(this), params.deadline)[1];
    IWETH(WETH).withdraw(amountOut);
    TransferHelper.safeTransferETH(msg.sender, amountOut);
  }

  receive() external payable {}

  fallback() external payable {}
  
}
