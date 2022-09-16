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
  TestCounter,
  TestCounter__factory,
} from "../types";

import { constants, Contract, Signer, utils, Wallet } from "ethers";
import { hexZeroPad, parseEther } from "ethers/lib/utils";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWallet.sol/SimpleWallet.json";
import { UserOperation } from "../Objects/userOperation";
import { AddressZero, creationParams, MaxUint256, paymasterStake, unstakeDelaySec } from "./constants";
import { revertToSnapShot, takeSnapshot } from "./helper";
import { ContractWalletInfo, createWallet, getContractWalletInfo, signUserOp } from "./utils";
const hardhatProvider = ethers.provider;

describe("DepositPaymaster", () => {
  let walletOwner: Wallet;
  let contractCreator: Signer;
  let creatorAddress: string;
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
  let counter: TestCounter;

  before(async () => {
    signers = await ethers.getSigners();
    contractCreator = signers[0];
    sponsor = signers[1];
    creatorAddress = await contractCreator.getAddress();
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
    counter = await new TestCounter__factory(contractCreator).deploy();

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

  describe("paymaster deposit and withdraw $mask token", () => {
    let contractWallet: SimpleWallet;
    let walletInfo: ContractWalletInfo;

    before(async () => {
      walletOwner = createWallet();
      let simpleWalletCreateSalt = 0;
      walletInfo = await getContractWalletInfo(
        simpleWalletCreateSalt,
        entryPoint.address,
        walletOwner.address,
        walletFactory.address,
      );
      await walletFactory.connect(contractCreator).deploy(walletInfo.initCode, constants.HashZero);

      contractWallet = new Contract(walletInfo.address, SimpleWalletArtifact.abi, hardhatProvider) as SimpleWallet;
    });

    it("should deposit and read balance", async () => {
      await paymaster.addDepositFor(contractWallet.address, 100);
      expect(await paymaster.depositInfo(contractWallet.address)).to.eql({ amount: 100 });
      //expect((await paymaster.depositInfo(contractWallet.address)).amount.toString()).to.eql("100");
    });

    it("should fail to withdraw if not owner", async () => {
      await paymaster.addDepositFor(contractWallet.address, 1);
      const otherAcc = signers[4];
      await expect(paymaster.connect(otherAcc).withdrawTokensTo(contractWallet.address, 1)).to.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("should succeed to withdraw", async () => {
      await paymaster.addDepositFor(contractWallet.address, 1);
      await paymaster.withdrawTokensTo(contractWallet.address, 1);
      expect(await maskToken.balanceOf(contractWallet.address)).to.eq(1);
    });

    it("should fail to withdraw if amount more than balance", async () => {
      await paymaster.addDepositFor(contractWallet.address, 1);
      await expect(paymaster.withdrawTokensTo(contractWallet.address, 2)).to.be.reverted;
    });
  });

  describe("Use $Mask Pay for Gas", () => {
    let contractWallet: SimpleWallet;
    let walletInfo: ContractWalletInfo;

    before(async () => {
      walletOwner = createWallet();
      let simpleWalletCreateSalt = 0;
      walletInfo = await getContractWalletInfo(
        simpleWalletCreateSalt,
        entryPoint.address,
        walletOwner.address,
        walletFactory.address,
      );

      await walletFactory.connect(contractCreator).deploy(walletInfo.initCode, constants.HashZero);
      contractWallet = new Contract(walletInfo.address, SimpleWalletArtifact.abi) as SimpleWallet;
    });

    it("success to pay gas with $Mask for approve paymaster use token and create a redPacket", async () => {
      // approve UserOp
      const userOp1 = await getApproveUserOperation(contractWallet, paymaster, maskToken, entryPoint, walletOwner);
      const gasCost = await paymaster.estimateCost(userOp1);
      await paymaster.addDepositFor(contractWallet.address, gasCost);
      await maskToken.transfer(contractWallet.address, gasCost);
      try {
        const result = await entryPointStatic.callStatic.simulateValidation(userOp1);
        if (result) {
          await entryPoint.connect(sponsor).handleOps([userOp1], beneficiaryAddress);
          const allowance = await maskToken.allowance(contractWallet.address, paymaster.address);
          expect(allowance).to.be.eq(MaxUint256);
        }
      } catch (error) {
        console.error(error);
        throw new Error("simulateValidation error");
      }

      // approve redPacket
      const userOp2 = await getApproveMaskToRedPacketUserOperation(
        1,
        contractWallet,
        paymaster,
        maskToken,
        entryPoint,
        walletOwner,
        redPacket,
      );
      const gasCostApproveRedPacket = await paymaster.estimateCost(userOp2);
      await paymaster.addDepositFor(contractWallet.address, gasCostApproveRedPacket);
      await maskToken.transfer(contractWallet.address, gasCostApproveRedPacket);
      try {
        const result = await entryPointStatic.callStatic.simulateValidation(userOp2);
        if (result) {
          await entryPoint.connect(sponsor).handleOps([userOp2], beneficiaryAddress);
          const allowance = await maskToken.allowance(contractWallet.address, redPacket.address);
          expect(allowance).to.be.eq(MaxUint256);
        }
      } catch (error) {
        console.error(error);
        throw new Error("simulateValidation error");
      }

      // exec testCounter contract UserOp
      let userOp3 = await getExecCreateRedPacketUserOperation(
        2,
        contractWallet,
        paymaster,
        maskToken,
        entryPoint,
        walletOwner,
        redPacket,
      );

      const gasCostExec = await paymaster.estimateCost(userOp3);
      await paymaster.addDepositFor(contractWallet.address, gasCostExec);
      await maskToken.transfer(contractWallet.address, gasCostExec);

      try {
        const result = await entryPointStatic.callStatic.simulateValidation(userOp3);
        if (result) {
          await entryPoint.connect(sponsor).handleOps([userOp3], beneficiaryAddress);
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
        throw new Error("simulateValidation error");
      }
    });

    it("should be failed to approve if $mask token balance cannot afford to gas, even though someone already helped to deposit", async () => {
      // approve UserOp
      const userOp1 = await getApproveUserOperation(contractWallet, paymaster, maskToken, entryPoint, walletOwner);
      const gasCost = await paymaster.estimateCost(userOp1);
      await paymaster.addDepositFor(contractWallet.address, gasCost);

      try {
        const result = await entryPointStatic.callStatic.simulateValidation(userOp1);
        if (result) {
          await entryPoint.connect(sponsor).handleOps([userOp1], beneficiaryAddress);
          const allowance = await maskToken.allowance(contractWallet.address, paymaster.address);
          expect(allowance).to.be.eq(0);
        }
      } catch (error) {
        console.error(error);
        throw new Error("simulateValidation error");
      }
    });

    it("should be failed if $mask token balance cannot go through Validation balance check because $mask to eth ratio increased", async () => {
      // approve UserOp
      const userOp = await getApproveUserOperation(contractWallet, paymaster, maskToken, entryPoint, walletOwner);
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

async function getApproveUserOperation(
  contractWallet: SimpleWallet,
  paymaster: DepositPaymaster,
  maskToken: MaskToken,
  entryPoint: EntryPoint,
  walletOwner: Wallet,
): Promise<UserOperation> {
  let userOp1 = new UserOperation();
  userOp1.sender = contractWallet.address;
  userOp1.maxFeePerGas = utils.parseUnits("1", "gwei");
  userOp1.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
  userOp1.paymaster = paymaster.address;
  userOp1.paymasterData = hexZeroPad(maskToken.address, 32);
  const tokenApprovePaymaster = maskToken.interface.encodeFunctionData("approve", [paymaster.address, MaxUint256]);
  userOp1.callData = contractWallet.interface.encodeFunctionData("execFromEntryPoint", [
    maskToken.address,
    0,
    tokenApprovePaymaster,
  ]);
  await userOp1.estimateGas(hardhatProvider, entryPoint.address);

  const chainId = (await hardhatProvider.getNetwork()).chainId;
  userOp1.signature = signUserOp(userOp1, entryPoint.address, chainId, walletOwner.privateKey);

  return userOp1;
}

async function getApproveMaskToRedPacketUserOperation(
  nonce: number,
  contractWallet: SimpleWallet,
  paymaster: DepositPaymaster,
  maskToken: MaskToken,
  entryPoint: EntryPoint,
  walletOwner: Wallet,
  redPacket: HappyRedPacket,
): Promise<UserOperation> {
  let userOp = new UserOperation();
  userOp.nonce = nonce;
  userOp.sender = contractWallet.address;
  userOp.maxFeePerGas = utils.parseUnits("1", "gwei");
  userOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
  userOp.paymaster = paymaster.address;
  userOp.paymasterData = hexZeroPad(maskToken.address, 32);
  const tokenApprovePaymaster = maskToken.interface.encodeFunctionData("approve", [redPacket.address, MaxUint256]);
  userOp.callData = contractWallet.interface.encodeFunctionData("execFromEntryPoint", [
    maskToken.address,
    0,
    tokenApprovePaymaster,
  ]);
  await userOp.estimateGas(hardhatProvider, entryPoint.address);

  const chainId = (await hardhatProvider.getNetwork()).chainId;
  userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

  return userOp;
}

async function getExecCreateRedPacketUserOperation(
  nonce: number,
  contractWallet: SimpleWallet,
  paymaster: DepositPaymaster,
  maskToken: MaskToken,
  entryPoint: EntryPoint,
  walletOwner: Wallet,
  redPacket: HappyRedPacket,
): Promise<UserOperation> {
  let userOp = new UserOperation();
  userOp.nonce = nonce;
  userOp.sender = contractWallet.address;
  userOp.maxFeePerGas = utils.parseUnits("1", "gwei");
  userOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
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
