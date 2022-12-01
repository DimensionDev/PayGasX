import { expect } from "chai";
import { ethers } from "hardhat";
import "./aa.init";

import {
  DepositPaymaster,
  DepositPaymaster__factory,
  EntryPoint,
  EntryPoint__factory,
  HappyRedPacket,
  HappyRedPacket__factory,
  MaskToken,
  MaskToken__factory,
  SimpleWallet,
  SingletonFactory,
  SingletonFactory__factory,
} from "../types";

import { constants, Contract, Signer, Wallet } from "ethers";
import { hexZeroPad, parseEther, parseUnits } from "ethers/lib/utils";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWallet.sol/SimpleWallet.json";
import { AddressZero, creationParams, MaxUint256, paymasterStake, unstakeDelaySec } from "./constants";
import { UserOperation } from "./entity/userOperation";
import { revertToSnapShot, takeSnapshot } from "./helper";
import { ContractWalletInfo, createDefaultUserOp, createWallet, getContractWalletInfo, signUserOp } from "./utils";
const hardhatProvider = ethers.provider;

describe("DepositPaymaster", () => {
  let walletOwner: Wallet;
  let contractCreator: Signer;
  let beneficiaryAddress: string;
  let sponsor: Signer;
  let signers: Signer[];

  let snapshotId: string;

  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  let maskToken: MaskToken;
  let paymaster: DepositPaymaster;
  let walletFactory: SingletonFactory;
  let redPacket: HappyRedPacket;

  before(async () => {
    signers = await ethers.getSigners();
    contractCreator = signers[0];
    sponsor = signers[1];
    beneficiaryAddress = await sponsor.getAddress();

    walletFactory = await new SingletonFactory__factory(contractCreator).deploy();
    entryPoint = await new EntryPoint__factory(contractCreator).deploy(
      walletFactory.address,
      paymasterStake,
      unstakeDelaySec,
    );
    entryPointStatic = entryPoint.connect(AddressZero);
    maskToken = await new MaskToken__factory(contractCreator).deploy();
    paymaster = await new DepositPaymaster__factory(contractCreator).deploy(entryPoint.address, maskToken.address);
    redPacket = await new HappyRedPacket__factory(contractCreator).deploy();

    await paymaster.addStake(0, { value: parseEther("1000") });
    await entryPoint.depositTo(paymaster.address, { value: parseEther("1000") });
    await maskToken.approve(paymaster.address, MaxUint256);
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  describe("Paymaster deposit and withdraw $mask token", () => {
    let contractWallet: SimpleWallet;
    let walletInfo: ContractWalletInfo;

    before(async () => {
      walletOwner = createWallet();
      let simpleWalletCreateSalt = 0;
      walletInfo = await getContractWalletInfo(
        simpleWalletCreateSalt,
        entryPoint.address,
        maskToken.address,
        paymaster.address,
        parseUnits("1", "ether"),
        walletOwner.address,
        walletFactory.address,
      );
      await walletFactory.connect(contractCreator).deploy(walletInfo.initCode, constants.HashZero);

      contractWallet = new Contract(walletInfo.address, SimpleWalletArtifact.abi, hardhatProvider) as SimpleWallet;
    });

    it("Should deposit and be able to read balance", async () => {
      await paymaster.addDepositFor(contractWallet.address, 100);
      expect(await paymaster.depositInfo(contractWallet.address)).to.be.eql({ amount: 100 });
    });

    it("Should fail to withdraw if not owner", async () => {
      await paymaster.addDepositFor(contractWallet.address, 1);
      const otherAcc = signers[4];
      await expect(paymaster.connect(otherAcc).withdrawTokensTo(contractWallet.address, 1)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Should succeed to withdraw", async () => {
      await paymaster.addDepositFor(contractWallet.address, 1);
      await paymaster.withdrawTokensTo(contractWallet.address, 1);
      expect(await maskToken.balanceOf(contractWallet.address)).to.eq(1);
    });

    it("Should fail to withdraw if the specified amount is more than balance", async () => {
      await paymaster.addDepositFor(contractWallet.address, 1);
      await expect(paymaster.withdrawTokensTo(contractWallet.address, 2)).to.be.reverted;
    });
  });

  describe("Use $MASK pay for gas", () => {
    let contractWallet: SimpleWallet;
    let walletInfo: ContractWalletInfo;

    before(async () => {
      walletOwner = createWallet();
      let simpleWalletCreateSalt = 0;
      walletInfo = await getContractWalletInfo(
        simpleWalletCreateSalt,
        entryPoint.address,
        maskToken.address,
        paymaster.address,
        parseUnits("1", "ether"),
        walletOwner.address,
        walletFactory.address,
      );

      await walletFactory.connect(contractCreator).deploy(walletInfo.initCode, constants.HashZero);
      contractWallet = new Contract(walletInfo.address, SimpleWalletArtifact.abi, hardhatProvider) as SimpleWallet;
    });

    it("Succeed to pay gas with $MASK for redpacket creation", async () => {
      //#region approve redPacket
      const userOp = await approveRedPacketContract(
        0,
        contractWallet,
        paymaster,
        maskToken,
        entryPoint,
        walletOwner,
        redPacket,
      );
      const gasCostApproveRedPacket = await paymaster.estimateCost(userOp);
      await paymaster.addDepositFor(contractWallet.address, gasCostApproveRedPacket);
      await maskToken.transfer(contractWallet.address, gasCostApproveRedPacket);
      try {
        const result = await entryPointStatic.callStatic.simulateValidation(userOp);
        if (result) {
          await entryPoint.connect(sponsor).handleOps([userOp], beneficiaryAddress);
          const allowance = await maskToken.allowance(contractWallet.address, redPacket.address);
          expect(allowance).to.be.eq(MaxUint256);
        }
      } catch (error) {
        console.error(error);
        throw new Error("Simulation error");
      }
      //#endregion

      //#region create redPacket
      let createRPUserOp = await createRedPacket(
        1,
        contractWallet,
        paymaster,
        maskToken,
        entryPoint,
        walletOwner,
        redPacket,
      );

      const gasCostExec = await paymaster.estimateCost(createRPUserOp);
      await paymaster.addDepositFor(contractWallet.address, gasCostExec);
      await maskToken.transfer(contractWallet.address, gasCostExec);

      try {
        const result = await entryPointStatic.callStatic.simulateValidation(createRPUserOp);
        if (result) {
          await entryPoint.connect(sponsor).handleOps([createRPUserOp], beneficiaryAddress);
          const createSuccess = (await redPacket.queryFilter(redPacket.filters.CreationSuccess()))[0];
          const results = createSuccess.args;
          expect(results).to.have.property("total").that.to.be.eq(creationParams.totalTokens.toString());
          expect(results).to.have.property("name").that.to.be.eq(creationParams.name);
          expect(results).to.have.property("message").that.to.be.eq(creationParams.message);
          expect(results).to.have.property("creator").that.to.be.eq(contractWallet.address);
          expect(results).to.have.property("creation_time");
        }
      } catch (error) {
        console.error(error);
        throw new Error("simulation error");
      }
      //#endregion
    });

    it("Should fail to approve if $MASK balance cannot afford gas fee, even though someone already helped to deposit", async () => {
      // Example userOp: approve redpacket contract
      const approveRPUserOp = await approveRedPacketContract(
        0,
        contractWallet,
        paymaster,
        maskToken,
        entryPoint,
        walletOwner,
        redPacket,
      );
      const gasCost = await paymaster.estimateCost(approveRPUserOp);
      await paymaster.addDepositFor(contractWallet.address, gasCost);

      try {
        const result = await entryPointStatic.callStatic.simulateValidation(approveRPUserOp);
        if (result) {
          await entryPoint.connect(sponsor).handleOps([approveRPUserOp], beneficiaryAddress);
          const allowance = await maskToken.allowance(contractWallet.address, redPacket.address);
          expect(allowance).to.be.eq(0);
        }
      } catch (error) {
        console.error(error);
        throw new Error("simulation error");
      }
    });

    it("Should fail if $MASK balance cannot pass validation because $MASK to $ETH ratio increased", async () => {
      const userOp = await approveRedPacketContract(
        0,
        contractWallet,
        paymaster,
        maskToken,
        entryPoint,
        walletOwner,
        redPacket,
      );
      const gasCost = await paymaster.estimateCost(userOp);
      await paymaster.addDepositFor(contractWallet.address, gasCost);
      await maskToken.transfer(contractWallet.address, gasCost);
      await paymaster.setMaskToEthRadio(15000);
      await expect(entryPointStatic.callStatic.simulateValidation(userOp)).to.be.revertedWith(
        "DepositPaymaster: deposit too low",
      );
    });
  });
});

async function approveRedPacketContract(
  nonce: number,
  contractWallet: SimpleWallet,
  paymaster: DepositPaymaster,
  maskToken: MaskToken,
  entryPoint: EntryPoint,
  walletOwner: Wallet,
  redPacket: HappyRedPacket,
): Promise<UserOperation> {
  let userOp = createDefaultUserOp(contractWallet.address);
  userOp.nonce = nonce;
  userOp.paymaster = paymaster.address;
  userOp.paymasterData = hexZeroPad(maskToken.address, 32);
  const tokenApproveData = maskToken.interface.encodeFunctionData("approve", [redPacket.address, MaxUint256]);
  userOp.callData = contractWallet.interface.encodeFunctionData("execFromEntryPoint", [
    maskToken.address,
    0,
    tokenApproveData,
  ]);
  await userOp.estimateGas(hardhatProvider, entryPoint.address);

  const chainId = (await hardhatProvider.getNetwork()).chainId;
  userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

  return userOp;
}

async function createRedPacket(
  nonce: number,
  contractWallet: SimpleWallet,
  paymaster: DepositPaymaster,
  maskToken: MaskToken,
  entryPoint: EntryPoint,
  walletOwner: Wallet,
  redPacket: HappyRedPacket,
): Promise<UserOperation> {
  let userOp = createDefaultUserOp(contractWallet.address);
  userOp.nonce = nonce;
  userOp.paymaster = paymaster.address;
  userOp.paymasterData = hexZeroPad(maskToken.address, 32);

  const createRedPacketData = redPacket.interface.encodeFunctionData("create_red_packet", [
    contractWallet.address,
    creationParams.number,
    creationParams.ifrandom,
    creationParams.duration,
    creationParams.seed,
    creationParams.message,
    creationParams.name,
    1,
    maskToken.address,
    creationParams.totalTokens,
  ]);

  userOp.callData = contractWallet.interface.encodeFunctionData("execFromEntryPoint", [
    redPacket.address,
    0,
    createRedPacketData,
  ]);
  await userOp.estimateGas(hardhatProvider, entryPoint.address);

  const chainId = (await hardhatProvider.getNetwork()).chainId;
  userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

  return userOp;
}
