import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import {
  DepositPaymaster,
  DepositPaymaster__factory,
  EntryPoint,
  EntryPoint__factory,
  MaskToken,
  MaskToken__factory,
  SimpleWalletUpgradeable,
  SimpleWalletUpgradeable__factory,
  SingletonFactory,
  SingletonFactory__factory,
} from "../types";
import { AddressZero, MaxUint256, ONE_ETH, paymasterStake, unstakeDelaySec } from "./constants";
import { revertToSnapShot, takeSnapshot } from "./helper";
import { createDefaultUserOp, createWallet, getProxyWalletInfo, signUserOp } from "./utils";

describe("Create2 address test", () => {
  let contractDeployer: Signer;
  let persona: Wallet;
  let sponsor: Signer;
  let beneficiaryAddress: string;

  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  let walletImp: SimpleWalletUpgradeable;
  let singletonFactory: SingletonFactory;
  let paymaster: DepositPaymaster;
  let maskToken: MaskToken;

  let chainId: number;
  let snapshotId: string;
  before(async () => {
    chainId = network.config.chainId!;
    persona = createWallet();
    [contractDeployer, sponsor] = await ethers.getSigners();
    beneficiaryAddress = await sponsor.getAddress();

    walletImp = await new SimpleWalletUpgradeable__factory(contractDeployer).deploy();
    singletonFactory = await new SingletonFactory__factory(contractDeployer).deploy();
    entryPoint = await new EntryPoint__factory(contractDeployer).deploy(
      singletonFactory.address,
      paymasterStake,
      unstakeDelaySec,
    );
    entryPointStatic = entryPoint.connect(AddressZero);
    maskToken = await new MaskToken__factory(contractDeployer).deploy();
    paymaster = await new DepositPaymaster__factory(contractDeployer).deploy(entryPoint.address, maskToken.address);
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  it("Should create wallets via EntryPoint to right address twice with the same persona successfully", async () => {
    //#region create 1st time
    let salt = 0;
    let nonce = 0;
    const initializeData = walletImp.interface.encodeFunctionData("initialize", [
      entryPoint.address,
      persona.address,
      maskToken.address,
      paymaster.address,
      MaxUint256,
      AddressZero,
    ]);
    const proxyWalletInfo = await getProxyWalletInfo(
      salt,
      walletImp.address,
      initializeData,
      persona.address,
      singletonFactory.address,
    );
    expect(await ethers.provider.getCode(proxyWalletInfo.address)).to.be.eq("0x");

    //help deposit in EntryPoint for contract wallet
    await entryPoint.connect(sponsor).depositTo(proxyWalletInfo.address, { value: ONE_ETH });

    let userOp1 = createDefaultUserOp(proxyWalletInfo.address);
    userOp1.paymaster = AddressZero;
    userOp1.initCode = proxyWalletInfo.initCode;
    userOp1.nonce = nonce;
    await userOp1.estimateGas(ethers.provider, entryPoint.address);
    userOp1.signature = signUserOp(userOp1, entryPoint.address, chainId, persona.privateKey);
    try {
      const result = await entryPointStatic.callStatic.simulateValidation(userOp1);
      if (result) {
        await entryPoint.connect(sponsor).handleOps([userOp1], beneficiaryAddress);
        expect(await ethers.provider.getCode(proxyWalletInfo.address)).not.to.be.eq("0x");
      }
    } catch (error) {
      console.error(error);
      throw new Error("Simulation error");
    }
    //#endregion

    //#region create 2nd time
    salt = 1;
    nonce = 1;
    const proxyWallet2Info = await getProxyWalletInfo(
      salt,
      walletImp.address,
      initializeData,
      persona.address,
      singletonFactory.address,
    );
    expect(await ethers.provider.getCode(proxyWallet2Info.address)).to.be.eq("0x");
    //help deposit in EntryPoint for contract wallet
    await entryPoint.connect(sponsor).depositTo(proxyWallet2Info.address, { value: ONE_ETH });

    let userOp2 = createDefaultUserOp(proxyWallet2Info.address);
    userOp2.paymaster = AddressZero;
    userOp2.initCode = proxyWallet2Info.initCode;
    userOp2.nonce = nonce;
    await userOp2.estimateGas(ethers.provider, entryPoint.address);
    userOp2.signature = signUserOp(userOp2, entryPoint.address, chainId, persona.privateKey);
    try {
      const result = await entryPointStatic.callStatic.simulateValidation(userOp2);
      if (result) {
        await entryPoint.connect(sponsor).handleOps([userOp2], beneficiaryAddress);
        expect(await ethers.provider.getCode(proxyWallet2Info.address)).not.to.be.eq("0x");
      }
    } catch (error) {
      console.error(error);
      throw new Error("Simulation error");
    }
  });

  it("Should create wallet fail if the userOp.sender do not match (caused by mismatched nonce & salt)", async () => {
    let salt = 1;
    let nonce = 0;
    //#region server calculates wallet address with the given salt (wrong one)
    const initializeData = walletImp.interface.encodeFunctionData("initialize", [
      entryPoint.address,
      persona.address,
      maskToken.address,
      paymaster.address,
      MaxUint256,
      AddressZero,
    ]);
    const proxyWalletInfo = await getProxyWalletInfo(
      salt,
      walletImp.address,
      initializeData,
      persona.address,
      singletonFactory.address,
    );
    expect(await ethers.provider.getCode(proxyWalletInfo.address)).to.be.eq("0x");
    //#endregion

    //help deposit in EntryPoint for contract wallet
    await entryPoint.connect(sponsor).depositTo(proxyWalletInfo.address, { value: ONE_ETH });

    //#region deploy contract with the mismatched nonce
    let userOp = createDefaultUserOp(proxyWalletInfo.address);
    userOp.paymaster = AddressZero;
    userOp.initCode = proxyWalletInfo.initCode;
    userOp.nonce = nonce;
    await userOp.estimateGas(ethers.provider, entryPoint.address);
    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, persona.privateKey);

    await expect(entryPoint.connect(sponsor).handleOps([userOp], beneficiaryAddress)).to.be.revertedWith(
      "sender doesn't match create2 address",
    );
    //#endregion
  });

  it("Should create wallet fail if deploy to address where contract already deployed", async () => {
    //#region create 1st time
    let salt = 0;
    let nonce = 0;
    const initializeData = walletImp.interface.encodeFunctionData("initialize", [
      entryPoint.address,
      persona.address,
      maskToken.address,
      paymaster.address,
      MaxUint256,
      AddressZero,
    ]);
    const proxyWalletInfo = await getProxyWalletInfo(
      salt,
      walletImp.address,
      initializeData,
      persona.address,
      singletonFactory.address,
    );
    expect(await ethers.provider.getCode(proxyWalletInfo.address)).to.be.eq("0x");

    //help deposit in EntryPoint for contract wallet
    await entryPoint.connect(sponsor).depositTo(proxyWalletInfo.address, { value: ONE_ETH });

    let userOp1 = createDefaultUserOp(proxyWalletInfo.address);
    userOp1.paymaster = AddressZero;
    userOp1.initCode = proxyWalletInfo.initCode;
    userOp1.nonce = nonce;
    await userOp1.estimateGas(ethers.provider, entryPoint.address);
    userOp1.signature = signUserOp(userOp1, entryPoint.address, chainId, persona.privateKey);
    try {
      const result = await entryPointStatic.callStatic.simulateValidation(userOp1);
      if (result) {
        await entryPoint.connect(sponsor).handleOps([userOp1], beneficiaryAddress);
        expect(await ethers.provider.getCode(proxyWalletInfo.address)).not.to.be.eq("0x");
      }
    } catch (error) {
      console.error(error);
      throw new Error("Simulation error");
    }
    //#endregion

    //#region create 2nd time to the same address
    let userOp2 = createDefaultUserOp(proxyWalletInfo.address);
    userOp2.paymaster = AddressZero;
    userOp2.initCode = proxyWalletInfo.initCode;
    userOp2.nonce = nonce;
    await userOp2.estimateGas(ethers.provider, entryPoint.address);
    userOp2.signature = signUserOp(userOp2, entryPoint.address, chainId, persona.privateKey);
    await expect(entryPointStatic.callStatic.simulateValidation(userOp2)).to.be.reverted;
  });
});
