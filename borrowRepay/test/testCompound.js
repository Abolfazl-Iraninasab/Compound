const { time } = require("@openzeppelin/test-helpers");
const assert = require("assert");
const BN = require("bn.js");
const { sendEther, pow } = require("./util");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

const IERC20 = artifacts.require("IERC20");
const CErc20 = artifacts.require("CErc20");
const TestCompound = artifacts.require("TestCompound");

contract("TestCompound", (accounts) => {
    // const WHALE = "0x8a446971dbb112f3be15bc38c14d44b94d9e94b9"   // USDT_WHALE
    // const TOKEN = "0xdAC17F958D2ee523a2206206994597C13D831ec7"   // USDT
    // const C_TOKEN = "0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9" // cUSDT

    // const WHALE = "0xcffad3200574698b78f32232aa9d63eabd290703"   // DAI_WHALE
    // const TOKEN = "0x6B175474E89094C44Da98b954EedeAC495271d0F"   // DAI
    // const C_TOKEN = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643" // cDAi

    const WHALE = "0x28f1d5fe896db571cba7679863dd4e1272d49eac"   // USDC_WHALE
    const TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"   // USDC
    const C_TOKEN = "0x39AA39c021dfbaE8faC545936693aC917d5E7563" // cUSDC

    const TOKEN_TO_BORROW = "0x6B175474E89094C44Da98b954EedeAC495271d0F"   // DAI 
    const C_TOKEN_TO_BORROW = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643" // cDAI
    const REPAY_WHALE = "0xcffad3200574698b78f32232aa9d63eabd290703" // DAI_WHALE (repay interest on borrow)
    // 	ganache-cli --fork https://mainnet.infura.io/v3/5bc20cad614a4604b5a4ee51e8023cb9 --unlock 0x28f1d5fe896db571cba7679863dd4e1272d49eac --unlock 0xcffad3200574698b78f32232aa9d63eabd290703 --networkId 999 


    const SUPPLY_DECIMALS = 6;         // USDT has 6 decimals
    const SUPPLY_AMOUNT = pow(10, SUPPLY_DECIMALS).mul(new BN(100));
    const BORROW_DECIMALS = 18;
    const BORROW_INTEREST = pow(10, BORROW_DECIMALS).mul(new BN(1000));

    let testCompound;
    let token;
    let cToken;
    let tokenToBorrow;
    let cTokenToBorrow;
    beforeEach(async () => {
        await sendEther(web3, accounts[0], WHALE, 1);

        testCompound = await TestCompound.new(TOKEN, C_TOKEN);
        token = await IERC20.at(TOKEN);
        cToken = await CErc20.at(C_TOKEN);
        tokenToBorrow = await IERC20.at(TOKEN_TO_BORROW);
        cTokenToBorrow = await CErc20.at(C_TOKEN_TO_BORROW);

        const supplyBal = await token.balanceOf(WHALE);
        console.log(
            `suuply whale balance: ${supplyBal.div(pow(10, SUPPLY_DECIMALS))}`
        );
        assert(supplyBal.gte(SUPPLY_AMOUNT), "bal < supply");

        const borrowBal = await tokenToBorrow.balanceOf(REPAY_WHALE);
        console.log(
            `repay whale balance: ${borrowBal.div(pow(10, BORROW_DECIMALS))}`
        );
        assert(borrowBal.gte(BORROW_INTEREST), "bal < borrow interest");
    });

    const snapshot = async (_testCompound, tokenToBorrow) => {
        const { liquidity } = await _testCompound.getAccountLiquidity();
        const colFactor = await _testCompound.getCollateralFactor();
        const supplied = await _testCompound.balanceOfUnderlying.call();
        const price = await _testCompound.getPriceFeed(C_TOKEN_TO_BORROW);
        const maxBorrow = liquidity.div(price);
        const borrowedBalance = await _testCompound.getBorrowedBalance.call(
            C_TOKEN_TO_BORROW
        );
        const tokenToBorrowBal = await tokenToBorrow.balanceOf(
            _testCompound.address
        );
        const borrowRate = await _testCompound.getBorrowRatePerBlock.call(
            C_TOKEN_TO_BORROW
        );

        return {
            colFactor: colFactor.div(pow(10, 18 - 2)) / 100,
            supplied: supplied.div(pow(10, SUPPLY_DECIMALS - 2)) / 100,
            price: price.div(pow(10, 18 - 2)) / 100,
            liquidity: liquidity.div(pow(10, 18)),
            maxBorrow,
            borrowedBalance:
                borrowedBalance.div(pow(10, BORROW_DECIMALS - 2)) / 100,
            tokenToBorrowBal:
                tokenToBorrowBal.div(pow(10, BORROW_DECIMALS - 2)) / 100,
            borrowRate,
        };
    };

    it("should supply, borrow and repay", async () => {
        // used for debugging
        let snap;
        console.log(`--------before supply---------`)
        console.log(`cToken balance of test contract: ${await cToken.balanceOf(testCompound.address)}`);
        // await cToken.balanceOf(testCompound)
        // supply
        await token.approve(testCompound.address, SUPPLY_AMOUNT, {
            from: WHALE,
        });
        await testCompound.supply(SUPPLY_AMOUNT, {
            from: WHALE,
        });

        // borrow
        snap = await snapshot(testCompound, tokenToBorrow);
        console.log(`------- after supply , before borrow  -------`);
        console.log(`cToken balance of test contract: ${await cToken.balanceOf(testCompound.address)}`);
        console.log(`collateral factor: ${snap.colFactor} %`);
        console.log(`supplied: ${snap.supplied}`);
        console.log(`liquidity: $ ${snap.liquidity}`);
        console.log(`price: $ ${snap.price}`);
        console.log(`max borrow: ${snap.maxBorrow}`);
        console.log(`borrowed balance (compound): ${snap.borrowedBalance}`);
        console.log(`borrowed balance (erc20): ${snap.tokenToBorrowBal}`);
        console.log(`borrow rate: ${snap.borrowRate}`);

        await testCompound.borrow(C_TOKEN_TO_BORROW, BORROW_DECIMALS, {
            from: WHALE,
        });

        snap = await snapshot(testCompound, tokenToBorrow);
        console.log(`--- after borrow  ---`);
        console.log(`cToken balance of test contract: ${await cToken.balanceOf(testCompound.address)}`)
        console.log(`liquidity: $ ${snap.liquidity}`);
        console.log(`max borrow: ${snap.maxBorrow}`);
        console.log(`borrowed balance (compound): ${snap.borrowedBalance}`);
        console.log(`borrowed balance (erc20): ${snap.tokenToBorrowBal}`);

        // accrue interest on borrow
        const block = await web3.eth.getBlockNumber();
        await time.advanceBlockTo(block + 1000);

        snap = await snapshot(testCompound, tokenToBorrow);
        console.log(`--- after some blocks... ---`);
        console.log(`liquidity: $ ${snap.liquidity}`);
        console.log(`max borrow: ${snap.maxBorrow}`);
        console.log(`borrowed balance (compound): ${snap.borrowedBalance}`);
        console.log(`borrowed balance (erc20): ${snap.tokenToBorrowBal}`);

        // repay
        await tokenToBorrow.transfer(testCompound.address, BORROW_INTEREST, {
            from: REPAY_WHALE,
        });
        const MAX_UINT = pow(2, 256).sub(new BN(1));
        await testCompound.repay(
            TOKEN_TO_BORROW,
            C_TOKEN_TO_BORROW,
            MAX_UINT,
            {
                from: REPAY_WHALE,
            }
        );

        snap = await snapshot(testCompound, tokenToBorrow);
        console.log(`--- after repay ---`);
        console.log(`cToken balance of test contract: ${await cToken.balanceOf(testCompound.address)}`)
        console.log(`liquidity: $ ${snap.liquidity}`);
        console.log(`max borrow: ${snap.maxBorrow}`);
        console.log(`borrowed balance (compound): ${snap.borrowedBalance}`);
        console.log(`borrowed balance (erc20): ${snap.tokenToBorrowBal}`);
    });
});
