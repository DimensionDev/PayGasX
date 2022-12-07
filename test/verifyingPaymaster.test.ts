import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { Signer, utils, Wallet } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWallet.sol/SimpleWallet.json";
import {
  DepositPaymaster,
  DepositPaymaster__factory,
  EntryPoint,
  EntryPoint__factory,
  MaskToken,
  MaskToken__factory,
  SingletonFactory,
  SingletonFactory__factory,
  TestToken,
  TestToken__factory,
  VerifyingPaymaster,
  VerifyingPaymaster__factory,
} from "../types";
import { AddressZero, MaxUint256, ONE_ETH, paymasterStake, unstakeDelaySec } from "./constants";
import { revertToSnapShot, takeSnapshot } from "./helper";
import {
  createDefaultUserOp,
  createWallet,
  getContractWalletInfo,
  getPaymasterSignHash,
  signPaymasterHash,
  signUserOp,
} from "./utils";

const { expect } = use(chaiAsPromised);
const walletInterface = new utils.Interface(SimpleWalletArtifact.abi);
const hardhatProvider = ethers.provider;

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
  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  let mainPaymaster: DepositPaymaster;
  let walletFactory: SingletonFactory;
  let maskToken: MaskToken;
  let chainId: number;

  before(async () => {
    chainId = (await hardhatProvider.getNetwork()).chainId;
    signers = await ethers.getSigners();
    contractCreator = signers[0];
    creatorAddress = await contractCreator.getAddress();
    sponsor = signers[1];
    beneficiaryAddress = await sponsor.getAddress();
    faucet = signers[2];

    offChainSigner = createWallet();
    walletOwner = createWallet();

    walletFactory = await new SingletonFactory__factory(contractCreator).deploy();
    entryPoint = await new EntryPoint__factory(contractCreator).deploy(
      walletFactory.address,
      paymasterStake,
      unstakeDelaySec,
    );
    entryPointStatic = entryPoint.connect(AddressZero);

    maskToken = await new MaskToken__factory(contractCreator).deploy();

    mainPaymaster = await new DepositPaymaster__factory(contractCreator).deploy(entryPoint.address, maskToken.address);

    paymaster = await new VerifyingPaymaster__factory(contractCreator).deploy(
      entryPoint.address,
      offChainSigner.address,
      maskToken.address,
      mainPaymaster.address,
    );

    await paymaster.deposit({ value: ONE_ETH });
    await paymaster.connect(contractCreator).addStake(0, { value: ONE_ETH });
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  // approve $MASK to mainPaymaster (i.e. target contract)
  it("Should call $MASK approve() through paymaster successfully", async () => {
    let simpleWalletCreateSalt = 0;
    const contractWallet = await getContractWalletInfo(
      simpleWalletCreateSalt,
      entryPoint.address,
      maskToken.address,
      paymaster.address,
      parseUnits("1", "ether"),
      walletOwner.address,
      walletFactory.address,
    );

    let approveUserOp = createDefaultUserOp(contractWallet.address);
    approveUserOp.paymaster = paymaster.address;
    approveUserOp.initCode = contractWallet.initCode;
    approveUserOp.nonce = 0;

    const approveData = maskToken.interface.encodeFunctionData("approve", [mainPaymaster.address, MaxUint256]);
    approveUserOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
      maskToken.address,
      0,
      approveData,
    ]);

    await approveUserOp.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash = getPaymasterSignHash(approveUserOp);
    approveUserOp.paymasterData = signPaymasterHash(paymasterSignHash, offChainSigner.privateKey);

    approveUserOp.signature = signUserOp(approveUserOp, entryPoint.address, chainId, walletOwner.privateKey);

    await entryPoint.connect(sponsor).handleOps([approveUserOp], beneficiaryAddress);

    const allowance = await maskToken.allowance(contractWallet.address, mainPaymaster.address);
    expect(allowance).to.be.eq(MaxUint256);
  });

  it("Should call $TestToken approve through paymaster fail", async () => {
    let simpleWalletCreateSalt = 0;
    const contractWallet = await getContractWalletInfo(
      simpleWalletCreateSalt,
      entryPoint.address,
      maskToken.address,
      paymaster.address,
      parseUnits("1", "ether"),
      walletOwner.address,
      walletFactory.address,
    );

    testToken = await new TestToken__factory(contractCreator).deploy();

    let userOp = createDefaultUserOp(contractWallet.address);
    userOp.paymaster = paymaster.address;
    userOp.initCode = contractWallet.initCode;
    userOp.nonce = 0;

    const approveData = testToken.interface.encodeFunctionData("approve", [mainPaymaster.address, MaxUint256]);
    userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [testToken.address, 0, approveData]);

    await userOp.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash = getPaymasterSignHash(userOp);
    userOp.paymasterData = signPaymasterHash(paymasterSignHash, offChainSigner.privateKey);

    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

    await expect(entryPointStatic.callStatic.simulateValidation(userOp))
      .to.be.revertedWithCustomError(entryPoint, "FailedOp")
      .withArgs(anyValue, anyValue, "VerifyingPaymaster: operation not in sponsored operation");
  });

  it("Should directly transfer $ETH through paymaster fail", async () => {
    let simpleWalletCreateSalt = 0;
    const contractWallet = await getContractWalletInfo(
      simpleWalletCreateSalt,
      entryPoint.address,
      maskToken.address,
      paymaster.address,
      parseUnits("1", "ether"),
      walletOwner.address,
      walletFactory.address,
    );

    const recipient = signers[5];
    const recipientAddress = await recipient.getAddress();

    await sponsor.sendTransaction({
      to: contractWallet.address,
      value: ONE_ETH,
    });

    let userOp = createDefaultUserOp(contractWallet.address);
    userOp.paymaster = paymaster.address;
    userOp.initCode = contractWallet.initCode;
    userOp.nonce = 0;

    userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [recipientAddress, ONE_ETH, "0x"]);
    await userOp.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash = getPaymasterSignHash(userOp);
    userOp.paymasterData = signPaymasterHash(paymasterSignHash, offChainSigner.privateKey);

    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);
    await expect(entryPointStatic.callStatic.simulateValidation(userOp))
      .to.be.revertedWithCustomError(entryPoint, "FailedOp")
      .withArgs(anyValue, anyValue, "VerifyingPaymaster: operation not in sponsored operation");
  });
});
