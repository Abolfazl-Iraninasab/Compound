const { time } = require("@openzeppelin/test-helpers");
const assert = require("assert");
const BN = require("bn.js");
const { sendEther, pow, frac } = require("./util");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

const IERC20 = artifacts.require("IERC20");
const TestCompoundLong = artifacts.require("TestCompoundLong");

contract("TestCompoundLong", (accounts) => {
    const ETH_WHALE = accounts[0];
    const CETH = "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5";
    const TOKEN_BORROW = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; // DAI
    const C_TOKEN_BORROW = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643"; // CDAI
    const REPAY_WHALE = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; // DAI_WHALE // used to repay interest on borrow

    const ETH_AMOUNT = pow(10, 18).mul(new BN(10));
    const BORROW_DECIMALS = 18;
    const BORROW_INTEREST = pow(10, BORROW_DECIMALS).mul(new BN(1000));

    let testCompound;
    let tokenBorrow;
    before(async () => {
        testCompound = await TestCompoundLong.new(
            CETH,
            C_TOKEN_BORROW,
            TOKEN_BORROW,
            18
        );
        tokenBorrow = await IERC20.at(TOKEN_BORROW);

        const borrowBal = await tokenBorrow.balanceOf(REPAY_WHALE);
        console.log(
            `repay whale balance: ${borrowBal.div(pow(10, BORROW_DECIMALS))}`
        );
        assert(borrowBal.gte(BORROW_INTEREST), "bal < borrow interest");
    });

    const snapshot = async (testCompound, tokenBorrow) => {
        const maxBorrow = await testCompound.getMaxBorrow();
        const ethBal = await web3.eth.getBalance(testCompound.address);
        const tokenBorrowBal = await tokenBorrow.balanceOf(
            testCompound.address
        );
        const supplied = await testCompound.getSuppliedBalance.call();
        const borrowed = await testCompound.getBorrowBalance.call();
        const { liquidity } = await testCompound.getAccountLiquidity();

        return {
            maxBorrow,
            eth: new BN(ethBal),
            tokenBorrow: tokenBorrowBal,
            supplied,
            borrowed,
            liquidity,
        };
    };

    describe("------------------ long position test ------------------", async () => {
        let snap;
        it("supply", async () => {
            await testCompound.supply({
                from: ETH_WHALE,
                value: ETH_AMOUNT,
            });

            snap = await snapshot(testCompound, tokenBorrow);
            console.log(`--- supplied ---`);
            console.log(`total lliquidity: ${snap.liquidity.div(pow(10, 18))}`);
            console.log(
                `max DAI that is borrowable : ${snap.maxBorrow.div(
                    pow(10, BORROW_DECIMALS)
                )}`
            );
        });

        let borrowAmount;
        it("borrow from compound", async () => {
            const maxBorrow = await testCompound.getMaxBorrow();
            borrowAmount = frac(maxBorrow, 50, 100);
            console.log(
                `borrow amount: ${borrowAmount.div(pow(10, BORROW_DECIMALS))}`
            );
        });
        it("Execute long postion : swap DAI for ETH", async () => {
            await testCompound.long(borrowAmount, { from: ETH_WHALE });

            snap = await snapshot(testCompound, tokenBorrow);
            console.log(`--- long ---`);
            console.log(`liquidity: ${snap.liquidity.div(pow(10, 18))}`);
            console.log(
                `borrowed: ${snap.borrowed.div(pow(10, BORROW_DECIMALS))}`
            );
            console.log(`eth: ${snap.eth.div(pow(10, 18))}`);
        });
        it("advance block to accrue interest on borrow ", async () => {
            const block = await web3.eth.getBlockNumber();
            await time.advanceBlockTo(block + 1000);
        });

        it("close position : swap ETH for DAI and repay the borrow amount ", async () => {
            await tokenBorrow.transfer(testCompound.address, BORROW_INTEREST, {
                from: REPAY_WHALE,
            });
            await testCompound.repay({
                from: ETH_WHALE,
            });

            snap = await snapshot(testCompound, tokenBorrow);
            console.log(`--- repay ---`);
            console.log(`liquidity: ${snap.liquidity.div(pow(10, 18))}`);
            console.log(
                `borrowed: ${snap.borrowed.div(pow(10, BORROW_DECIMALS))}`
            );
            console.log(`eth: ${snap.eth.div(pow(10, 18))}`);
            console.log(
                `token borrow: ${snap.tokenBorrow.div(
                    pow(10, BORROW_DECIMALS)
                )}`
            );
        });
    });
});

/*
ganache-cli --fork https://mainnet.infura.io/v3/5bc20cad614a4604b5a4ee51e8023cb9 --unlock 0xF977814e90dA44bFA03b6295A0616a897441aceC  --networkId 999 
*/
