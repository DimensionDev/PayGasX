import { use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, Signer, utils, Wallet } from "ethers";
import { ethers, waffle } from "hardhat";
import { UserOperation } from "../Objects/userOperation";
import { EntryPoint, MaskToken, SingletonFactory, TestMainPaymaster, TestToken, VerifyingPaymaster } from "../types";
import { AddressZero, MaxUint256, ONE_ETH, paymasterStake, unstakeDelaySec } from "./constants";
import { revertToSnapShot, takeSnapshot } from "./helper";
import { createWalletOwner, getContractWalletInfo, getPaymasterSignHash, signPaymasterHash, signUserOp } from "./util";
const { expect, assert } = use(chaiAsPromised);
const { deployContract } = waffle;

import EPArtifact from "../artifacts/contracts/EntryPoint.sol/EntryPoint.json";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWallet.sol/SimpleWallet.json";
import SingletonFactoryArtifact from "../artifacts/contracts/Singletonfactory.sol/SingletonFactory.json";
import MaskArtifact from "../artifacts/contracts/test/MaskToken.sol/MaskToken.json";
import MainPaymasterArtifact from "../artifacts/contracts/test/TestMainPaymaster.sol/TestMainPaymaster.json";
import TestTokenArtifact from "../artifacts/contracts/test/TestToken.sol/TestToken.json";
import VFPaymasterArtifact from "../artifacts/contracts/VerifyingPaymaster.sol/VerifyingPaymaster.json";

describe("EntryPoint with Verifying Paymaster", () => {
  let walletOwner: Wallet;
  let contractCreator: Signer;
  let creatorAddress: string;
  let beneficiaryAddress: string;
  let sponsor: Signer;
  let faucet: Signer;
  let signers: Signer[];
  let offChainSigner: Wallet;
  let snapshotId: string;

  let paymaster: VerifyingPaymaster;
  let testToken: TestToken;
  let walletInterface = new utils.Interface(SimpleWalletArtifact.abi);
  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  let mainPaymaster: TestMainPaymaster;
  let walletFactory: SingletonFactory;
  let mask: MaskToken;

  before(async () => {
    signers = await ethers.getSigners();
    contractCreator = signers[0];
    creatorAddress = await contractCreator.getAddress();
    sponsor = signers[1];
    beneficiaryAddress = await sponsor.getAddress();
    faucet = signers[2];

    offChainSigner = createWalletOwner();
    walletOwner = createWalletOwner();

    const sponsorBalance = await sponsor.getBalance();
    if (sponsorBalance < ONE_ETH) throw new Error("Sponsor balance not enough");

    walletFactory = (await deployContract(contractCreator, SingletonFactoryArtifact)) as SingletonFactory;
    entryPoint = (await deployContract(contractCreator, EPArtifact, [
      walletFactory.address,
      paymasterStake,
      unstakeDelaySec,
    ])) as EntryPoint;
    entryPointStatic = entryPoint.connect(AddressZero);

    mainPaymaster = (await deployContract(contractCreator, MainPaymasterArtifact)) as TestMainPaymaster;

    mask = (await deployContract(contractCreator, MaskArtifact)) as MaskToken;

    paymaster = (await deployContract(contractCreator, VFPaymasterArtifact, [
      entryPoint.address,
      offChainSigner.address,
      mask.address,
      mainPaymaster.address,
    ])) as VerifyingPaymaster;

    await paymaster.deposit({ value: ONE_ETH });
    await paymaster.connect(contractCreator).addStake(0, { value: ONE_ETH });
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  it("Should call $MASK approve() & mainPaymaster addDepositFor() through paymaster successfully", async () => {
    //#region approve mask via verifyingPaymaster
    let simpleWalletCreateSalt = 0;
    const contractWallet = await getContractWalletInfo(
      simpleWalletCreateSalt,
      entryPoint.address,
      walletOwner.address,
      walletFactory.address,
    );

    await faucet.sendTransaction({
      to: contractWallet.address,
      value: utils.parseEther("0.5"),
    });

    let userOp1 = new UserOperation();
    userOp1.sender = contractWallet.address;
    userOp1.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp1.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp1.paymaster = paymaster.address;
    userOp1.initCode = contractWallet.initCode;
    userOp1.nonce = 0;

    const approveData = mask.interface.encodeFunctionData("approve", [mainPaymaster.address, MaxUint256]);
    userOp1.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [mask.address, 0, approveData]);

    const hardhatProvider = ethers.provider;
    await userOp1.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash = getPaymasterSignHash(userOp1);
    userOp1.paymasterData = signPaymasterHash(paymasterSignHash, offChainSigner.privateKey);

    const chainId = (await hardhatProvider.getNetwork()).chainId;
    userOp1.signature = signUserOp(userOp1, entryPoint.address, chainId, walletOwner.privateKey);

    try {
      const result = await entryPointStatic.callStatic.simulateValidation(userOp1);

      if (result) {
        await entryPoint.connect(sponsor).handleOps([userOp1], beneficiaryAddress);
        const allowance = await mask.allowance(contractWallet.address, mainPaymaster.address);
        expect(allowance).to.be.eq(MaxUint256);
      }
    } catch (error) {
      console.error(error);
      throw new Error("simulateValidation error");
    }
    //#endregion

    //#region call addDepositFor() through VerifyingPaymaster
    let userOp2 = new UserOperation();
    userOp2.sender = contractWallet.address;
    userOp2.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp2.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp2.paymaster = paymaster.address;
    userOp2.nonce = 0;

    await mask.connect(contractCreator).transfer(contractWallet.address, 1000);

    const addDepositForData = mainPaymaster.interface.encodeFunctionData("addDepositFor", [
      mask.address,
      contractWallet.address,
      1000,
    ]);
    userOp2.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
      mainPaymaster.address,
      0,
      addDepositForData,
    ]);

    await userOp2.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash2 = getPaymasterSignHash(userOp2);
    userOp2.paymasterData = signPaymasterHash(paymasterSignHash2, offChainSigner.privateKey);
    userOp2.signature = signUserOp(userOp2, entryPoint.address, chainId, walletOwner.privateKey);

    try {
      const result = await entryPointStatic.callStatic.simulateValidation(userOp2);

      if (result) {
        await entryPoint.connect(sponsor).handleOps([userOp2], beneficiaryAddress);
        const mainPaymasterBalance = await mask.balanceOf(mainPaymaster.address);
        expect(mainPaymasterBalance).to.be.eq(BigNumber.from(1000));
      }
    } catch (error) {
      console.error(error);
      throw new Error("simulateValidation error");
    }
    //#endregion
  });

  it("Should call $TestToken approve through paymaster fail", async () => {
    let simpleWalletCreateSalt = 0;
    const contractWallet = await getContractWalletInfo(
      simpleWalletCreateSalt,
      entryPoint.address,
      walletOwner.address,
      walletFactory.address,
    );

    await faucet.sendTransaction({
      to: contractWallet.address,
      value: utils.parseEther("0.5"),
    });

    testToken = (await deployContract(contractCreator, TestTokenArtifact)) as TestToken;

    let userOp = new UserOperation();
    userOp.sender = contractWallet.address;
    userOp.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp.paymaster = paymaster.address;
    userOp.initCode = contractWallet.initCode;
    userOp.nonce = 0;

    const approveData = testToken.interface.encodeFunctionData("approve", [mainPaymaster.address, MaxUint256]);
    userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [testToken.address, 0, approveData]);

    const hardhatProvider = ethers.provider;
    await userOp.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash = getPaymasterSignHash(userOp);
    userOp.paymasterData = signPaymasterHash(paymasterSignHash, offChainSigner.privateKey);

    const chainId = (await hardhatProvider.getNetwork()).chainId;
    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

    //reverted with "VerifyingPaymaster: Unsupported operation"
    await expect(entryPointStatic.callStatic.simulateValidation(userOp)).to.be.revertedWith(
      "VerifyingPaymaster: Unsupported operation",
    );
  });

  it("Should call $MASK transfer through paymaster fail", async () => {
    let simpleWalletCreateSalt = 0;
    const contractWallet = await getContractWalletInfo(
      simpleWalletCreateSalt,
      entryPoint.address,
      walletOwner.address,
      walletFactory.address,
    );

    await faucet.sendTransaction({
      to: contractWallet.address,
      value: utils.parseEther("0.5"),
    });

    await mask.connect(contractCreator).transfer(contractWallet.address, 100);

    let userOp = new UserOperation();
    userOp.sender = contractWallet.address;
    userOp.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp.paymaster = paymaster.address;
    userOp.initCode = contractWallet.initCode;
    userOp.nonce = 0;

    const transferData = mask.interface.encodeFunctionData("transfer", [mainPaymaster.address, 50]);
    userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [mask.address, 0, transferData]);

    const hardhatProvider = ethers.provider;
    await userOp.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash = getPaymasterSignHash(userOp);
    userOp.paymasterData = signPaymasterHash(paymasterSignHash, offChainSigner.privateKey);

    const chainId = (await hardhatProvider.getNetwork()).chainId;
    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

    //reverted with "VerifyingPaymaster: Unsupported operation"
    await expect(entryPointStatic.callStatic.simulateValidation(userOp)).to.be.revertedWith(
      "VerifyingPaymaster: Unsupported operation",
    );
  });

  it("Should call mainPaymaster addDeposit through paymaster fail", async () => {
    let simpleWalletCreateSalt = 0;
    const contractWallet = await getContractWalletInfo(
      simpleWalletCreateSalt,
      entryPoint.address,
      walletOwner.address,
      walletFactory.address,
    );

    await faucet.sendTransaction({
      to: contractWallet.address,
      value: utils.parseEther("0.5"),
    });

    let userOp = new UserOperation();
    userOp.sender = contractWallet.address;
    userOp.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp.paymaster = paymaster.address;
    userOp.initCode = contractWallet.initCode;
    userOp.nonce = 0;

    const lockDeposit = await mainPaymaster.populateTransaction.lockTokenDeposit();
    userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
      mainPaymaster.address,
      0,
      lockDeposit.data!,
    ]);

    const hardhatProvider = ethers.provider;
    await userOp.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash = getPaymasterSignHash(userOp);
    userOp.paymasterData = signPaymasterHash(paymasterSignHash, offChainSigner.privateKey);

    const chainId = (await hardhatProvider.getNetwork()).chainId;
    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

    //reverted with "VerifyingPaymaster: Unsupported operation"
    await expect(entryPointStatic.callStatic.simulateValidation(userOp)).to.be.revertedWith(
      "VerifyingPaymaster: Unsupported operation",
    );
  });
});
