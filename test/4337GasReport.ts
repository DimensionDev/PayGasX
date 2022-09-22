import { Signer, utils } from "ethers";
import { hexZeroPad, parseEther } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { UserOperation } from "../Objects/userOperation";
import {
  DepositPaymaster,
  DepositPaymaster__factory,
  EntryPoint,
  EntryPoint__factory,
  MaskToken,
  MaskToken__factory,
  SimpleWalletUpgradeable,
  SingletonFactory,
  SingletonFactory__factory,
  TESTNFT__factory,
} from "../types";
import { FIVE_ETH, ONE_ETH, paymasterStake, TWO_ETH, unstakeDelaySec } from "./constants";
import { createWallet, deployWallet, signUserOp } from "./utils";

describe("#gasReport", () => {
  let entryPoint: EntryPoint;
  let signers: Signer[];
  let sponsor: Signer;
  let contractCreator: Signer;
  let singletonFactory: SingletonFactory;

  const walletOwner = createWallet();
  let beneficiary = createWallet().address;
  let maskToken: MaskToken;
  let paymaster: DepositPaymaster;
  let wallet: SimpleWalletUpgradeable;
  let chainId = network.config.chainId!;

  before(async function () {
    signers = await ethers.getSigners();
    contractCreator = signers[0];
    sponsor = signers[1];

    singletonFactory = await new SingletonFactory__factory(contractCreator).deploy();

    entryPoint = await new EntryPoint__factory(contractCreator).deploy(
      singletonFactory.address,
      paymasterStake,
      unstakeDelaySec,
    );
    maskToken = await new MaskToken__factory(contractCreator).deploy();

    paymaster = await new DepositPaymaster__factory(contractCreator).deploy(entryPoint.address, maskToken.address);
    await paymaster.addStake(0, { value: parseEther("2") });
    await entryPoint.depositTo(paymaster.address, { value: parseEther("1") });
    await maskToken.approve(paymaster.address, ethers.constants.MaxUint256);

    wallet = await deployWallet(entryPoint.address, walletOwner.address);

    await paymaster.addDepositFor(wallet.address, FIVE_ETH);

    await maskToken.transfer(wallet.address, TWO_ETH);
    await paymaster.setMaskToEthRadio(2000);

    await contractCreator.sendTransaction({
      to: wallet.address,
      value: FIVE_ETH,
    });

    const tokenApprovePaymaster = await maskToken.populateTransaction
      .approve(paymaster.address, ethers.constants.MaxUint256)
      .then((tx) => tx.data!);
    const execApprove = await wallet.populateTransaction
      .execFromEntryPoint(maskToken.address, 0, tokenApprovePaymaster)
      .then((tx) => tx.data!);

    let userOp1 = new UserOperation();
    userOp1.sender = wallet.address;
    userOp1.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp1.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp1.paymaster = paymaster.address;
    userOp1.nonce = 0;
    userOp1.callData = execApprove;

    await userOp1.estimateGas(ethers.provider, entryPoint.address);

    userOp1.paymasterData = hexZeroPad(maskToken.address, 32);

    userOp1.signature = signUserOp(userOp1, entryPoint.address, chainId, walletOwner.privateKey);

    await entryPoint.handleOps([userOp1], beneficiary);
  });

  it("should export 4337 transfer ether gas(call directly by wallet owner)", async () => {
    await contractCreator.sendTransaction({
      to: walletOwner.address,
      value: ONE_ETH,
    });
    await wallet.connect(walletOwner).transfer(createWallet().address, ONE_ETH);
  });

  it("should export 4337 transfer ether gas(call by entry point)", async () => {
    const calldata = "0x";
    const exec = await wallet.populateTransaction
      .execFromEntryPoint(createWallet().address, ONE_ETH, calldata)
      .then((tx) => tx.data!);

    let userOp = new UserOperation();
    userOp.sender = wallet.address;
    userOp.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp.paymaster = paymaster.address;
    userOp.nonce = await wallet.nonce();
    userOp.callData = exec;

    await userOp.estimateGas(ethers.provider, entryPoint.address);

    userOp.paymasterData = hexZeroPad(maskToken.address, 32);

    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

    await entryPoint.handleOps([userOp], beneficiary);
  });

  it("should export 4337 erc20 transfer gas", async () => {
    const calldata = await maskToken.populateTransaction.transfer(createWallet().address, 1).then((tx) => tx.data!);
    const exec = await wallet.populateTransaction
      .execFromEntryPoint(maskToken.address, 0, calldata)
      .then((tx) => tx.data!);
    let userOp = new UserOperation();
    userOp.sender = wallet.address;
    userOp.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp.paymaster = paymaster.address;
    userOp.nonce = await wallet.nonce();
    userOp.callData = exec;

    await userOp.estimateGas(ethers.provider, entryPoint.address);

    userOp.paymasterData = hexZeroPad(maskToken.address, 32);

    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

    await entryPoint.handleOps([userOp], beneficiary);
  });

  it("should export 4337 mint an NFT gas", async () => {
    const testNft = await new TESTNFT__factory(contractCreator).deploy();

    const calldata = await testNft.populateTransaction.mint(createWallet().address).then((tx) => tx.data!);
    const exec = await wallet.populateTransaction
      .execFromEntryPoint(testNft.address, 0, calldata)
      .then((tx) => tx.data!);

    let userOp = new UserOperation();
    userOp.sender = wallet.address;
    userOp.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp.paymaster = paymaster.address;
    userOp.nonce = await wallet.nonce();
    userOp.callData = exec;

    await userOp.estimateGas(ethers.provider, entryPoint.address);

    userOp.paymasterData = hexZeroPad(maskToken.address, 32);

    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, walletOwner.privateKey);

    await entryPoint.handleOps([userOp], beneficiary);
  });

  it("should export 4337 claim an red packet gas", async () => {});
});
