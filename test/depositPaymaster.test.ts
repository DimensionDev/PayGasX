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
  PresetFactory,
  PresetFactory__factory,
  SimpleWalletUpgradeable,
  SimpleWalletUpgradeable__factory,
  SingletonFactory,
  SingletonFactory__factory,
} from "../types";

import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { hexZeroPad, Interface, parseEther } from "ethers/lib/utils";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWalletUpgradeable.sol/SimpleWalletUpgradeable.json";
import { AddressZero, MaxUint256, paymasterStake, unstakeDelaySec } from "./constants";
import { revertToSnapShot, takeSnapshot } from "./helper";
import { ContractWalletInfo, createDefaultUserOp, createWallet, getProxyWalletInfo, signUserOp } from "./utils";
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const hardhatProvider = ethers.provider;

describe("DepositPaymaster", () => {
  let walletOwner: Wallet;
  let contractCreator: Signer;
  let beneficiaryAddress: string;
  let sponsor: Signer;
  let serverAddress: string;
  let serverAccount: Signer;
  let signers: Signer[];

  let snapshotId: string;

  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  let maskToken: MaskToken;
  let paymaster: DepositPaymaster;
  let walletFactory: SingletonFactory;
  let redPacket: HappyRedPacket;
  let presetFac: PresetFactory;
  let walletLogic: SimpleWalletUpgradeable;

  before(async () => {
    signers = await ethers.getSigners();
    contractCreator = signers[0];
    sponsor = signers[1];
    serverAccount = signers[2];
    serverAddress = await serverAccount.getAddress();
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
    presetFac = await new PresetFactory__factory(contractCreator).deploy(
      paymaster.address,
      serverAddress,
      maskToken.address,
      parseEther("6"),
      2e15,
    );
    walletLogic = await new SimpleWalletUpgradeable__factory(contractCreator).deploy();

    await paymaster.connect(contractCreator).adjustAdmin(presetFac.address, true);
    await paymaster.addStake(0, { value: parseEther("1000") });
    await entryPoint.depositTo(paymaster.address, { value: parseEther("1000") });
    await maskToken.connect(contractCreator).transfer(presetFac.address, parseEther("1000"));
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  describe("Success case", () => {
    let walletInfo: ContractWalletInfo;
    before(async () => {
      walletOwner = createWallet();
      let simpleWalletCreateSalt = 0;
      const initializeData = walletLogic.interface.encodeFunctionData("initialize", [
        entryPoint.address,
        walletOwner.address,
        maskToken.address,
        paymaster.address,
        MaxUint256,
      ]);
      walletInfo = await getProxyWalletInfo(
        simpleWalletCreateSalt,
        walletLogic.address,
        initializeData,
        walletOwner.address,
        walletFactory.address,
      );
    });

    it("Should succeed to go through the entire workflow", async () => {
      //#region preparation stage
      await presetFac.connect(serverAccount).setUpForAccount(walletInfo.address);
      const maskBalance = await maskToken.balanceOf(walletInfo.address);
      const credit = await paymaster.credits(walletInfo.address);
      expect(maskBalance).to.be.eq(parseEther("6"));
      expect(credit).to.be.eq(2e15);
      //#endregion

      //#region create contract wallet proxy via EP. OP: approve $MASK to redpacket contract
      const walletInterface = new Interface(SimpleWalletArtifact.abi);
      let userOp = createDefaultUserOp(walletInfo.address);
      userOp.nonce = 0;
      userOp.initCode = walletInfo.initCode;
      userOp.paymaster = paymaster.address;
      userOp.paymasterData = hexZeroPad(maskToken.address, 32);
      const tokenApproveData = maskToken.interface.encodeFunctionData("approve", [redPacket.address, MaxUint256]);
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
          await entryPoint.connect(sponsor).handleOps([userOp], beneficiaryAddress);
          const allowance = await maskToken.allowance(walletInfo.address, redPacket.address);
          expect(allowance).to.be.eq(MaxUint256);
        }
      } catch (error) {
        console.error(error);
        throw new Error("Simulation error");
      }

      const testAccount = createWallet();
      await paymaster.connect(contractCreator).withdraw(testAccount.address, 1);
      const testAccBalance = await maskToken.balanceOf(testAccount.address);
      expect(testAccBalance).to.be.eq(1);

      const paymasterMaskBalanceBefore = await maskToken.balanceOf(paymaster.address);
      const serverMaskBalanceBefore = await maskToken.balanceOf(serverAddress);
      await paymaster.connect(contractCreator).withdraw(serverAddress, paymasterMaskBalanceBefore);
      const paymasterMaskBalanceAfter = await maskToken.balanceOf(paymaster.address);
      const serverMaskBalanceAfter = await maskToken.balanceOf(serverAddress);
      expect(paymasterMaskBalanceAfter).to.be.eq(0);
      expect(serverMaskBalanceAfter.sub(serverMaskBalanceBefore)).to.be.eq(paymasterMaskBalanceBefore);
      //#endregion
    });
  });

  describe("Util func check", () => {
    let walletInfo: ContractWalletInfo;
    before(async () => {
      walletOwner = createWallet();
      let simpleWalletCreateSalt = 0;
      const initializeData = walletLogic.interface.encodeFunctionData("initialize", [
        entryPoint.address,
        walletOwner.address,
        maskToken.address,
        paymaster.address,
        MaxUint256,
      ]);
      walletInfo = await getProxyWalletInfo(
        simpleWalletCreateSalt,
        walletLogic.address,
        initializeData,
        walletOwner.address,
        walletFactory.address,
      );
    });

    it("Should add deposit fail with unauthorized account", async () => {
      await expect(
        paymaster.connect(contractCreator).addDepositFor(walletInfo.address, parseEther("1")),
      ).to.be.revertedWith("DepositPaymaster: you are not admin");
    });

    it("Should adjust admin fail with unauthorized account", async () => {
      await expect(paymaster.connect(sponsor).adjustAdmin(walletInfo.address, true)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Should succeed to adjust admin with authorized account", async () => {
      await paymaster.connect(contractCreator).adjustAdmin(serverAddress, true);
      const isAdministrator_0 = await paymaster.isAdmin(serverAddress);
      expect(isAdministrator_0).to.be.true;
      await paymaster.connect(contractCreator).adjustAdmin(serverAddress, false);
      const isAdministrator_1 = await paymaster.isAdmin(serverAddress);
      expect(isAdministrator_1).to.be.false;
    });

    it("Should withdraw token fail with unauthorized account", async () => {
      await expect(paymaster.connect(sponsor).withdraw(walletInfo.address, 1)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Should fail to set Mask to Matic ratio with unauthorized account", async () => {
      await expect(paymaster.connect(sponsor).setMaskToMaticRatio([1, 5])).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("Should fail to set Mask to Matic ratio with invalid param", async () => {
      await expect(paymaster.connect(contractCreator).setMaskToMaticRatio([1, 0])).to.be.revertedWith(
        "DepositPaymaster: invalid ratio",
      );

      await expect(paymaster.connect(contractCreator).setMaskToMaticRatio([0, 0])).to.be.revertedWith(
        "DepositPaymaster: invalid ratio",
      );

      await expect(paymaster.connect(contractCreator).setMaskToMaticRatio([0, 1])).to.be.revertedWith(
        "DepositPaymaster: invalid ratio",
      );
    });
  });

  describe("validatePaymasterUserOp check", () => {
    let walletInfo: ContractWalletInfo;
    before(async () => {
      walletOwner = createWallet();
      let simpleWalletCreateSalt = 0;
      const initializeData = walletLogic.interface.encodeFunctionData("initialize", [
        entryPoint.address,
        walletOwner.address,
        maskToken.address,
        paymaster.address,
        MaxUint256,
      ]);
      walletInfo = await getProxyWalletInfo(
        simpleWalletCreateSalt,
        walletLogic.address,
        initializeData,
        walletOwner.address,
        walletFactory.address,
      );
    });

    it("Should be meet simulation error when there is no deposit", async () => {
      const maskBalance = await maskToken.balanceOf(walletInfo.address);
      const credit = await paymaster.credits(walletInfo.address);
      expect(maskBalance).to.be.eq(0);
      expect(credit).to.be.eq(0);

      //#region create contract wallet proxy via EP. OP: approve $MASK to redpacket contract
      const walletInterface = new Interface(SimpleWalletArtifact.abi);
      let userOp = createDefaultUserOp(walletInfo.address);
      userOp.nonce = 0;
      userOp.initCode = walletInfo.initCode;
      userOp.paymaster = paymaster.address;
      userOp.paymasterData = hexZeroPad(maskToken.address, 32);
      const tokenApproveData = maskToken.interface.encodeFunctionData("approve", [redPacket.address, MaxUint256]);
      userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        tokenApproveData,
      ]);
      await userOp.estimateGas(hardhatProvider, entryPoint.address);
      const chainId = (await hardhatProvider.getNetwork()).chainId;
      userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);
      //TODO: fix customError handle with hardhat chai matcher
      await expect(entryPoint.connect(sponsor).handleOps([userOp], beneficiaryAddress)).to.be.revertedWithCustomError(
        entryPoint,
        "FailedOp",
      );
      //#endregion
    });

    it("Should be meet error when verificationGas is too low", async () => {
      await presetFac.connect(serverAccount).setUpForAccount(walletInfo.address);

      //#region create contract wallet proxy via EP. OP: approve $MASK to redpacket contract
      const walletInterface = new Interface(SimpleWalletArtifact.abi);
      let userOp = createDefaultUserOp(walletInfo.address);
      userOp.nonce = 0;
      userOp.initCode = walletInfo.initCode;
      userOp.paymaster = paymaster.address;
      userOp.paymasterData = hexZeroPad(maskToken.address, 32);
      const tokenApproveData = maskToken.interface.encodeFunctionData("approve", [redPacket.address, MaxUint256]);
      userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        tokenApproveData,
      ]);
      await userOp.estimateGas(hardhatProvider, entryPoint.address);
      userOp.verificationGas = 1000;
      const chainId = (await hardhatProvider.getNetwork()).chainId;
      userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);
      //TODO: fix customError handle with hardhat chai matcher
      await expect(entryPoint.connect(sponsor).handleOps([userOp], beneficiaryAddress)).to.be.revertedWithCustomError(
        entryPoint,
        "FailedOp",
      );
      //#endregion
    });

    it("Should be meet error when paymasterData is invalid", async () => {
      await presetFac.connect(serverAccount).setUpForAccount(walletInfo.address);

      //#region create contract wallet proxy via EP. OP: approve $MASK to redpacket contract
      const walletInterface = new Interface(SimpleWalletArtifact.abi);
      let userOp = createDefaultUserOp(walletInfo.address);
      userOp.nonce = 0;
      userOp.initCode = walletInfo.initCode;
      userOp.paymaster = paymaster.address;
      userOp.paymasterData = "0x";
      const tokenApproveData = maskToken.interface.encodeFunctionData("approve", [redPacket.address, MaxUint256]);
      userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        tokenApproveData,
      ]);
      await userOp.estimateGas(hardhatProvider, entryPoint.address);
      const chainId = (await hardhatProvider.getNetwork()).chainId;
      userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);
      //TODO: fix customError handle with hardhat chai matcher with reverted reason
      await expect(entryPoint.connect(sponsor).handleOps([userOp], beneficiaryAddress)).to.be.revertedWithCustomError(
        entryPoint,
        "FailedOp",
      );
      //#endregion
    });

    it("Should be meet error when the specified token address in paymasterData is not supported", async () => {
      await presetFac.connect(serverAccount).setUpForAccount(walletInfo.address);

      //#region create contract wallet proxy via EP. OP: approve $MASK to redpacket contract
      const walletInterface = new Interface(SimpleWalletArtifact.abi);
      let userOp = createDefaultUserOp(walletInfo.address);
      userOp.nonce = 0;
      userOp.initCode = walletInfo.initCode;
      userOp.paymaster = paymaster.address;
      userOp.paymasterData = hexZeroPad(redPacket.address, 32);
      const tokenApproveData = maskToken.interface.encodeFunctionData("approve", [redPacket.address, MaxUint256]);
      userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        tokenApproveData,
      ]);
      await userOp.estimateGas(hardhatProvider, entryPoint.address);
      const chainId = (await hardhatProvider.getNetwork()).chainId;
      userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);
      //TODO: fix customError handle with hardhat chai matcher with reverted reason
      await expect(entryPoint.connect(sponsor).handleOps([userOp], beneficiaryAddress)).to.be.revertedWithCustomError(
        entryPoint,
        "FailedOp",
      );
      //#endregion
    });
  });

  describe("postOp check", () => {
    let walletInfo: ContractWalletInfo;
    before(async () => {
      walletOwner = createWallet();
      let simpleWalletCreateSalt = 0;
      const initializeData = walletLogic.interface.encodeFunctionData("initialize", [
        entryPoint.address,
        walletOwner.address,
        maskToken.address,
        paymaster.address,
        MaxUint256,
      ]);
      walletInfo = await getProxyWalletInfo(
        simpleWalletCreateSalt,
        walletLogic.address,
        initializeData,
        walletOwner.address,
        walletFactory.address,
      );
    });

    it("Should succeed to reduce credit and revert user call if transfer in postOp fails", async () => {
      //#region preparation stage
      await presetFac.connect(serverAccount).setUpForAccount(walletInfo.address);
      const maskBalance = await maskToken.balanceOf(walletInfo.address);
      const credit = await paymaster.credits(walletInfo.address);
      expect(maskBalance).to.be.eq(parseEther("6"));
      expect(credit).to.be.eq(2e15);
      //#endregion

      //#region create contract wallet proxy via EP. OP: approve $MASK to redpacket contract
      const walletInterface = new Interface(SimpleWalletArtifact.abi);
      let userOp = createDefaultUserOp(walletInfo.address);
      userOp.nonce = 0;
      userOp.initCode = walletInfo.initCode;
      userOp.paymaster = paymaster.address;
      userOp.paymasterData = hexZeroPad(maskToken.address, 32);
      const tokenApproveData = maskToken.interface.encodeFunctionData("transfer", [redPacket.address, parseEther("6")]);
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
          await entryPoint.connect(sponsor).handleOps([userOp], beneficiaryAddress);
          // reduce credit
          const credit = await paymaster.credits(walletInfo.address);
          expect(credit).to.be.lt(2e15);
          // user call reverted
          const maskBalanceAfter = await maskToken.balanceOf(walletInfo.address);
          expect(maskBalanceAfter).to.be.eq(parseEther("6"));
        }
      } catch (error) {
        console.error(error);
        throw new Error("Simulation error");
      }
      //#endregion
    });
  });
});
