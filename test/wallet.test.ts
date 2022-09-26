import { use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, constants, Signer, utils, Wallet } from "ethers";
import { ethers, network } from "hardhat";

import {
  DepositPaymaster,
  DepositPaymaster__factory,
  EntryPoint,
  EntryPoint__factory,
  MaskToken__factory,
  SimpleWalletUpgradeable,
  SimpleWalletUpgradeable__factory,
  SingletonFactory,
  SingletonFactory__factory,
  TESTNFT__factory,
  VerifyingPaymaster__factory,
  WalletProxy,
  WalletProxy__factory,
} from "../types";
import { MaskToken } from "../types/contracts/test/MaskToken";
import { UserOperation } from "./entity/userOperation";
import { AddressZero } from "./utils/const";
import { getPayMasterSignHash, signPayMasterHash, signUserOp } from "./utils/UserOp";
const { expect } = use(chaiAsPromised);

describe("Wallet testing", () => {
  let deployer: Signer;
  let sponsorSigner: Signer;
  let userSigner: Signer;
  let beneficialAccount: Signer;
  let deployerAddress: string;
  let userPrivateKey: string;
  let userAddress: string;
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
    [deployer, beneficialAccount, sponsorSigner] = await ethers.getSigners();
    deployerAddress = await deployer.getAddress();
    userPrivateKey = Wallet.createRandom().privateKey;
    userSigner = new Wallet(userPrivateKey, ethers.provider);

    userAddress = await userSigner.getAddress();
    beneficialAccountAddress = await beneficialAccount.getAddress();
    chainId = network.config.chainId!;

    let simpleWallet = await new SimpleWalletUpgradeable__factory(deployer).deploy();
    singletonFactory = await new SingletonFactory__factory(deployer).deploy();
    entryPoint = await new EntryPoint__factory(deployer).deploy(singletonFactory.address, 10, 10);
    entryPointStatic = entryPoint.connect(AddressZero);

    const WalletProxyFactory = await ethers.getContractFactory("WalletProxy");
    const simpleWalletInterface = new utils.Interface(SimpleWalletUpgradeable__factory.abi);
    const data = simpleWalletInterface.encodeFunctionData("initialize", [entryPoint.address, userAddress]);
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
    walletProxy = new ethers.Contract(walletProxyAddress, WalletProxy__factory.abi, deployer) as WalletProxy;
    walletLogic = new ethers.Contract(
      walletProxyAddress,
      SimpleWalletUpgradeable__factory.abi,
      deployer,
    ) as SimpleWalletUpgradeable; // wallet doesn't exist yet
    expect((await ethers.provider.getCode(walletProxyAddress)) == "0x").to.be.true;
  });

  it("test wallet owner", async () => {
    let walletContract = await new SimpleWalletUpgradeable__factory(deployer).deploy();
    await walletContract.initialize(entryPoint.address, deployerAddress);
    await deployer.sendTransaction({
      from: deployerAddress,
      to: walletContract.address,
      value: utils.parseUnits("2", "ether"),
    });
    await expect(await ethers.provider.getBalance(walletContract.address)).to.be.eq(utils.parseUnits("2", "ether"));
    await walletContract.transfer(beneficialAccountAddress, utils.parseUnits("1", "ether"));
    await expect(await ethers.provider.getBalance(walletContract.address)).to.be.eq(utils.parseUnits("1", "ether"));
    await expect(
      walletContract.connect(beneficialAccount).transfer(beneficialAccountAddress, utils.parseUnits("1", "ether")),
    ).to.be.revertedWith("only owner");
  });

  it("test wallet without paymaster", async () => {
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
    let simpleWallet = await new SimpleWalletUpgradeable__factory(deployer).deploy();
    await expect(walletProxy.connect(beneficialAccount).upgradeToAndCall(simpleWallet.address, "0x", false)).to.be
      .rejected;
    // TODO: proxy owner has no eth to call upgrade
    // await walletProxy.connect(userSigner).upgradeToAndCall(simpleWallet.address, "0x", false);
  });

  describe("test paymaster", async () => {
    let maskToken: MaskToken;
    let depositPaymaster: DepositPaymaster;
    it("test paymaster", async () => {
      maskToken = await new MaskToken__factory(deployer).deploy();

      depositPaymaster = await new DepositPaymaster__factory(deployer).deploy(entryPoint.address, maskToken.address);
      await depositPaymaster.addStake(0, { value: utils.parseEther("2") });

      let verifyingPaymaster = await new VerifyingPaymaster__factory(deployer).deploy(
        entryPoint.address,
        userAddress, // paymaster signer for verifying signature
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

      userOp.signature = signUserOp(userOp, entryPoint.address, chainId, userPrivateKey);
      let result = await entryPointStatic.callStatic.simulateValidation(userOp);
      console.log(result);

      await entryPoint.handleOps([userOp], beneficialAccountAddress);
      expect(await maskToken.allowance(walletProxyAddress, depositPaymaster.address)).to.be.eq(constants.MaxUint256);

      await maskToken.approve(depositPaymaster.address, constants.MaxUint256);
      await depositPaymaster.addDepositFor(walletProxyAddress, utils.parseEther("2"));
      await entryPoint.depositTo(depositPaymaster.address, { value: utils.parseEther("1") });
      // await depositPaymaster.lockTokenDeposit();
      let callData = walletLogic.interface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        (await maskToken.populateTransaction.approve(verifyingPaymaster.address, constants.MaxUint256)).data,
      ]);
      userOp.nonce = await walletLogic.nonce();
      userOp.paymaster = depositPaymaster.address;
      userOp.paymasterData = utils.hexZeroPad(maskToken.address, 32);
      userOp.callData = callData;
      userOp.signature = signUserOp(userOp, entryPoint.address, chainId, userPrivateKey);
      // let userOp2 = await fillAndSign(
      //   {
      //     sender: walletProxyAddress,
      //     paymaster: depositPaymaster.address,
      //     paymasterData: utils.hexZeroPad(maskToken.address, 32),
      //     callData: callData,
      //   },
      //   userSigner,
      //   entryPoint,
      // );
      result = await entryPointStatic.callStatic.simulateValidation(userOp);
      console.log(result);
      await entryPoint.handleOps([userOp], beneficialAccountAddress);
    });

    it("can receive erc721 assets", async () => {
      const testNft = await new TESTNFT__factory(deployer).deploy();

      await testNft.connect(deployer).mint(walletLogic.address, 0);
      expect(await testNft.ownerOf(0)).eq(walletLogic.address);
    });
  });
});
