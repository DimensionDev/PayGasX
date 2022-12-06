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
      6,
      1e15,
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

  describe("Success cases", () => {
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
      expect(maskBalance).to.be.eq(6);
      expect(credit).to.be.eq(1e15);
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
      const gasCostApproveRedPacket = await paymaster.estimateCost(userOp);
      await maskToken.connect(contractCreator).transfer(walletInfo.address, gasCostApproveRedPacket);
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
      //#endregion
    });
  });
});
