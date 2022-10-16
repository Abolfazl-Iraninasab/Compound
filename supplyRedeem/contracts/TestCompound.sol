// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/Compound.sol";

contract TestCompound {
    IERC20 public token;
    CErc20 public cToken;

    event Log(string message, uint256 val);

    constructor(address _token, address _cToken) {
        token = IERC20(_token);
        cToken = CErc20(_cToken);
    }

    function supply(uint256 _amount) external {
        token.transferFrom(msg.sender, address(this), _amount);
        token.approve(address(cToken), _amount);
        require(cToken.mint(_amount) == 0, "mint failed");
    }

    function getCTokenBalance() external view returns (uint256) {
        return cToken.balanceOf(address(this));
    }

    function getInfo()
        external
        returns (uint256 exchangeRate, uint256 supplyRate)
    {
        exchangeRate = cToken.exchangeRateCurrent();
        supplyRate = cToken.supplyRatePerBlock();
    }

    function balanceOfUnderlying() external returns (uint256) {
        return cToken.balanceOfUnderlying(address(this));
    }

    function redeem(uint256 _cTokenAmount) external {
        require(cToken.redeem(_cTokenAmount) == 0, "redeem failed");
    }
}
