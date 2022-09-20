import { use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { Signer, utils, Wallet } from "ethers";
import { ethers } from "hardhat";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWallet.sol/SimpleWallet.json";
import { UserOperation } from "../Objects/userOperation";
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
import { AddressZero, MaxUint256, ONE_ETH, paymasterStake, TWO_ETH, unstakeDelaySec } from "./constants";
import { revertToSnapShot, takeSnapshot } from "./helper";
import { createWallet, getContractWalletInfo, getPaymasterSignHash, signPaymasterHash, signUserOp } from "./utils";

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
  let mask: MaskToken;

  before(async () => {
    signers = await ethers.getSigners();
    contractCreator = signers[0];
    creatorAddress = await contractCreator.getAddress();
    sponsor = signers[1];
    beneficiaryAddress = await sponsor.getAddress();
    faucet = signers[2];

    offChainSigner = createWallet();
    walletOwner = createWallet();

    const sponsorBalance = await sponsor.getBalance();
    if (sponsorBalance < ONE_ETH) throw new Error("Sponsor balance not enough");

    walletFactory = await new SingletonFactory__factory(contractCreator).deploy();
    entryPoint = await new EntryPoint__factory(contractCreator).deploy(
      walletFactory.address,
      paymasterStake,
      unstakeDelaySec,
    );
    entryPointStatic = entryPoint.connect(AddressZero);

    mask = await new MaskToken__factory(contractCreator).deploy();

    mainPaymaster = await new DepositPaymaster__factory(contractCreator).deploy(entryPoint.address, mask.address);

    paymaster = await new VerifyingPaymaster__factory(contractCreator).deploy(
      entryPoint.address,
      offChainSigner.address,
      mask.address,
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

  it("Should call $MASK approve() through paymaster successfully", async () => {
    let simpleWalletCreateSalt = 0;
    const contractWallet = await getContractWalletInfo(
      simpleWalletCreateSalt,
      entryPoint.address,
      walletOwner.address,
      walletFactory.address,
    );

    let approveUserOp = new UserOperation();
    approveUserOp.sender = contractWallet.address;
    approveUserOp.maxFeePerGas = utils.parseUnits("1", "gwei");
    approveUserOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    approveUserOp.paymaster = paymaster.address;
    approveUserOp.initCode = contractWallet.initCode;
    approveUserOp.nonce = 0;

    const approveData = mask.interface.encodeFunctionData("approve", [mainPaymaster.address, MaxUint256]);
    approveUserOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [mask.address, 0, approveData]);

    await approveUserOp.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash = getPaymasterSignHash(approveUserOp);
    approveUserOp.paymasterData = signPaymasterHash(paymasterSignHash, offChainSigner.privateKey);

    const chainId = (await hardhatProvider.getNetwork()).chainId;
    approveUserOp.signature = signUserOp(approveUserOp, entryPoint.address, chainId, walletOwner.privateKey);

    await entryPoint.connect(sponsor).handleOps([approveUserOp], beneficiaryAddress);
    const allowance = await mask.allowance(contractWallet.address, mainPaymaster.address);
    expect(allowance).to.be.eq(MaxUint256);
  });

  it("Should call $TestToken approve through paymaster fail", async () => {
    let simpleWalletCreateSalt = 0;
    const contractWallet = await getContractWalletInfo(
      simpleWalletCreateSalt,
      entryPoint.address,
      walletOwner.address,
      walletFactory.address,
    );

    testToken = await new TestToken__factory(contractCreator).deploy();

    let userOp = new UserOperation();
    userOp.sender = contractWallet.address;
    userOp.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp.paymaster = paymaster.address;
    userOp.initCode = contractWallet.initCode;
    userOp.nonce = 0;

    const approveData = testToken.interface.encodeFunctionData("approve", [mainPaymaster.address, MaxUint256]);
    userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [testToken.address, 0, approveData]);

    await userOp.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash = getPaymasterSignHash(userOp);
    userOp.paymasterData = signPaymasterHash(paymasterSignHash, offChainSigner.privateKey);

    const chainId = (await hardhatProvider.getNetwork()).chainId;
    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

    await expect(entryPointStatic.callStatic.simulateValidation(userOp)).to.be.revertedWith(
      "VerifyingPaymaster: operation not in sponsored operation",
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

    await userOp.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash = getPaymasterSignHash(userOp);
    userOp.paymasterData = signPaymasterHash(paymasterSignHash, offChainSigner.privateKey);

    const chainId = (await hardhatProvider.getNetwork()).chainId;
    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

    //reverted with "VerifyingPaymaster: Unsupported operation"
    await expect(entryPointStatic.callStatic.simulateValidation(userOp)).to.be.revertedWith(
      "VerifyingPaymaster: operation not in sponsored operation",
    );
  });

  it("Should directly transfer ETH through paymaster fail", async () => {
    let simpleWalletCreateSalt = 0;
    const contractWallet = await getContractWalletInfo(
      simpleWalletCreateSalt,
      entryPoint.address,
      walletOwner.address,
      walletFactory.address,
    );

    const recipient = signers[5];
    const recipientAddress = await recipient.getAddress();

    await sponsor.sendTransaction({
      to: contractWallet.address,
      value: TWO_ETH,
    });

    let userOp = new UserOperation();
    userOp.sender = contractWallet.address;
    userOp.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp.paymaster = paymaster.address;
    userOp.initCode = contractWallet.initCode;
    userOp.nonce = 0;

    userOp.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [recipientAddress, ONE_ETH, "0x"]);
    await userOp.estimateGas(hardhatProvider, entryPoint.address);

    const paymasterSignHash = getPaymasterSignHash(userOp);
    userOp.paymasterData = signPaymasterHash(paymasterSignHash, offChainSigner.privateKey);

    const chainId = (await hardhatProvider.getNetwork()).chainId;
    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

    await expect(entryPointStatic.callStatic.simulateValidation(userOp)).to.be.revertedWith(
      "VerifyingPaymaster: operation not in sponsored operation",
    );
  });
});
