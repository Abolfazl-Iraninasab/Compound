const { time } = require("@openzeppelin/test-helpers");
const assert = require("assert");
const BN = require("bn.js");
const { sendEther, pow } = require("./util");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
// const helper = require("./blockAdvancerHelper.js");

const IERC20 = artifacts.require("IERC20");
const CErc20 = artifacts.require("CErc20");
const TestLiquidation = artifacts.require("TestLiquidation");
const TestLiquidator = artifacts.require("TestLiquidator");

contract("TestLiquidation", (accounts) => {
    const SUPPLY_WHALE = "0x693942887922785105088f04e9906d16188e9388";    // WBTC_WHALE
    const TOKEN_SUPPLY = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";    // WBTC
    const C_TOKEN_SUPPLY = "0xccF4429DB6322D5C611ee964527D42E5d685DD6a";  // CWBTC
    const TOKEN_BORROW = "0x6B175474E89094C44Da98b954EedeAC495271d0F";    // DAI
    const C_TOKEN_BORROW = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";  // CDAI
    const LIQUIDATOR = "0xF977814e90dA44bFA03b6295A0616a897441aceC";      // DAI_WHALE

    const SUPPLY_DECIMALS = 8;
    const SUPPLY_AMOUNT = pow(10, SUPPLY_DECIMALS).mul(new BN(1));
    const BORROW_DECIMALS = 18;

    let testCompound;
    let tokenSupply;
    let cTokenSupply;
    let tokenBorrow;
    let cTokenBorrow;
    let liquidator;
    beforeEach(async () => {
        await sendEther(web3, accounts[0], SUPPLY_WHALE, 1);
        await sendEther(web3, accounts[0], LIQUIDATOR, 1);

        testCompound = await TestLiquidation.new(
            TOKEN_SUPPLY,
            C_TOKEN_SUPPLY,
            TOKEN_BORROW,
            C_TOKEN_BORROW
        );
        tokenSupply = await IERC20.at(TOKEN_SUPPLY);
        cTokenSupply = await CErc20.at(C_TOKEN_SUPPLY);
        tokenBorrow = await IERC20.at(TOKEN_BORROW);
        cTokenBorrow = await CErc20.at(C_TOKEN_BORROW);
        liquidator = await TestLiquidator.new(TOKEN_BORROW, C_TOKEN_BORROW);

        const supplyBal = await tokenSupply.balanceOf(SUPPLY_WHALE);
        console.log(
            `suuply whale balance: ${supplyBal.div(pow(10, SUPPLY_DECIMALS))}`
        );
        assert(supplyBal.gte(SUPPLY_AMOUNT), "bal < supply");
    });

    const snapshot = async (testCompound, liquidator) => {
        const supplied = await testCompound.getSupplyBalance.call();
        const borrowed = await testCompound.getBorrowBalance.call();
        const colFactor = await testCompound.getCollateralFactor();
        const { liquidity, shortfall } =
            await testCompound.getAccountLiquidity();
        const price = await testCompound.getPriceFeed(C_TOKEN_BORROW);
        const closeFactor = await liquidator.getCloseFactor();
        const incentive = await liquidator.getLiquidationIncentive();
        const liquidated = await liquidator.getSupplyBalance.call(
            C_TOKEN_SUPPLY
        );

        return {
            colFactor: colFactor.div(pow(10, 18 - 2)),
            supplied: supplied.div(pow(10, SUPPLY_DECIMALS - 2)) / 100,
            borrowed: borrowed.div(pow(10, BORROW_DECIMALS - 2)) / 100,
            price: price.div(pow(10, 18 - 2)) / 100,
            liquidity: liquidity.div(pow(10, 14)) / 10000,
            shortfall: shortfall.div(pow(10, 14)) / 10000,
            closeFactor: closeFactor.div(pow(10, 18 - 2)),
            incentive: incentive.div(pow(10, 18 - 2)) / 100,
            liquidated: liquidated.div(pow(10, SUPPLY_DECIMALS - 4)) / 10000,
        };
    };

    describe("supply,borrow,liquidate", async () => {
        it("supply asset", async () => {
            let tx;
            let snap;

            // supply
            await tokenSupply.approve(testCompound.address, SUPPLY_AMOUNT, {
                from: SUPPLY_WHALE,
            });
            tx = await testCompound.supply(SUPPLY_AMOUNT, {
                from: SUPPLY_WHALE,
            });

            snap = await snapshot(testCompound, liquidator);
            console.log(`--- supplied ---`);
            console.log(`col factor: ${snap.colFactor} %`);
            console.log(`supplied: ${snap.supplied}`);
        });

        it("borrow asset", async () => {
            // enter market
            tx = await testCompound.enterMarket({ from: accounts[0] });

            // borrow
            const { liquidity } = await testCompound.getAccountLiquidity();
            const price = await testCompound.getPriceFeed(C_TOKEN_BORROW);
            const maxBorrow = liquidity
                .mul(pow(10, BORROW_DECIMALS))
                .div(price);
            // NOTE: tweak borrow amount if borrow fails
            const borrowAmount = maxBorrow.mul(new BN(9999)).div(new BN(10000));

            console.log(`--- entered market ---`);
            console.log(`liquidity: $ ${liquidity.div(pow(10, 18))}`);
            console.log(`price: $ ${price.div(pow(10, 18))}`);
            console.log(`max borrow: ${maxBorrow.div(pow(10, 18))}`);
            console.log(`borrow amount: ${borrowAmount.div(pow(10, 18))}`);

            tx = await testCompound.borrow(borrowAmount, { from: accounts[0] });

            snap = await snapshot(testCompound, liquidator);
            console.log(`--- borrowed ---`);
            console.log(`liquidity: $ ${snap.liquidity}`);
            console.log(`borrowed: ${snap.borrowed}`);
        });

        it("advance block number", async () => {
            ///////////////////////////////////////////////////////////////////////////////////////////////////
            console.log(`--------before advance block----------`);
            const blockIndex1 = await web3.eth.getBlock("latest"); // .then(console.log)
            console.log(`blockIndex1 => timestamp:${await blockIndex1.timestamp} , number:${await blockIndex1.number}`);
            // web3.eth.getBlock("latest").then(console.log);

            await time.advanceBlockTo(await blockIndex1.number + 2000 );

            /////////  second way to advance block and time using blockAdvancerHelper.js ///////////
            // const advancement = 2000;
            // const originalBlock = web3.eth.getBlock('latest');
            // const newBlock = await helper.advanceTimeAndBlock(web3,advancement);
            // const timeDiff = newBlock.timestamp - originalBlock.timestamp;
            // console.log(timeDiff)
            //////////////////////////////////////////////////////////

            console.log(`------after advance 2000 block-------`);
            const blockIndex2 = await web3.eth.getBlock("latest"); // .then(console.log)
            console.log(`blockIndex2 => timestamp:${await blockIndex2.timestamp} , number:${await blockIndex2.number}`);
            // web3.eth.getBlock("latest").then(console.log);

            ///////////////////////////////////////////////////////////////////////////////////////////////////

            snap = await snapshot(testCompound, liquidator);
            console.log(`liquidity: $ ${snap.liquidity}`);
            console.log(`shortfall: $ ${snap.shortfall}`);
            console.log(`borrowed: ${snap.borrowed}`);
            console.log(
                `current balance : ${web3.utils.fromWei(
                    await web3.eth.getBalance(LIQUIDATOR)
                )}`
            );
            // assert(snap.shortfall.gt(0))

            // add timeount to increase/override the default timeout value
            // advancing too many blocks caused the test to be slow
        }).timeout(1000000);

        it("should liquidate", async () => {
            // liquidation
            const closeFactor = await liquidator.getCloseFactor();
            const repayAmount = (await testCompound.getBorrowBalance.call())
                .mul(closeFactor)
                .div(pow(10, 18));

            const liqBal = await tokenBorrow.balanceOf(LIQUIDATOR);
            console.log(
                `liquidator balance: ${liqBal.div(pow(10, BORROW_DECIMALS))}`
            );
            assert(liqBal.gte(repayAmount), "bal < repay");

            const amountToBeLiquidated =
                await liquidator.getAmountToBeLiquidated(
                    C_TOKEN_BORROW,
                    C_TOKEN_SUPPLY,
                    repayAmount
                );
            console.log(
                `amount to be liquidated (cToken collateral):  ${
                    amountToBeLiquidated.div(pow(10, SUPPLY_DECIMALS - 2)) / 100
                }`
            );

            await tokenBorrow.approve(liquidator.address, repayAmount, {
                from: LIQUIDATOR,
            });

            const currentBalance = new BN(
                await web3.eth.getBalance(LIQUIDATOR)
            );
            console.log(`balance : ${currentBalance.div(pow(10, 18))} ETH`);

            tx = await liquidator.liquidate(
                testCompound.address,
                repayAmount,
                C_TOKEN_SUPPLY,
                {
                    from: LIQUIDATOR,
                }
            );

            snap = await snapshot(testCompound, liquidator);
            console.log(`--- liquidated ---`);
            console.log(`liquidation incentive: ${snap.incentive}`);
            console.log(`liquidity: $ ${snap.liquidity}`);
            console.log(`shortfall: $ ${snap.shortfall}`);
            console.log(`liquidated: ${snap.liquidated}`);
        });
    });
});

/*
ganache-cli --fork https://mainnet.infura.io/v3/5bc20cad614a4604b5a4ee51e8023cb9 --unlock 0xF977814e90dA44bFA03b6295A0616a897441aceC --unlock 0x693942887922785105088f04e9906d16188e9388  --networkId 999
*/
