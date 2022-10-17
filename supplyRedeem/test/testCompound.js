const { time } = require("@openzeppelin/test-helpers");
const assert = require("assert");
const BN = require("bn.js");
const { sendEther, pow } = require("./util");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

const IERC20 = artifacts.require("IERC20");
const CErc20 = artifacts.require("CErc20");
const TestCompound = artifacts.require("TestCompound");

contract("TestCompound", (accounts) => {
    // const WHALE = "0x22616bba2351cc5fe66612050ab2997b7561358c"       // WBTC_WHALE
    // const TOKEN = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"       // WBTC
    // const C_TOKEN = "0xC11b1268C1A384e55C48c2391d8d480264A3A7F4"     // CWBTC
    // in CWBTC contract minting is paused so we use DAI instead

    const WHALE = "0xcffad3200574698b78f32232aa9d63eabd290703"; // DAI_WHALE
    const TOKEN = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; // DAI
    const C_TOKEN = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643"; // cDAI
    const DEPOSIT_AMOUNT = pow(10, 18).mul(new BN(1));

    let testCompound;
    let token;
    let cToken;
    beforeEach(async () => {
        await sendEther(web3, accounts[0], WHALE, 1);

        testCompound = await TestCompound.new(TOKEN, C_TOKEN);
        token = await IERC20.at(TOKEN);
        cToken = await CErc20.at(C_TOKEN);

        const bal = await token.balanceOf(WHALE);
        console.log(`whale balance: ${bal}`);
        assert(bal.gte(DEPOSIT_AMOUNT), "bal < deposit");
    });

    const snapshot = async (testCompound, token, cToken) => {
        const { exchangeRate, supplyRate } = await testCompound.getInfo.call();

        return {
            exchangeRate,
            supplyRate,
            balanceOfUnderlying: await testCompound.balanceOfUnderlying.call(),
            token: await token.balanceOf(testCompound.address),
            cToken: await cToken.balanceOf(testCompound.address),
        };
    };

    it("supply and redeem", async () => {
        await token.approve(testCompound.address, DEPOSIT_AMOUNT, {
            from: WHALE,
        });

        await testCompound.supply(DEPOSIT_AMOUNT, {
            from: WHALE,
        });

        let after = await snapshot(testCompound, token, cToken);

        console.log("--- Supply DAI ---");
        console.log(`exchange rate ${after.exchangeRate}`);
        console.log(`supply rate ${after.supplyRate}`);
        console.log(`balance of underlying ${after.balanceOfUnderlying}`);
        console.log(`TOKEN balance ${after.token}`);
        console.log(`CTOKEN balance ${after.cToken}`);

        // accrue interest on supply
        const block = await web3.eth.getBlockNumber();
        await time.advanceBlockTo(block + 100);

        after = await snapshot(testCompound, token, cToken);

        console.log(`--- after some blocks... ---`);
        console.log(`balance of underlying ${after.balanceOfUnderlying}`);

        // test redeem
        const cTokenAmount = await cToken.balanceOf(testCompound.address);
        await testCompound.redeem(cTokenAmount, {
            from: WHALE,
        });

        after = await snapshot(testCompound, token, cToken);

        console.log(`--- After redeem ---`);
        console.log(`balance of underlying ${after.balanceOfUnderlying}`);
        console.log(`TOKEN balance ${after.token}`);
        console.log(`CTOKEN balance ${after.cToken}`);
    });
});
