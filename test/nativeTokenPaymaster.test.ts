import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { Contract, Signer, Wallet } from "ethers";
import { Interface, parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWalletUpgradeable.sol/SimpleWalletUpgradeable.json";
import {
  EntryPoint,
  EntryPoint__factory,
  MaskToken,
  MaskToken__factory,
  NativeTokenPaymaster,
  NativeTokenPaymaster__factory,
  SimpleWalletUpgradeable,
  SimpleWalletUpgradeable__factory,
  SingletonFactory,
  SingletonFactory__factory,
} from "../types";
import { AddressZero, MaxUint256, paymasterStake, unstakeDelaySec } from "./constants";
import { revertToSnapShot, takeSnapshot } from "./helper";
import { ContractWalletInfo, createDefaultUserOp, createWallet, getProxyWalletInfo, signUserOp } from "./utils";
const hardhatProvider = ethers.provider;

describe("Native Token Paymaster", () => {
  let walletOwner: Wallet;
  let contractCreator: Signer;
  let faucet: Signer;
  let beneficiaryAddress: string;
  let bundler: Signer;
  let signers: Signer[];

  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  let paymaster: NativeTokenPaymaster;
  let walletFactory: SingletonFactory;
  let maskToken: MaskToken;
  let walletLogic: SimpleWalletUpgradeable;

  let snapshotId: string;

  before(async () => {
    signers = await ethers.getSigners();
    contractCreator = signers[0];
    bundler = signers[1];
    faucet = signers[2];
    beneficiaryAddress = await bundler.getAddress();

    walletFactory = await new SingletonFactory__factory(contractCreator).deploy();
    entryPoint = await new EntryPoint__factory(contractCreator).deploy(
      walletFactory.address,
      paymasterStake,
      unstakeDelaySec,
    );
    entryPointStatic = entryPoint.connect(AddressZero);
    maskToken = await new MaskToken__factory(contractCreator).deploy();
    paymaster = await new NativeTokenPaymaster__factory(contractCreator).deploy(entryPoint.address);
    walletLogic = await new SimpleWalletUpgradeable__factory(contractCreator).deploy();

    const contractCreatorAddress = await contractCreator.getAddress();
    await paymaster.connect(contractCreator).adjustAdmin(contractCreatorAddress, true);
    await paymaster.addStake(0, { value: parseEther("100") });
    await entryPoint.depositTo(paymaster.address, { value: parseEther("100") });
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  describe("Success case", () => {
    let walletInfo: ContractWalletInfo;
    let simpleWalletCreateSalt = 0;
    before(async () => {
      walletOwner = createWallet();
      const initializeData = walletLogic.interface.encodeFunctionData("initialize", [
        entryPoint.address,
        walletOwner.address,
        AddressZero,
        paymaster.address,
        0,
      ]);
      walletInfo = await getProxyWalletInfo(
        simpleWalletCreateSalt,
        walletLogic.address,
        initializeData,
        walletOwner.address,
        walletFactory.address,
      );

      await setUpWallet(walletInfo.address);
    });

    it("Should succeed to go through the entire workflow", async () => {
      const credit = await paymaster.credits(walletInfo.address);
      expect(credit).to.be.eq(parseEther("1"));
      const testAcc = signers[4];

      const walletInterface = new Interface(SimpleWalletArtifact.abi);
      let userOp = createDefaultUserOp(walletInfo.address);
      userOp.nonce = simpleWalletCreateSalt;
      userOp.initCode = walletInfo.initCode;
      userOp.paymaster = paymaster.address;
      const tokenApproveData = maskToken.interface.encodeFunctionData("approve", [
        await testAcc.getAddress(),
        MaxUint256,
      ]);
      userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        tokenApproveData,
      ]);
      await userOp.estimateGas(hardhatProvider, entryPoint.address);
      const chainId = (await hardhatProvider.getNetwork()).chainId;
      userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);
      try {
        const result = await entryPointStatic.callStatic.simulateValidation(userOp);
        if (result) {
          await entryPoint.connect(bundler).handleOps([userOp], beneficiaryAddress);
          const allowance = await maskToken.allowance(walletInfo.address, await testAcc.getAddress());
          expect(allowance).to.be.eq(MaxUint256);
        }
      } catch (error) {
        console.error(error);
        throw new Error("Simulation error");
      }
    });
  });

  describe("util function test", () => {
    let walletInfo: ContractWalletInfo;
    let simpleWalletCreateSalt = 0;
    before(async () => {
      walletOwner = createWallet();
      const initializeData = walletLogic.interface.encodeFunctionData("initialize", [
        entryPoint.address,
        walletOwner.address,
        AddressZero,
        paymaster.address,
        0,
      ]);
      walletInfo = await getProxyWalletInfo(
        simpleWalletCreateSalt,
        walletLogic.address,
        initializeData,
        walletOwner.address,
        walletFactory.address,
      );
    });

    it("addDepositFor fail if call with unauthorized account", async () => {
      await expect(paymaster.connect(bundler).addDepositFor(walletInfo.address, parseEther("1"))).to.be.revertedWith(
        "Paymaster: you are not admin",
      );
    });

    it("Should adjust admin fail if call with unauthorized account", async () => {
      await expect(paymaster.connect(bundler).adjustAdmin(walletInfo.address, true)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Should withdraw token fail with unauthorized account", async () => {
      await expect(paymaster.connect(bundler).withdrawBalance(walletInfo.address, 1)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Should withdraw token success with authorized account", async () => {
      await faucet.sendTransaction({
        to: paymaster.address,
        value: parseEther("2"),
      });

      const paymasterBalanceBefore = await hardhatProvider.getBalance(paymaster.address);
      const walletBalanceBefore = await hardhatProvider.getBalance(walletInfo.address);
      await paymaster.connect(contractCreator).withdrawBalance(walletInfo.address, parseEther("1"));
      const paymasterBalanceAfter1 = await hardhatProvider.getBalance(paymaster.address);
      const walletBalanceAfter1 = await hardhatProvider.getBalance(walletInfo.address);
      expect(paymasterBalanceBefore.sub(paymasterBalanceAfter1)).to.be.eq(parseEther("1"));
      expect(walletBalanceAfter1.sub(walletBalanceBefore)).to.be.eq(parseEther("1"));

      await paymaster.connect(contractCreator).withdrawBalance(walletInfo.address, parseEther("1.5"));
      const paymasterBalanceAfter2 = await hardhatProvider.getBalance(paymaster.address);
      const walletBalanceAfter2 = await hardhatProvider.getBalance(walletInfo.address);
      expect(paymasterBalanceAfter1.sub(paymasterBalanceAfter2)).to.be.eq(parseEther("1"));
      expect(walletBalanceAfter2.sub(walletBalanceAfter1)).to.be.eq(parseEther("1"));
    });

    it("Should depositToEP fail with unauthorized account", async () => {
      await faucet.sendTransaction({
        to: paymaster.address,
        value: parseEther("2"),
      });

      await expect(paymaster.connect(bundler).depositToEP(parseEther("1"))).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Should depositToEP token success with authorized account", async () => {
      await faucet.sendTransaction({
        to: paymaster.address,
        value: parseEther("2"),
      });

      const paymasterBalanceBefore = await hardhatProvider.getBalance(paymaster.address);
      const depositBefore = (await entryPoint.getDepositInfo(paymaster.address)).deposit;
      await paymaster.connect(contractCreator).depositToEP(parseEther("1"));
      const paymasterBalanceAfter1 = await hardhatProvider.getBalance(paymaster.address);
      const depositAfter1 = (await entryPoint.getDepositInfo(paymaster.address)).deposit;
      expect(paymasterBalanceBefore.sub(paymasterBalanceAfter1)).to.be.eq(parseEther("1"));
      expect(depositAfter1.sub(depositBefore)).to.be.eq(parseEther("1"));

      await paymaster.connect(contractCreator).depositToEP(parseEther("1.5"));
      const paymasterBalanceAfter2 = await hardhatProvider.getBalance(paymaster.address);
      const depositAfter2 = (await entryPoint.getDepositInfo(paymaster.address)).deposit;
      expect(paymasterBalanceAfter1.sub(paymasterBalanceAfter2)).to.be.eq(parseEther("1"));
      expect(depositAfter2.sub(depositAfter1)).to.be.eq(parseEther("1"));
    });
  });

  describe("Exception case test", () => {
    describe("validatePaymasterUserOp check", () => {
      let walletInfo: ContractWalletInfo;
      let simpleWalletCreateSalt = 0;
      before(async () => {
        walletOwner = createWallet();
        const initializeData = walletLogic.interface.encodeFunctionData("initialize", [
          entryPoint.address,
          walletOwner.address,
          AddressZero,
          paymaster.address,
          0,
        ]);
        walletInfo = await getProxyWalletInfo(
          simpleWalletCreateSalt,
          walletLogic.address,
          initializeData,
          walletOwner.address,
          walletFactory.address,
        );
      });

      it("Should meet simulation error when condition is not satisfied", async () => {
        const credit = await paymaster.credits(walletInfo.address);
        expect(credit).to.be.eq(0);
        const testAcc = signers[4];

        const walletInterface = new Interface(SimpleWalletArtifact.abi);
        let userOp = createDefaultUserOp(walletInfo.address);
        userOp.nonce = simpleWalletCreateSalt;
        userOp.initCode = walletInfo.initCode;
        userOp.paymaster = paymaster.address;
        const tokenApproveData = maskToken.interface.encodeFunctionData("approve", [
          await testAcc.getAddress(),
          MaxUint256,
        ]);
        userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
          maskToken.address,
          0,
          tokenApproveData,
        ]);
        await userOp.estimateGas(hardhatProvider, entryPoint.address);
        const chainId = (await hardhatProvider.getNetwork()).chainId;
        userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

        await expect(entryPoint.connect(bundler).handleOps([userOp], beneficiaryAddress))
          .to.be.revertedWithCustomError(entryPoint, "FailedOp")
          .withArgs(anyValue, anyValue, "Paymaster: no enough native token");

        await faucet.sendTransaction({
          to: walletInfo.address,
          value: parseEther("1"),
        });

        await expect(entryPoint.connect(bundler).handleOps([userOp], beneficiaryAddress))
          .to.be.revertedWithCustomError(entryPoint, "FailedOp")
          .withArgs(anyValue, anyValue, "Paymaster: deposit too low");
        await paymaster.connect(contractCreator).addDepositFor(walletInfo.address, parseEther("1"));

        try {
          const result = await entryPointStatic.callStatic.simulateValidation(userOp);
          if (result) {
            await entryPoint.connect(bundler).handleOps([userOp], beneficiaryAddress);
            const allowance = await maskToken.allowance(walletInfo.address, await testAcc.getAddress());
            expect(allowance).to.be.eq(MaxUint256);
          }
        } catch (error) {
          console.error(error);
          throw new Error("Simulation error");
        }

        await faucet.sendTransaction({
          to: walletOwner.address,
          value: parseEther("1"),
        });
        walletOwner = walletOwner.connect(hardhatProvider);

        const walletContract = new Contract(
          walletInfo.address,
          walletInterface,
          hardhatProvider,
        ) as SimpleWalletUpgradeable;
        await walletContract.connect(walletOwner).changePaymaster(AddressZero);

        let userOpInvalidPaymaster = createDefaultUserOp(walletInfo.address);
        userOpInvalidPaymaster.nonce = 0;
        userOpInvalidPaymaster.paymaster = paymaster.address;
        userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
          maskToken.address,
          0,
          tokenApproveData,
        ]);
        await userOpInvalidPaymaster.estimateGas(hardhatProvider, entryPoint.address);
        userOpInvalidPaymaster.signature = signUserOp(
          userOpInvalidPaymaster,
          entryPoint.address,
          chainId,
          walletOwner.privateKey,
        );

        await expect(entryPoint.connect(bundler).handleOps([userOpInvalidPaymaster], beneficiaryAddress))
          .to.be.revertedWithCustomError(entryPoint, "FailedOp")
          .withArgs(anyValue, anyValue, "Paymaster: not registered in sender account");
      });
    });

    describe("PostOp check", () => {
      let walletInfo: ContractWalletInfo;
      let simpleWalletCreateSalt = 0;
      before(async () => {
        walletOwner = createWallet();
        const initializeData = walletLogic.interface.encodeFunctionData("initialize", [
          entryPoint.address,
          walletOwner.address,
          AddressZero,
          paymaster.address,
          0,
        ]);
        walletInfo = await getProxyWalletInfo(
          simpleWalletCreateSalt,
          walletLogic.address,
          initializeData,
          walletOwner.address,
          walletFactory.address,
        );

        await setUpWallet(walletInfo.address);
      });

      it("Should succeed to reduce credit and revert user call if transfer in postOp fails", async () => {
        const credit = await paymaster.credits(walletInfo.address);
        expect(credit).to.be.eq(parseEther("1"));
        const testAcc = signers[4];
        const testAccBalanceBefore = await hardhatProvider.getBalance(walletInfo.address);

        const walletInterface = new Interface(SimpleWalletArtifact.abi);
        let userOp = createDefaultUserOp(walletInfo.address);
        userOp.nonce = simpleWalletCreateSalt;
        userOp.initCode = walletInfo.initCode;
        userOp.paymaster = paymaster.address;
        userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
          await testAcc.getAddress(),
          parseEther("10"),
          "0x",
        ]);
        await userOp.estimateGas(hardhatProvider, entryPoint.address);
        const chainId = (await hardhatProvider.getNetwork()).chainId;
        userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);
        try {
          const result = await entryPointStatic.callStatic.simulateValidation(userOp);
          if (result) {
            await entryPoint.connect(bundler).handleOps([userOp], beneficiaryAddress);
            // reduce credit
            const credit = await paymaster.credits(walletInfo.address);
            expect(credit).to.be.lt(parseEther("1"));
            // user call reverted
            const testAccBalanceAfter = await hardhatProvider.getBalance(walletInfo.address);
            expect(testAccBalanceBefore).to.be.eq(testAccBalanceAfter);
          }
        } catch (error) {
          console.error(error);
          throw new Error("Simulation error");
        }
      });
    });
  });

  async function setUpWallet(walletAddress: string) {
    await faucet.sendTransaction({
      to: walletAddress,
      value: parseEther("10"),
    });

    await paymaster.connect(contractCreator).addDepositFor(walletAddress, parseEther("1"));
  }
});
