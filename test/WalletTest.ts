import { use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, constants, Contract, Signer, utils } from "ethers";
import { ethers, network, waffle } from "hardhat";
import EntryPointArtifact from "../artifacts/contracts/EntryPoint.sol/EntryPoint.json";
import WalletProxyArtifact from "../artifacts/contracts/proxy/WalletProxy.sol/WalletProxy.json";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWalletUpgradeable.sol/SimpleWalletUpgradeable.json";
import { DepositPaymaster__factory, EntryPoint, MaskToken__factory } from "../types";
import { UserOperation } from "./entity/userOperation";
import { fillAndSign } from "./UserOp";
import { AddressZero } from "./utils/const";
import { signUserOp } from "./utils/UserOp";
const { expect } = use(chaiAsPromised);
const { deployContract } = waffle;
const singletonFactoryAddress = "0xce0042B868300000d44A59004Da54A005ffdcf9f";

describe("Wallet testing", () => {
  // for hardhat local testing environment
  const mnemonic = "test test test test test test test test test test test junk";
  let userSigner: Signer;
  let userAddress: string;
  let userPrivateKey: string;
  let beneficialAccount: Signer;
  let beneficialAccountAddress: string;

  let entryPoint: EntryPoint;
  let walletProxy: Contract;
  let walletLogic: Contract;
  let singletonFactory;
  let walletProxyAddress: string;
  let walletProxyInitCode: utils.BytesLike;

  let saltValue: string;
  let chainId: number;

  before(async () => {
    userPrivateKey = ethers.Wallet.fromMnemonic(mnemonic).privateKey;
    [userSigner, beneficialAccount] = await ethers.getSigners();
    userAddress = await userSigner.getAddress();
    beneficialAccountAddress = await beneficialAccount.getAddress();
    chainId = network.config.chainId!;

    const SimpleWalletFactory = await ethers.getContractFactory("SimpleWalletUpgradeable");
    let simpleWallet = await SimpleWalletFactory.deploy();
    const SingletonFactory = await ethers.getContractFactory("SingletonFactory");
    singletonFactory = await SingletonFactory.deploy();
    entryPoint = await deployContract(userSigner, EntryPointArtifact, [singletonFactory.address, 10, 10], {});

    const WalletProxyFactory = await ethers.getContractFactory("WalletProxy");
    const simpleWalletInterface = new utils.Interface(SimpleWalletArtifact.abi);
    const data = simpleWalletInterface.encodeFunctionData("initialize", [entryPoint.address]);
    // WalletProxy constructor
    walletProxyInitCode = WalletProxyFactory.getDeployTransaction(userAddress, simpleWallet.address, data).data!;
    saltValue = utils.hexZeroPad(userAddress, 32);
    let walletAddress = utils.getCreate2Address(
      singletonFactory.address,
      saltValue,
      utils.keccak256(walletProxyInitCode),
    );
    console.log("predict wallet addr: ", walletAddress);
    walletProxyAddress = walletAddress;
    walletLogic = new ethers.Contract(walletProxyAddress, SimpleWalletArtifact.abi, userSigner); // wallet doesn't exist yet
    expect((await ethers.provider.getCode(walletProxyAddress)) == "0x").to.be.true;
  });

  it("test simulation", async () => {
    let userOperation: UserOperation = new UserOperation();
    userOperation.sender = walletProxyAddress;
    // TODO: calculate actual fee
    let gasFee = {
      Max: BigNumber.from(2e9),
      MaxPriority: BigNumber.from(1e9),
    };
    userOperation.maxFeePerGas = gasFee.Max;
    userOperation.maxPriorityFeePerGas = gasFee.MaxPriority;
    userOperation.paymaster = constants.AddressZero;
    await userOperation.estimateGas(ethers.provider, entryPoint.address);

    // deploy wallet, check if wallet address match
    await singletonFactory.deploy(walletProxyInitCode, saltValue);
    let eventFilter = singletonFactory.filters.Deployed();
    let events = await singletonFactory.queryFilter(eventFilter);
    // console.log("singletonFactory: ", singletonFactory.address, events[0].args);
    expect((await ethers.provider.getCode(walletProxyAddress)) == "0x").to.be.false;
    expect(events[0].args[0]).to.eql(walletProxyAddress);
    expect(await walletLogic.entryPoint()).to.eql(entryPoint.address);

    if ((await ethers.provider.getCode(walletProxyAddress)) === "0x") {
      // should not reach here
      userOperation.initCode = walletProxyInitCode;
      userOperation.nonce = 0;
    } else {
      await walletLogic.addDeposit({ value: utils.parseUnits("1", "ether") });
      expect(await walletLogic.getDeposit()).to.eql(utils.parseUnits("1", "ether"));
      userOperation.nonce = parseInt(await walletLogic.nonce(), 10);
    }
    //transfer ether from simpleWallet for test
    let walletInterface = new utils.Interface(SimpleWalletArtifact.abi);
    userOperation.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
      userAddress,
      utils.parseUnits("0.00001", "ether"),
      "0x",
    ]);
    userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
    const result = await entryPoint.connect(AddressZero).callStatic.simulateValidation(userOperation);
    console.log(`simulateValidation result:`, result);
    console.log(userOperation);
    await entryPoint.handleOps([userOperation], beneficialAccountAddress);
  });

  it("test upgradeability", async () => {
    const SimpleWalletFactory = await ethers.getContractFactory("SimpleWalletUpgradeable");
    let simpleWallet = await SimpleWalletFactory.deploy();
    walletProxy = new ethers.Contract(walletProxyAddress, WalletProxyArtifact.abi, userSigner);
    await expect(walletProxy.connect(beneficialAccount).upgradeToAndCall(simpleWallet.address, "0x", false)).to.be
      .rejected;
    await walletProxy.upgradeToAndCall(simpleWallet.address, "0x", false);
  });

  it("test paymaster", async () => {
    let maskToken = await new MaskToken__factory(userSigner).deploy();
    let paymaster = await new DepositPaymaster__factory(userSigner).deploy(entryPoint.address, maskToken.address);
    await paymaster.addStake(0, { value: utils.parseEther("2") });
    await maskToken.approve(paymaster.address, ethers.constants.MaxUint256);
    await paymaster.addDepositFor(walletProxyAddress, utils.parseEther("2"));
    await entryPoint.depositTo(paymaster.address, { value: utils.parseEther("1") });
    const paymasterLockTokenDeposit = await paymaster.populateTransaction.lockTokenDeposit().then((tx) => tx.data!);
    await walletLogic.exec(paymaster.address, 0, paymasterLockTokenDeposit);
    let walletInterface = new utils.Interface(SimpleWalletArtifact.abi);
    let callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
      maskToken.address,
      0,
      (await maskToken.populateTransaction.approve(paymaster.address, ethers.constants.MaxUint256)).data,
    ]);
    const userOp = await fillAndSign(
      {
        sender: walletProxyAddress,
        paymaster: paymaster.address,
        paymasterData: utils.hexZeroPad(maskToken.address, 32),
        callData: callData,
      },
      userSigner,
      entryPoint,
    );
    console.log(userOp);
    await entryPoint.connect(AddressZero).callStatic.simulateValidation(userOp);
    await entryPoint.handleOps([userOp], beneficialAccountAddress);
    console.log("pass all");
  });
});
