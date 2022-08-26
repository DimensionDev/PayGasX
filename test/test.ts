// reference: https://github.com/qbzzt/opengsn/blob/master/01_SimpleUse/test/testcontracts.js
import { use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { Contract, Signer, utils } from "ethers";
import { ethers, waffle } from "hardhat";
const { expect } = use(chaiAsPromised);
const { deployContract } = waffle;

describe("Wallet testing", () => {
  const mnemonic = "test test test test test test test test test test test junk";
  let userSigner: Signer;
  let userAddress: string;
  let userPrivateKey: string;
  let beneficialAccount: Signer;
  let salt = 0;
  // let testCreate2FactoryAddress = "0x9C410A51Be344D1C0bFF9dD2F9b7b7401f3029f5";

  let entryPoint: Contract;
  let simpleWallet: Contract;
  let simpleWalletAddress: string;
  let simpleWalletInitCode: utils.BytesLike;

  let chainId;

  it("sign", async () => {
    userPrivateKey = ethers.Wallet.fromMnemonic(mnemonic).privateKey;
    [userSigner, beneficialAccount] = await ethers.getSigners();
    let digest = utils.arrayify(utils.RLP.encode("0x1234"));
    let sig = await userSigner.signMessage(digest);
    console.log("start??");
    console.log(await userSigner.getAddress(), utils.recoverAddress(digest, sig));
  });
});
