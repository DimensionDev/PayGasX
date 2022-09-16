import { ethers, waffle } from "hardhat";
import {
  DepositPaymaster,
  DepositPaymaster__factory,
  EntryPoint,
  MaskToken,
  MaskToken__factory,
  SimpleWalletUpgradeable,
  TESTNFT__factory,
} from "../types";
import "./aa.init";

import { hexZeroPad, parseEther } from "ethers/lib/utils";
import { deployWallet, ONE_ETH } from "./testutils";
import { fillAndSign } from "./UserOp";
import { createAddress, createWalletOwner, deployEntryPoint, FIVE_ETH, TWO_ETH } from "./util";

const { deployContract } = waffle;

describe("#gasReport", () => {
  let entryPoint: EntryPoint;
  const ethersSigner = ethers.provider.getSigner();
  const walletOwner = createWalletOwner();
  let beneficiary = createAddress();
  let maskToken: MaskToken;
  let paymaster: DepositPaymaster;
  let wallet: SimpleWalletUpgradeable;

  before(async function () {
    entryPoint = await deployEntryPoint(1, 1);
    maskToken = await new MaskToken__factory(ethersSigner).deploy();

    paymaster = await new DepositPaymaster__factory(ethersSigner).deploy(entryPoint.address, maskToken.address);
    await paymaster.addStake(0, { value: parseEther("2") });
    await entryPoint.depositTo(paymaster.address, { value: parseEther("1") });
    await maskToken.approve(paymaster.address, ethers.constants.MaxUint256);

    wallet = await deployWallet(entryPoint.address, walletOwner.address);

    await paymaster.addDepositFor(wallet.address, FIVE_ETH);

    await maskToken.transfer(wallet.address, TWO_ETH);
    await paymaster.setMaskToEthRadio(2000);

    await ethersSigner.sendTransaction({
      to: wallet.address,
      value: FIVE_ETH,
    });

    const tokenApprovePaymaster = await maskToken.populateTransaction
      .approve(paymaster.address, ethers.constants.MaxUint256)
      .then((tx) => tx.data!);
    const execApprove = await wallet.populateTransaction
      .execFromEntryPoint(maskToken.address, 0, tokenApprovePaymaster)
      .then((tx) => tx.data!);
    const userOp1 = await fillAndSign(
      {
        sender: wallet.address,
        paymaster: paymaster.address,
        paymasterData: hexZeroPad(maskToken.address, 32),
        callData: execApprove,
      },
      walletOwner,
      entryPoint,
    );
    await entryPoint.handleOps([userOp1], beneficiary);
  });

  it("should export 4337 transfer ether gas(call directly by wallet owner)", async () => {
    await ethersSigner.sendTransaction({
      to: walletOwner.address,
      value: ONE_ETH,
    });
    await wallet.connect(walletOwner).transfer(createAddress(), ONE_ETH);
  });

  it("should export 4337 transfer ether gas(call by entry point)", async () => {
    const calldata = "0x";
    const exec = await wallet.populateTransaction
      .execFromEntryPoint(createAddress(), ONE_ETH, calldata)
      .then((tx) => tx.data!);
    const userOp = await fillAndSign(
      {
        sender: wallet.address,
        paymaster: paymaster.address,
        paymasterData: hexZeroPad(maskToken.address, 32),
        callData: exec,
      },
      walletOwner,
      entryPoint,
    );
    await entryPoint.handleOps([userOp], beneficiary);
  });

  it("should export 4337 erc20 transfer gas", async () => {
    const calldata = await maskToken.populateTransaction.transfer(createAddress(), 1).then((tx) => tx.data!);
    const exec = await wallet.populateTransaction
      .execFromEntryPoint(maskToken.address, 0, calldata)
      .then((tx) => tx.data!);
    const userOp = await fillAndSign(
      {
        sender: wallet.address,
        paymaster: paymaster.address,
        paymasterData: hexZeroPad(maskToken.address, 32),
        callData: exec,
      },
      walletOwner,
      entryPoint,
    );
    await entryPoint.handleOps([userOp], beneficiary);
  });

  it("should export 4337 mint an NFT gas", async () => {
    const testNft = await new TESTNFT__factory(ethersSigner).deploy();

    const calldata = await testNft.populateTransaction.mint(createAddress()).then((tx) => tx.data!);
    const exec = await wallet.populateTransaction
      .execFromEntryPoint(testNft.address, 0, calldata)
      .then((tx) => tx.data!);
    const userOp = await fillAndSign(
      {
        sender: wallet.address,
        paymaster: paymaster.address,
        paymasterData: hexZeroPad(maskToken.address, 32),
        callData: exec,
      },
      walletOwner,
      entryPoint,
    );
    await entryPoint.handleOps([userOp], beneficiary);
  });

  it("should export 4337 claim an red packet gas", async () => {});
});
