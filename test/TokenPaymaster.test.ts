import { expect } from "chai";
import { ethers } from "hardhat";
import "./aa.init";

import { constants, Contract, Signer, Wallet } from "ethers";
import { hexZeroPad, parseEther, parseUnits } from "ethers/lib/utils";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWallet.sol/SimpleWallet.json";
import {
  EntryPoint,
  EntryPoint__factory,
  HappyRedPacket,
  HappyRedPacket__factory,
  MaskToken,
  MaskToken__factory,
  SimpleWallet,
  SingletonFactory,
  SingletonFactory__factory,
  TokenPaymaster,
  TokenPaymaster__factory,
} from "../types";
import { AddressZero, creationParams, MaxUint256, paymasterStake, unstakeDelaySec } from "./constants";
import { UserOperation } from "./entity/userOperation";
import { revertToSnapShot, takeSnapshot } from "./helper";
import { ContractWalletInfo, createDefaultUserOp, createWallet, getContractWalletInfo, signUserOp } from "./utils";
const hardhatProvider = ethers.provider;

describe("TokenPaymaster", () => {
  let walletOwner: Wallet;
  let contractCreator: Signer;
  let beneficiaryAddress: string;
  let sponsor: Signer;
  let signers: Signer[];

  let snapshotId: string;

  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  let maskToken: MaskToken;
  let paymaster: TokenPaymaster;
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
    paymaster = await new TokenPaymaster__factory(contractCreator).deploy(entryPoint.address, maskToken.address);
    redPacket = await new HappyRedPacket__factory(contractCreator).deploy();

    await paymaster.addStake(0, { value: parseEther("1000") });
    await entryPoint.depositTo(paymaster.address, { value: parseEther("1000") });
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  describe("Successful case with supported operation", () => {
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
        parseUnits("10", "ether"),
        walletOwner.address,
        walletFactory.address,
      );

      await walletFactory.connect(contractCreator).deploy(walletInfo.initCode, constants.HashZero);
      contractWallet = new Contract(walletInfo.address, SimpleWalletArtifact.abi, hardhatProvider) as SimpleWallet;
    });

    it("should succeed to pay gas with $MASK for redpacket creation if every condition is satisfied", async () => {
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

      //#region create RedPacket
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
    });
  });
});

async function approveRedPacketContract(
  nonce: number,
  contractWallet: SimpleWallet,
  paymaster: TokenPaymaster,
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
  paymaster: TokenPaymaster,
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
