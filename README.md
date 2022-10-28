# **Compound**
Compound is an algorithmic, autonomous interest rate protocol built for developers, to unlock a universe of open financial applications.  
This repository contains smart contracts that interact with the Compound protocol for different purposes.  
Smart contracts have been tested using npm and truffle by forking Ethereum mainnet into local chain.  
The method to fork Ethereum mainnet is explained in each project.  
openzeppelin test-helpers is also used in cases that we need time manipulation.  
Chai test framework is also used in cases that is needed.  

## **Long position on ETH - Compound V2 Protocol** 
long ETH using Compound and Uniswap protocols.

## **Liquidate Undercollateralized accounts - Compound V2 Protocol** 
on Compound when you borrow more than what you supplied , you are subject to liquidation . this means that someone else can repay a portion of the token you've borrowed and in return that person receives the token that you supplied at a discount .  
in this project I create a situation which borrowed amount is greater than the amount that we've supplied and after liqidate collateral by another contract.  

## **Borrow & Repay - Compound V2 Protocol** 
supplying crypto assets to the Compound Protocol and borrow another crypto asset using the supplied asset as collateral.  

## **Supply & Redeem - Compound V2 Protocol** 
supply a crypto assets to the Compound Protocol and earning a variable interest rate.  
redeem the asset we've supplied including interest.  