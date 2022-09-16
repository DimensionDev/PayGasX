import "./aa.init";
import { expect } from "chai";
import { ethers } from "hardhat";

import {
  DepositPaymaster,
  DepositPaymaster__factory,
  EntryPoint,
  MaskToken,
  MaskToken__factory,
  SimpleWallet,
  SimpleWallet__factory,
  SingletonFactory,
  SingletonFactory__factory,
  HappyRedPacket,
  HappyRedPacket__factory,
  TestCounter,
  TestCounter__factory,
} from "../types";

import { Signer, utils, Wallet } from "ethers";
import { hexZeroPad, parseEther } from "ethers/lib/utils";
import { UserOperation } from "../Objects/userOperation";
import { MaxUint256, creationParams } from "./constants";

import { AddressZero, createWalletOwner, createAddress, deployEntryPoint, signUserOp } from "./util";
import { uint256 } from "./solidityTypes";
import { revertToSnapShot, takeSnapshot } from "./helper";

describe("DepositPaymaster V2", () => {
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
  let contractWallet: SimpleWallet;
  let redPacket: HappyRedPacket;
  let counter: TestCounter;

  before(async function () {
    entryPoint = await deployEntryPoint(1, 1);
    entryPointStatic = entryPoint.connect(AddressZero);

    signers = await ethers.getSigners();
    contractCreator = signers[0];
    //creatorAddress = await contractCreator.getAddress();

    sponsor = signers[1];
    beneficiaryAddress = await sponsor.getAddress();

    walletOwner = createWalletOwner();

    maskToken = await new MaskToken__factory(contractCreator).deploy();
    paymaster = await new DepositPaymaster__factory(contractCreator).deploy(entryPoint.address, maskToken.address);
    walletFactory = await new SingletonFactory__factory(contractCreator).deploy();

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
    let wallet: SimpleWallet;

    before(async () => {
      wallet = await new SimpleWallet__factory(contractCreator).deploy(
        entryPoint.address,
        await contractCreator.getAddress(),
      );
    });

    it("should deposit and read balance", async () => {
      await paymaster.addDepositFor(wallet.address, 100);
      expect(await paymaster.depositInfo(wallet.address)).to.eql({ amount: 100 });
      //expect((await paymaster.depositInfo(contractWallet.address)).amount.toString()).to.eql("100");
    });

    it("should fail to withdraw without unlock", async () => {
      await paymaster.addDepositFor(wallet.address, 1);
      const paymasterWithdraw = await paymaster.populateTransaction
        .withdrawTokensTo(AddressZero, 1)
        .then((tx) => tx.data!);

      await expect(wallet.exec(paymaster.address, 0, paymasterWithdraw)).to.revertedWith(
        "DepositPaymaster: must unlockTokenDeposit",
      );
    });

    it("should fail to withdraw within the same block ", async () => {
      await paymaster.addDepositFor(wallet.address, 1);
      const paymasterUnlock = await paymaster.populateTransaction.unlockTokenDeposit().then((tx) => tx.data!);
      const paymasterWithdraw = await paymaster.populateTransaction
        .withdrawTokensTo(AddressZero, 1)
        .then((tx) => tx.data!);

      await expect(
        wallet.execBatch([paymaster.address, paymaster.address], [paymasterUnlock, paymasterWithdraw]),
      ).to.be.revertedWith("DepositPaymaster: must unlockTokenDeposit");
    });

    it("should succeed to withdraw after unlock", async () => {
      await paymaster.addDepositFor(wallet.address, 1);
      const paymasterUnlock = await paymaster.populateTransaction.unlockTokenDeposit().then((tx) => tx.data!);
      const target = createAddress();
      const paymasterWithdraw = await paymaster.populateTransaction.withdrawTokensTo(target, 1).then((tx) => tx.data!);
      await wallet.exec(paymaster.address, 0, paymasterUnlock);
      await wallet.exec(paymaster.address, 0, paymasterWithdraw);
      expect(await maskToken.balanceOf(target)).to.eq(1);
    });

    it("should fail to withdraw if amount more than balance", async () => {
      await paymaster.addDepositFor(wallet.address, 1);
      const paymasterUnlock = await paymaster.populateTransaction.unlockTokenDeposit().then((tx) => tx.data!);
      const target = createAddress();
      const paymasterWithdraw = await paymaster.populateTransaction.withdrawTokensTo(target, 2).then((tx) => tx.data!);
      await wallet.exec(paymaster.address, 0, paymasterUnlock);
      await expect(wallet.exec(paymaster.address, 0, paymasterWithdraw)).to.be.reverted;
    });
  });

  describe("Use $Mask Pay for Gas", () => {
    before(async () => {
      contractWallet = await new SimpleWallet__factory(contractCreator).deploy(entryPoint.address, walletOwner.address);
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
  const tokenApprovePaymaster = await maskToken.populateTransaction
    .approve(paymaster.address, MaxUint256)
    .then((tx) => tx.data!);
  const execApprove = await contractWallet.populateTransaction
    .execFromEntryPoint(maskToken.address, 0, tokenApprovePaymaster)
    .then((tx) => tx.data!);
  userOp1.callData = execApprove;
  const hardhatProvider = ethers.provider;
  await userOp1.estimateGas(hardhatProvider, entryPoint.address);

  const chainId = (await hardhatProvider.getNetwork()).chainId;
  userOp1.signature = signUserOp(userOp1, entryPoint.address, chainId, walletOwner.privateKey);

  return userOp1;
}

async function getExecTestContractUserOperation(
  nonce: uint256,
  contractWallet: SimpleWallet,
  paymaster: DepositPaymaster,
  maskToken: MaskToken,
  entryPoint: EntryPoint,
  walletOwner: Wallet,
  counter: TestCounter,
): Promise<UserOperation> {
  let userOp1 = new UserOperation();
  userOp1.nonce = nonce;
  userOp1.sender = contractWallet.address;
  userOp1.maxFeePerGas = utils.parseUnits("1", "gwei");
  userOp1.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
  userOp1.paymaster = paymaster.address;
  userOp1.paymasterData = hexZeroPad(maskToken.address, 32);

  const counterJustEmit = await counter.populateTransaction.justemit().then((tx) => tx.data!);
  const callData = await contractWallet.populateTransaction
    .execFromEntryPoint(counter.address, 0, counterJustEmit)
    .then((tx) => tx.data!);
  userOp1.callData = callData;
  const hardhatProvider = ethers.provider;
  await userOp1.estimateGas(hardhatProvider, entryPoint.address);

  const chainId = (await hardhatProvider.getNetwork()).chainId;
  userOp1.signature = signUserOp(userOp1, entryPoint.address, chainId, walletOwner.privateKey);

  return userOp1;
}

async function getApproveMaskToRedPacketUserOperation(
  nonce: uint256,
  contractWallet: SimpleWallet,
  paymaster: DepositPaymaster,
  maskToken: MaskToken,
  entryPoint: EntryPoint,
  walletOwner: Wallet,
  redPacket: HappyRedPacket,
): Promise<UserOperation> {
  let userOp1 = new UserOperation();
  userOp1.nonce = nonce;
  userOp1.sender = contractWallet.address;
  userOp1.maxFeePerGas = utils.parseUnits("1", "gwei");
  userOp1.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
  userOp1.paymaster = paymaster.address;
  userOp1.paymasterData = hexZeroPad(maskToken.address, 32);
  const tokenApprovePaymaster = await maskToken.populateTransaction
    .approve(redPacket.address, MaxUint256)
    .then((tx) => tx.data!);
  const execApprove = await contractWallet.populateTransaction
    .execFromEntryPoint(maskToken.address, 0, tokenApprovePaymaster)
    .then((tx) => tx.data!);
  userOp1.callData = execApprove;
  const hardhatProvider = ethers.provider;
  await userOp1.estimateGas(hardhatProvider, entryPoint.address);

  const chainId = (await hardhatProvider.getNetwork()).chainId;
  userOp1.signature = signUserOp(userOp1, entryPoint.address, chainId, walletOwner.privateKey);

  return userOp1;
}

async function getExecCreateRedPacketUserOperation(
  nonce: uint256,
  contractWallet: SimpleWallet,
  paymaster: DepositPaymaster,
  maskToken: MaskToken,
  entryPoint: EntryPoint,
  walletOwner: Wallet,
  redPacket: HappyRedPacket,
): Promise<UserOperation> {
  let userOp1 = new UserOperation();
  userOp1.nonce = nonce;
  userOp1.sender = contractWallet.address;
  userOp1.maxFeePerGas = utils.parseUnits("1", "gwei");
  userOp1.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
  userOp1.paymaster = paymaster.address;
  userOp1.paymasterData = hexZeroPad(maskToken.address, 32);

  const create_red_packet = await redPacket.populateTransaction
    .create_red_packet(
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
    )
    .then((tx) => tx.data!);
  const callData = await contractWallet.populateTransaction
    .execFromEntryPoint(redPacket.address, 0, create_red_packet)
    .then((tx) => tx.data!);

  userOp1.callData = callData;

  const hardhatProvider = ethers.provider;
  await userOp1.estimateGas(hardhatProvider, entryPoint.address);

  const chainId = (await hardhatProvider.getNetwork()).chainId;
  userOp1.signature = signUserOp(userOp1, entryPoint.address, chainId, walletOwner.privateKey);

  return userOp1;
}
