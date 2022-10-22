// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/compound.sol";

contract TestLiquidation {
    Comptroller public comptroller =
        Comptroller(0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B);

    PriceFeed public priceFeed =
        PriceFeed(0x922018674c12a7F0D394ebEEf9B58F186CdE13c1);

    IERC20 public tokenSupply;
    CErc20 public cTokenSupply;
    IERC20 public tokenBorrow;
    CErc20 public cTokenBorrow;

    event Log(string message, uint256 val);

    constructor(
        address _tokenSupply,
        address _cTokenSupply,
        address _tokenBorrow,
        address _cTokenBorrow
    ) {
        tokenSupply = IERC20(_tokenSupply);
        cTokenSupply = CErc20(_cTokenSupply);

        tokenBorrow = IERC20(_tokenBorrow);
        cTokenBorrow = CErc20(_cTokenBorrow);
    }

    function supply(uint256 _amount) external {
        tokenSupply.transferFrom(msg.sender, address(this), _amount);
        tokenSupply.approve(address(cTokenSupply), _amount);
        require(cTokenSupply.mint(_amount) == 0, "mint failed");
    }

    function getSupplyBalance() external returns (uint256) {
        return cTokenSupply.balanceOfUnderlying(address(this));
    }

    function getCollateralFactor() external view returns (uint256) {
        (, uint256 colFactor, ) = comptroller.markets(address(cTokenSupply));
        return colFactor; // divide by 1e18 to get in %
    }

    function getAccountLiquidity()
        external
        view
        returns (uint256 liquidity, uint256 shortfall)
    {
        // liquidity and shortfall in USD scaled up by 1e18
        (uint256 error, uint256 _liquidity, uint256 _shortfall) = comptroller
            .getAccountLiquidity(address(this));
        require(error == 0, "error");
        return (_liquidity, _shortfall);
    }

    function getPriceFeed(address _cToken) external view returns (uint256) {
        // scaled up by 1e18
        return priceFeed.getUnderlyingPrice(_cToken);
    }

    function enterMarket() external {
        address[] memory cTokens = new address[](1);
        cTokens[0] = address(cTokenSupply);
        uint256[] memory errors = comptroller.enterMarkets(cTokens);
        require(errors[0] == 0, "Comptroller.enterMarkets failed.");
    }

    function borrow(uint256 _amount) external {
        require(cTokenBorrow.borrow(_amount) == 0, "borrow failed");
    }

    function getBorrowBalance() public returns (uint256) {
        return cTokenBorrow.borrowBalanceCurrent(address(this));
    }
}

contract TestLiquidator {
    Comptroller public comptroller =
        Comptroller(0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B);

    IERC20 public tokenBorrow;
    CErc20 public cTokenBorrow;

    event Log(string message, uint256 val);

    constructor(address _tokenBorrow, address _cTokenBorrow) {
        tokenBorrow = IERC20(_tokenBorrow);
        cTokenBorrow = CErc20(_cTokenBorrow);
    }

    function getCloseFactor() external view returns (uint256) {
        return comptroller.closeFactorMantissa();
    }

    function getLiquidationIncentive() external view returns (uint256) {
        return comptroller.liquidationIncentiveMantissa();
    }

    function getAmountToBeLiquidated(
        address _cTokenBorrowed,
        address _cTokenCollateral,
        uint256 _actualRepayAmount
    ) external view returns (uint256) {
        (uint256 error, uint256 cTokenCollateralAmount) = comptroller
            .liquidateCalculateSeizeTokens(
                _cTokenBorrowed,
                _cTokenCollateral,
                _actualRepayAmount
            );

        require(error == 0, "error");

        return cTokenCollateralAmount;
    }

    // execute liquidation
    function liquidate(
        address _borrower,
        uint256 _repayAmount,
        address _cTokenCollateral
    ) external {
        tokenBorrow.transferFrom(msg.sender, address(this), _repayAmount);
        tokenBorrow.approve(address(cTokenBorrow), _repayAmount);

        require(
            cTokenBorrow.liquidateBorrow(
                _borrower,
                _repayAmount,
                _cTokenCollateral
            ) == 0,
            "liquidate failed"
        );
    }

    function getSupplyBalance(address _cTokenCollateral)
        external
        returns (uint256)
    {
        return CErc20(_cTokenCollateral).balanceOfUnderlying(address(this));
    }
}
