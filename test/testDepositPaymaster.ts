import "./aa.init";
import { ethers, waffle } from "hardhat";
import { expect } from "chai";
import {
  SimpleWallet,
  SimpleWallet__factory,
  EntryPoint,
  DepositPaymaster,
  DepositPaymaster__factory,
  MaskToken,
  MaskToken__factory,
  TestCounter,
  TestCounter__factory,
  HappyRedPacket,
  HappyRedPacket__factory,
} from "../types";
//const { deployContract } = waffle;

import {
  AddressZero,
  createAddress,
  createWalletOwner,
  deployEntryPoint,
  FIVE_ETH,
  ONE_ETH,
  TWO_ETH,
} from "./testutils";
import { fillAndSign } from "./UserOp";
import { hexZeroPad, parseEther } from "ethers/lib/utils";
import { Signer, utils } from "ethers";
import { creationParams } from "./constants";
import RedpacketArtifact from "../artifacts/contracts/test/RedPacket.sol/HappyRedPacket.json";

const { deployContract } = waffle;

describe("DepositPaymaster", () => {
  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  const ethersSigner = ethers.provider.getSigner();
  let maskToken: MaskToken;
  let paymaster: DepositPaymaster;
  let redpacket: HappyRedPacket;

  before(async function () {
    entryPoint = await deployEntryPoint(1, 1);
    entryPointStatic = entryPoint.connect(AddressZero);
    maskToken = await new MaskToken__factory(ethersSigner).deploy();

    paymaster = await new DepositPaymaster__factory(ethersSigner).deploy(entryPoint.address, maskToken.address);
    await paymaster.addStake(0, { value: parseEther("2") });
    await entryPoint.depositTo(paymaster.address, { value: parseEther("1") });

    await maskToken.mint(await ethersSigner.getAddress(), FIVE_ETH);
    await maskToken.approve(paymaster.address, ethers.constants.MaxUint256);
  });

  describe("deposit and withdraw", () => {
    let wallet: SimpleWallet;

    before(async () => {
      wallet = await new SimpleWallet__factory(ethersSigner).deploy(
        entryPoint.address,
        await ethersSigner.getAddress(),
      );
    });
    it("should deposit and read balance", async () => {
      await paymaster.addDepositFor(wallet.address, 100);
      expect(await paymaster.depositInfo(wallet.address)).to.eql({ amount: 100 });
    });
    it("should fail to withdraw without unlock", async () => {
      const paymasterWithdraw = await paymaster.populateTransaction
        .withdrawTokensTo(AddressZero, 1)
        .then((tx) => tx.data!);

      await expect(wallet.exec(paymaster.address, 0, paymasterWithdraw)).to.revertedWith(
        "DepositPaymaster: must unlockTokenDeposit",
      );
    });
    it("should fail to withdraw within the same block ", async () => {
      const paymasterUnlock = await paymaster.populateTransaction.unlockTokenDeposit().then((tx) => tx.data!);
      const paymasterWithdraw = await paymaster.populateTransaction
        .withdrawTokensTo(AddressZero, 1)
        .then((tx) => tx.data!);

      await expect(
        wallet.execBatch([paymaster.address, paymaster.address], [paymasterUnlock, paymasterWithdraw]),
      ).to.be.revertedWith("DepositPaymaster: must unlockTokenDeposit");
    });
    it("should succeed to withdraw after unlock", async () => {
      const paymasterUnlock = await paymaster.populateTransaction.unlockTokenDeposit().then((tx) => tx.data!);
      const target = createAddress();
      const paymasterWithdraw = await paymaster.populateTransaction.withdrawTokensTo(target, 1).then((tx) => tx.data!);
      await wallet.exec(paymaster.address, 0, paymasterUnlock);
      await wallet.exec(paymaster.address, 0, paymasterWithdraw);
      expect(await maskToken.balanceOf(target)).to.eq(1);
    });
  });

  describe("#validatePaymasterUserOp", () => {
    let wallet: SimpleWallet;
    const gasPrice = 1e9;
    let walletOwner: string;

    before(async () => {
      walletOwner = await ethersSigner.getAddress();
      wallet = await new SimpleWallet__factory(ethersSigner).deploy(entryPoint.address, walletOwner);
    });

    it("should fail if no token", async () => {
      const userOp = await fillAndSign(
        {
          sender: wallet.address,
          paymaster: paymaster.address,
        },
        ethersSigner,
        entryPoint,
      );
      await expect(entryPointStatic.callStatic.simulateValidation(userOp)).to.be.revertedWith(
        "paymasterData must specify token",
      );
    });

    it("should reject if no deposit", async () => {
      const userOp = await fillAndSign(
        {
          sender: wallet.address,
          paymaster: paymaster.address,
          paymasterData: hexZeroPad(maskToken.address, 32),
        },
        ethersSigner,
        entryPoint,
      );
      await expect(entryPointStatic.callStatic.simulateValidation(userOp, { gasPrice })).to.be.revertedWith(
        "DepositPaymaster: deposit too low",
      );
    });

    it("should reject if deposit is not locked", async () => {
      await paymaster.addDepositFor(wallet.address, ONE_ETH);

      const paymasterUnlock = await paymaster.populateTransaction.unlockTokenDeposit().then((tx) => tx.data!);
      await wallet.exec(paymaster.address, 0, paymasterUnlock);

      const userOp = await fillAndSign(
        {
          sender: wallet.address,
          paymaster: paymaster.address,
          paymasterData: hexZeroPad(maskToken.address, 32),
        },
        ethersSigner,
        entryPoint,
      );
      await expect(entryPointStatic.callStatic.simulateValidation(userOp, { gasPrice })).to.be.revertedWith(
        "not locked",
      );
    });

    it("succeed with valid deposit", async () => {
      // needed only if previous test did unlock.
      const paymasterLockTokenDeposit = await paymaster.populateTransaction.lockTokenDeposit().then((tx) => tx.data!);
      await wallet.exec(paymaster.address, 0, paymasterLockTokenDeposit);

      const userOp = await fillAndSign(
        {
          sender: wallet.address,
          paymaster: paymaster.address,
          paymasterData: hexZeroPad(maskToken.address, 32),
        },
        ethersSigner,
        entryPoint,
      );
      await entryPointStatic.callStatic.simulateValidation(userOp);
    });
  });

  describe("#handleOps", () => {
    let wallet: SimpleWallet;
    const walletOwner = createWalletOwner();
    let counter: TestCounter;
    let callData: string;
    before(async () => {
      wallet = await new SimpleWallet__factory(ethersSigner).deploy(entryPoint.address, walletOwner.address);
      counter = await new TestCounter__factory(ethersSigner).deploy();
      const counterJustEmit = await counter.populateTransaction.justemit().then((tx) => tx.data!);
      callData = await wallet.populateTransaction
        .execFromEntryPoint(counter.address, 0, counterJustEmit)
        .then((tx) => tx.data!);

      await paymaster.addDepositFor(wallet.address, ONE_ETH);
    });
    it("should pay with deposit (and revert user's call) if user can't pay with maskTokens", async () => {
      const beneficiary = createAddress();
      const userOp = await fillAndSign(
        {
          sender: wallet.address,
          paymaster: paymaster.address,
          paymasterData: hexZeroPad(maskToken.address, 32),
          callData,
        },
        walletOwner,
        entryPoint,
      );

      await entryPoint.handleOps([userOp], beneficiary);

      const [log] = await entryPoint.queryFilter(entryPoint.filters.UserOperationEvent());
      expect(log.args.success).to.eq(false);
      expect(await counter.queryFilter(counter.filters.CalledFrom())).to.eql([]);
      expect(await ethers.provider.getBalance(beneficiary)).to.be.gt(0);
    });

    it("should pay with tokens if available", async () => {
      const beneficiary = createAddress();
      const beneficiary1 = createAddress();
      const initialTokens = parseEther("1");
      await maskToken.mint(wallet.address, initialTokens);
      await paymaster.setMaskToEthRadio(2000);
      console.log("before balance", await maskToken.balanceOf(wallet.address));

      // need to "approve" the paymaster to use the tokens. we issue a UserOp for that (which uses the deposit to execute)
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
      await entryPoint.handleOps([userOp1], beneficiary1);

      const userOp = await fillAndSign(
        {
          sender: wallet.address,
          paymaster: paymaster.address,
          paymasterData: hexZeroPad(maskToken.address, 32),
          callData,
        },
        walletOwner,
        entryPoint,
      );
      await entryPoint.handleOps([userOp], beneficiary);

      const [log] = await entryPoint.queryFilter(
        entryPoint.filters.UserOperationEvent(),
        await ethers.provider.getBlockNumber(),
      );
      expect(log.args.success).to.eq(true);
      const charge = log.args.actualGasCost;
      expect(await ethers.provider.getBalance(beneficiary)).to.eq(charge);

      const targetLogs = await counter.queryFilter(counter.filters.CalledFrom());
      expect(targetLogs.length).to.eq(1);
      console.log("after balance", await maskToken.balanceOf(wallet.address));
    });
  });

  describe("#create a RedPacket", () => {
    let wallet: SimpleWallet;
    let redpacket: HappyRedPacket;
    const walletOwner = createWalletOwner();
    let callData: string;

    before(async () => {
      wallet = await new SimpleWallet__factory(ethersSigner).deploy(entryPoint.address, walletOwner.address);
      redpacket = await new HappyRedPacket__factory(ethersSigner).deploy();
      const initialTokens = parseEther("3");
      await maskToken.mint(wallet.address, initialTokens);
      const create_red_packet = await redpacket.populateTransaction
        .create_red_packet(
          wallet.address,
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

      callData = await wallet.populateTransaction
        .execFromEntryPoint(redpacket.address, 0, create_red_packet)
        .then((tx) => tx.data!);

      await paymaster.addDepositFor(wallet.address, TWO_ETH);
    });

    it("should pay with tokens to create redpacket", async () => {
      const beneficiary = createAddress();
      const beneficiary1 = createAddress();

      console.log("before balance", await maskToken.balanceOf(wallet.address));

      // need to "approve" the paymaster to use the tokens. we issue a UserOp for that (which uses the deposit to execute)
      const tokenApprovePaymaster = await maskToken.populateTransaction
        .approve(paymaster.address, ethers.constants.MaxUint256)
        .then((tx) => tx.data!);
      const execApprovePaymaster = await wallet.populateTransaction
        .execFromEntryPoint(maskToken.address, 0, tokenApprovePaymaster)
        .then((tx) => tx.data!);

      let userOp1 = await fillAndSign(
        {
          sender: wallet.address,
          paymaster: paymaster.address,
          paymasterData: hexZeroPad(maskToken.address, 32),
          callData: execApprovePaymaster,
        },
        walletOwner,
        entryPoint,
      );
      await entryPoint.handleOps([userOp1], beneficiary1);

      //approve to redpacket contract to use maskToken
      const tokenApproveRedpacket = await maskToken.populateTransaction
        .approve(redpacket.address, ethers.constants.MaxUint256)
        .then((tx) => tx.data!);
      const execApproveRedpacket = await wallet.populateTransaction
        .execFromEntryPoint(maskToken.address, 0, tokenApproveRedpacket)
        .then((tx) => tx.data!);

      let userOp2 = await fillAndSign(
        {
          sender: wallet.address,
          paymaster: paymaster.address,
          paymasterData: hexZeroPad(maskToken.address, 32),
          callData: execApproveRedpacket,
        },
        walletOwner,
        entryPoint,
      );
      await entryPoint.handleOps([userOp2], beneficiary1);

      const userOp = await fillAndSign(
        {
          sender: wallet.address,
          paymaster: paymaster.address,
          paymasterData: hexZeroPad(maskToken.address, 32),
          callData,
        },
        walletOwner,
        entryPoint,
      );

      await entryPoint.handleOps([userOp], beneficiary);
      const createSuccess = (await redpacket.queryFilter(redpacket.filters.CreationSuccess()))[0];
      const results = createSuccess.args;
      expect(results).to.have.property("total").that.to.be.eq(creationParams.totalTokens.toString());
      expect(results).to.have.property("name").that.to.be.eq(creationParams.name);
      expect(results).to.have.property("message").that.to.be.eq(creationParams.message);
      expect(results).to.have.property("creator").that.to.be.eq(wallet.address);
      expect(results).to.have.property("creation_time");
      const creationTime = results.creation_time.toString();
      expect(creationTime).to.have.lengthOf(10);
    });
  });
});
