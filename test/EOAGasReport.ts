import { ethers, waffle } from "hardhat";
import { MaskToken, MaskToken__factory, TESTNFT__factory } from "../types";
import "./aa.init";

import { createAddress, createWalletOwner, TWO_ETH } from "./util";

const { deployContract } = waffle;

describe("#gasReport", () => {
  const ethersSigner = ethers.provider.getSigner();
  let maskToken: MaskToken;
  let wallet;

  before(async function () {
    maskToken = await new MaskToken__factory(ethersSigner).deploy();

    wallet = createWalletOwner();

    ethersSigner.sendTransaction({
      to: wallet.address,
      value: TWO_ETH,
    });

    await maskToken.transfer(wallet.address, TWO_ETH);
  });

  it("should export eoa erc20 approve gas", async () => {
    await maskToken.connect(wallet).approve(await ethersSigner.getAddress(), 1);
  });

  it("should export eoa erc20 transfer gas", async () => {
    await maskToken.connect(wallet).transfer(await ethersSigner.getAddress(), 1);
  });

  it("should export 4337 mint an NFT gas", async () => {
    const testNft = await new TESTNFT__factory(ethersSigner).deploy();

    await testNft.connect(wallet).mint(createAddress());
  });

  it("should export 4337 claim an red packet gas", async () => {});
});
