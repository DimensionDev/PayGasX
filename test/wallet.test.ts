import { expect } from "chai";
import { utils, Wallet } from "ethers";
import { ethers } from "hardhat";

import SimpleWalletArtifact from "../artifacts/contracts/SimpleWalletUpgradeable.sol/SimpleWalletUpgradeable.json";

import { SimpleWalletUpgradeable, SimpleWalletUpgradeable__factory, WalletProxy__factory } from "../types";
import { createWalletOwner, ONE_ETH, TWO_ETH } from "./testutils";

describe("SimpleWallet", function () {
  const entryPoint = "0x".padEnd(42, "2");
  let accounts: string[];
  let walletOwner: Wallet;
  const ethersSigner = ethers.provider.getSigner();

  before(async function () {
    accounts = await ethers.provider.listAccounts();
    // ignore in geth.. this is just a sanity test. should be refactored to use a single-account mode..
    if (accounts.length < 2) this.skip();
    walletOwner = createWalletOwner();
  });

  it("owner should be able to call transfer", async () => {
    const account = accounts[0];
    const walletLogicContract = await new SimpleWalletUpgradeable__factory(ethers.provider.getSigner()).deploy();

    const simpleWalletInterface = new utils.Interface(SimpleWalletArtifact.abi);
    const data = simpleWalletInterface.encodeFunctionData("initialize", [entryPoint, account]);

    const wallet = await new WalletProxy__factory(ethers.provider.getSigner()).deploy(
      account,
      walletLogicContract.address,
      data,
    );

    await wallet.deployed();

    //TODO: how to simplify proxy contract type binding
    const walletContract = new ethers.Contract(
      wallet.address,
      SimpleWalletArtifact.abi,
      ethers.provider.getSigner(),
    ) as SimpleWalletUpgradeable;

    await ethersSigner.sendTransaction({ from: accounts[0], to: wallet.address, value: TWO_ETH });

    await expect(await ethers.provider.getBalance(walletContract.address)).to.be.eq(TWO_ETH);

    await walletContract.transfer(accounts[2], ONE_ETH);

    await expect(await ethers.provider.getBalance(walletContract.address)).to.be.eq(ONE_ETH);
  });
});
