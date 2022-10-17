// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/Compound.sol";

contract TestCompound {
    IERC20 public token;
    CErc20 public cToken;
    Comptroller public comptroller =
        Comptroller(0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B);

    PriceFeed public priceFeed =
        PriceFeed(0x922018674c12a7F0D394ebEEf9B58F186CdE13c1);

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

    function balanceOfUnderlying() external returns (uint256) {
        return cToken.balanceOfUnderlying(address(this));
    }

    function getCollateralFactor() external view returns (uint256) {
        (bool isListed, uint256 colFactor, bool isComped) = comptroller.markets(
            address(cToken)
        );
        return colFactor; // divide by 1e18 to get in %
    }

    // account liquidity - calculate how much can I borrow?
    // sum of (supplied balance of market entered * col factor) - borrowed
    function getAccountLiquidity()
        external
        view
        returns (uint256 liquidity, uint256 shortfall)
    {
        // liquidity and shortfall in USD
        (uint256 error, uint256 _liquidity, uint256 _shortfall) = comptroller
            .getAccountLiquidity(address(this));
        require(error == 0, "error");
        return (_liquidity, _shortfall);
    }

    // USD price of token to borrow
    function getPriceFeed(address _cToken) external view returns (uint256) {
        // scaled up by 1e18
        return priceFeed.getUnderlyingPrice(_cToken);
    }

    function borrow(address _cTokenToBorrow, uint256 _decimals) external {
        address[] memory cTokens = new address[](1);
        cTokens[0] = address(cToken);
        uint256[] memory errors = comptroller.enterMarkets(cTokens); // enter market
        require(errors[0] == 0, "Comptroller.enterMarkets failed.");

        // check liquidity
        (uint256 error, uint256 liquidity, uint256 shortfall) = comptroller
            .getAccountLiquidity(address(this));
        require(error == 0, "error");
        require(shortfall == 0, "shortfall > 0");
        require(liquidity > 0, "liquidity = 0");

        // calculate max borrow
        uint256 price = priceFeed.getUnderlyingPrice(_cTokenToBorrow);
        uint256 maxBorrow = (liquidity * (10**_decimals)) / price;
        require(maxBorrow > 0, "max borrow = 0");

        uint256 amount = (maxBorrow * 40) / 100; // borrow 40% of max borrow
        require(CErc20(_cTokenToBorrow).borrow(amount) == 0, "borrow failed");
    }

    // borrowed balance (includes interest)
    function getBorrowedBalance(address _cTokenBorrowed)
        public
        returns (uint256)
    {
        return CErc20(_cTokenBorrowed).borrowBalanceCurrent(address(this));
    }

    // borrow rate
    function getBorrowRatePerBlock(address _cTokenBorrowed)
        external
        view
        returns (uint256)
    {
        // scaled up by 1e18
        return CErc20(_cTokenBorrowed).borrowRatePerBlock();
    }

    // repay borrow
    function repay(
        address _tokenBorrowed,
        address _cTokenBorrowed,
        uint256 _amount
    ) external {
        IERC20(_tokenBorrowed).approve(_cTokenBorrowed, _amount);
        // _amount = 2 ** 256 - 1 means repay all
        require(
            CErc20(_cTokenBorrowed).repayBorrow(_amount) == 0,
            "repay failed"
        );
    }
}
