import { use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, constants, Signer, utils } from "ethers";
import { ethers, network } from "hardhat";
import {
  DepositPaymaster__factory,
  EntryPoint,
  EntryPoint__factory,
  MaskToken__factory,
  SimpleWalletUpgradeable,
  SimpleWalletUpgradeable__factory,
  SingletonFactory,
  SingletonFactory__factory,
  VerifyingPaymaster__factory,
  WalletProxy,
  WalletProxy__factory,
} from "../types";
import { UserOperation } from "./entity/userOperation";
import { fillAndSign } from "./UserOp";
import { AddressZero } from "./utils/const";
import { getPayMasterSignHash, signPayMasterHash, signUserOp } from "./utils/UserOp";
const { expect } = use(chaiAsPromised);
const singletonFactoryAddress = "0xce0042B868300000d44A59004Da54A005ffdcf9f";

describe("Wallet testing", () => {
  // for hardhat local testing environment
  const mnemonic = "test test test test test test test test test test test junk";
  let deployer: Signer;
  let sponsorSigner: Signer;
  let userSigner: Signer;
  let userAddress: string;
  let userPrivateKey: string;
  let beneficialAccount: Signer;
  let beneficialAccountAddress: string;

  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  let walletProxy: WalletProxy;
  let walletLogic: SimpleWalletUpgradeable;
  let singletonFactory: SingletonFactory;
  let walletProxyAddress: string;
  let walletProxyInitCode: utils.BytesLike;

  let saltValue: string;
  let chainId: number;

  before(async () => {
    userPrivateKey = ethers.Wallet.fromMnemonic(mnemonic).privateKey;
    [userSigner, beneficialAccount, deployer, sponsorSigner] = await ethers.getSigners();
    userAddress = await userSigner.getAddress();
    beneficialAccountAddress = await beneficialAccount.getAddress();
    chainId = network.config.chainId!;

    let simpleWallet = await new SimpleWalletUpgradeable__factory(deployer).deploy();
    singletonFactory = await new SingletonFactory__factory(deployer).deploy();
    entryPoint = await new EntryPoint__factory(deployer).deploy(singletonFactory.address, 10, 10);
    entryPointStatic = entryPoint.connect(AddressZero);

    const WalletProxyFactory = await ethers.getContractFactory("WalletProxy");
    const simpleWalletInterface = new utils.Interface(SimpleWalletUpgradeable__factory.abi);
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
    walletProxy = new ethers.Contract(walletProxyAddress, WalletProxy__factory.abi, userSigner) as WalletProxy;
    walletLogic = new ethers.Contract(
      walletProxyAddress,
      SimpleWalletUpgradeable__factory.abi,
      userSigner,
    ) as SimpleWalletUpgradeable; // wallet doesn't exist yet
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
      userOperation.nonce = await walletLogic.nonce();
    }
    //transfer ether from simpleWallet for test
    userOperation.callData = walletLogic.interface.encodeFunctionData("execFromEntryPoint", [
      userAddress,
      utils.parseUnits("0.00001", "ether"),
      "0x",
    ]);
    userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
    const result = await entryPointStatic.callStatic.simulateValidation(userOperation);
    console.log(`simulateValidation result:`, result);
    await entryPoint.handleOps([userOperation], beneficialAccountAddress);
  });

  it("test upgradeability", async () => {
    const SimpleWalletFactory = await ethers.getContractFactory("SimpleWalletUpgradeable");
    let simpleWallet = await SimpleWalletFactory.deploy();
    await expect(walletProxy.connect(beneficialAccount).upgradeToAndCall(simpleWallet.address, "0x", false)).to.be
      .rejected;
    await walletProxy.upgradeToAndCall(simpleWallet.address, "0x", false);
  });

  it("test paymaster", async () => {
    let maskToken = await new MaskToken__factory(userSigner).deploy();

    let depositPaymaster = await new DepositPaymaster__factory(userSigner).deploy(
      entryPoint.address,
      maskToken.address,
    );
    await depositPaymaster.addStake(0, { value: utils.parseEther("2") });

    let verifyingPaymaster = await new VerifyingPaymaster__factory(userSigner).deploy(
      entryPoint.address,
      userAddress, // signer, TODO: use different signer
      maskToken.address,
      depositPaymaster.address,
    );
    await verifyingPaymaster.deposit({ value: utils.parseEther("1") });
    await verifyingPaymaster.addStake(0, { value: utils.parseEther("1") });

    let userOp = new UserOperation();
    userOp.sender = walletProxyAddress;
    userOp.maxFeePerGas = utils.parseUnits("1", "gwei");
    userOp.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
    userOp.paymaster = verifyingPaymaster.address;
    userOp.initCode = "0x";
    userOp.nonce = await walletLogic.nonce();

    const approveData = maskToken.interface.encodeFunctionData("approve", [
      depositPaymaster.address,
      constants.MaxUint256,
    ]);
    userOp.callData = walletLogic.interface.encodeFunctionData("execFromEntryPoint", [
      maskToken.address,
      0,
      approveData,
    ]);

    await userOp.estimateGas(ethers.provider, entryPoint.address);

    const paymasterSignHash = getPayMasterSignHash(userOp);
    userOp.paymasterData = signPayMasterHash(paymasterSignHash, userPrivateKey);

    // const chainId = (await hardhatProvider.getNetwork()).chainId;
    userOp.signature = signUserOp(userOp, entryPoint.address, chainId, userPrivateKey);
    let result = await entryPointStatic.callStatic.simulateValidation(userOp);
    console.log(result);

    await entryPoint.handleOps([userOp], beneficialAccountAddress);
    expect(await maskToken.allowance(walletProxyAddress, depositPaymaster.address)).to.be.eq(constants.MaxUint256);

    await maskToken.approve(depositPaymaster.address, constants.MaxUint256);
    await depositPaymaster.addDepositFor(walletProxyAddress, utils.parseEther("2"));
    await entryPoint.depositTo(depositPaymaster.address, { value: utils.parseEther("1") });
    const paymasterLockTokenDeposit = await depositPaymaster.populateTransaction
      .lockTokenDeposit()
      .then((tx) => tx.data!);
    await walletLogic.exec(depositPaymaster.address, 0, paymasterLockTokenDeposit);
    let callData = walletLogic.interface.encodeFunctionData("execFromEntryPoint", [
      maskToken.address,
      0,
      (await maskToken.populateTransaction.approve(verifyingPaymaster.address, constants.MaxUint256)).data,
    ]);
    let userOp2 = await fillAndSign(
      {
        sender: walletProxyAddress,
        paymaster: depositPaymaster.address,
        paymasterData: utils.hexZeroPad(maskToken.address, 32),
        callData: callData,
      },
      userSigner,
      entryPoint,
    );
    result = await entryPointStatic.callStatic.simulateValidation(userOp2);
    console.log(result);

    await entryPoint.handleOps([userOp2], beneficialAccountAddress);
  });
});
