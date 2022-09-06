import { expect } from "chai";
import { Wallet } from "ethers";
import { ethers } from "hardhat";

import { SimpleWalletUpgradeable } from "../types";
import { createWalletOwner, deployWallet, ONE_ETH, TWO_ETH } from "./testutils";

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
    const walletContract: SimpleWalletUpgradeable = await deployWallet(entryPoint, account);

    await ethersSigner.sendTransaction({ from: accounts[0], to: walletContract.address, value: TWO_ETH });
    await expect(await ethers.provider.getBalance(walletContract.address)).to.be.eq(TWO_ETH);
    await walletContract.transfer(accounts[2], ONE_ETH);
    await expect(await ethers.provider.getBalance(walletContract.address)).to.be.eq(ONE_ETH);
  });

  it("other account should not be able to call transfer", async () => {
    const account = accounts[0];
    const walletContract: SimpleWalletUpgradeable = await deployWallet(entryPoint, account);

    await expect(
      walletContract.connect(ethers.provider.getSigner(1)).transfer(accounts[2], ONE_ETH),
    ).to.be.revertedWith("only owner");
  });
});
