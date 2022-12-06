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
  WalletProxy__factory,
} from "../types";
import { MaskToken } from "../types/contracts/test/MaskToken";
import { AddressZero } from "./constants";
import { UserOperation } from "./entity/userOperation";
import { getPaymasterSignHash, signPaymasterHash, signUserOp } from "./utils";

const { expect } = use(chaiAsPromised);

describe("Wallet testing", () => {
  let deployer: Signer;
  let sponsorSigner: Signer;
  let userSigner: Signer;
  let beneficialAccount: Signer;
  let deployerAddress: string;
  let userPrivateKey: string;
  let userAddress: string;
  let sponsorAddress: string;
  let beneficialAccountAddress: string;

  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  let simpleWallet: SimpleWalletUpgradeable;
  let walletLogic: SimpleWalletUpgradeable;
  let singletonFactory: SingletonFactory;
  let walletProxyAddress: string;
  let walletProxyInitCode: utils.BytesLike;

  let saltValue: string;
  let chainId: number;

  before(async () => {
    [deployer, beneficialAccount, sponsorSigner] = await ethers.getSigners();
    deployerAddress = await deployer.getAddress();
    sponsorAddress = await sponsorSigner.getAddress();
    userPrivateKey = Wallet.createRandom().privateKey;
    userSigner = new Wallet(userPrivateKey, ethers.provider);

    userAddress = await userSigner.getAddress();
    beneficialAccountAddress = await beneficialAccount.getAddress();
    chainId = network.config.chainId!;

    simpleWallet = await new SimpleWalletUpgradeable__factory(deployer).deploy();
    singletonFactory = await new SingletonFactory__factory(deployer).deploy();
    entryPoint = await new EntryPoint__factory(deployer).deploy(singletonFactory.address, 10, 10);
    entryPointStatic = entryPoint.connect(AddressZero);

    const WalletProxyFactory = await ethers.getContractFactory("WalletProxy");
    const data = simpleWallet.interface.encodeFunctionData("initialize", [
      entryPoint.address,
      userAddress,
      constants.AddressZero,
      constants.AddressZero,
      0,
    ]);
    // WalletProxy constructor
    walletProxyInitCode = WalletProxyFactory.getDeployTransaction(userAddress, simpleWallet.address, data).data!;
    saltValue = utils.hexZeroPad(userAddress, 32);
    let walletAddress = utils.getCreate2Address(
      singletonFactory.address,
      saltValue,
      utils.keccak256(walletProxyInitCode),
    );
    walletProxyAddress = walletAddress;
    walletLogic = new ethers.Contract(
      walletProxyAddress,
      SimpleWalletUpgradeable__factory.abi,
      deployer,
    ) as SimpleWalletUpgradeable; // wallet doesn't exist yet
    expect((await ethers.provider.getCode(walletProxyAddress)) == "0x").to.be.true;
  });

  it("test wallet owner", async () => {
    let maskToken = await new MaskToken__factory(deployer).deploy();
    let walletContract = await new SimpleWalletUpgradeable__factory(deployer).deploy();
    expect(await maskToken.allowance(walletContract.address, entryPoint.address)).to.eq(BigNumber.from(0));
    await walletContract.initialize(
      entryPoint.address,
      deployerAddress,
      maskToken.address,
      entryPoint.address,
      utils.parseUnits("1", "ether"),
    );
    expect(await maskToken.allowance(walletContract.address, entryPoint.address)).to.eq(utils.parseUnits("1", "ether"));
    await deployer.sendTransaction({
      from: deployerAddress,
      to: walletContract.address,
      value: utils.parseUnits("2", "ether"),
    });
    await expect(await ethers.provider.getBalance(walletContract.address)).to.be.eq(utils.parseUnits("2", "ether"));
    await walletContract.transfer(beneficialAccountAddress, utils.parseUnits("1", "ether"));
    await expect(await ethers.provider.getBalance(walletContract.address)).to.be.eq(utils.parseUnits("1", "ether"));
    await walletContract.changeOwner(beneficialAccountAddress);
    await expect(walletContract.transfer(beneficialAccountAddress, utils.parseUnits("1", "ether"))).to.be.revertedWith(
      "only owner",
    );
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

    // deploy wallet, check if wallet address match
    await singletonFactory.deploy(walletProxyInitCode, saltValue);
    let eventFilter = singletonFactory.filters.Deployed();
    let events = await singletonFactory.queryFilter(eventFilter);
    expect((await ethers.provider.getCode(walletProxyAddress)) == "0x").to.be.false;
    expect(events[0].args[0]).to.eql(walletProxyAddress);
    expect(await walletLogic.entryPoint()).to.eql(entryPoint.address);
    await walletLogic.addDeposit({ value: utils.parseUnits("1", "ether") });
    expect(await walletLogic.getDeposit()).to.eql(utils.parseUnits("1", "ether"));
    userOperation.nonce = await walletLogic.nonce();
    //transfer ether from simpleWallet for test
    await deployer.sendTransaction({
      from: deployerAddress,
      to: walletProxyAddress,
      value: utils.parseUnits("2", "ether"),
    });
    userOperation.callData = walletLogic.interface.encodeFunctionData("execFromEntryPoint", [
      sponsorAddress,
      utils.parseUnits("0.1", "ether"),
      "0x",
    ]);
    await userOperation.estimateGas(ethers.provider, entryPoint.address);
    userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
    let sponsorInitialBal = await ethers.provider.getBalance(sponsorAddress);
    const result = await entryPointStatic.callStatic.simulateValidation(userOperation);
    console.log(`simulateValidation result:`, result);
    await entryPoint.handleOps([userOperation], beneficialAccountAddress);
    expect(await ethers.provider.getBalance(sponsorAddress)).to.eq(
      sponsorInitialBal.add(utils.parseUnits("0.1", "ether")),
    );
  });

  it("test upgradeability", async () => {
    let testSimpleWallet = await new SimpleWalletUpgradeable__factory(deployer).deploy();
    let testProxy = await new WalletProxy__factory(deployer).deploy(
      await deployer.getAddress(),
      testSimpleWallet.address,
      "0x",
    );
    testSimpleWallet = new ethers.Contract(
      testProxy.address,
      SimpleWalletUpgradeable__factory.abi,
      deployer,
    ) as SimpleWalletUpgradeable;
    await testSimpleWallet.initialize(
      entryPoint.address,
      await deployer.getAddress(),
      constants.AddressZero,
      constants.AddressZero,
      0,
    );
    await expect(
      testProxy.connect(beneficialAccount).upgradeToAndCall(testSimpleWallet.address, "0x", false),
    ).to.be.revertedWith("only owner");
    await testProxy.upgradeToAndCall(testSimpleWallet.address, "0x", false);
  });

  describe("test paymaster", async () => {
    let maskToken: MaskToken;
    let depositPaymaster: DepositPaymaster;
    it("test normal workflow", async () => {
      maskToken = await new MaskToken__factory(deployer).deploy();
      await maskToken.transfer(walletProxyAddress, utils.parseEther("100"));
      depositPaymaster = await new DepositPaymaster__factory(deployer).deploy(entryPoint.address, maskToken.address);
      await depositPaymaster.addStake(0, { value: utils.parseEther("2") });
      await maskToken.approve(depositPaymaster.address, constants.MaxUint256);
      await depositPaymaster.connect(deployer).adjustAdmin(await deployer.getAddress(), true);
      await depositPaymaster.addDepositFor(walletProxyAddress, utils.parseEther("2"));
      await entryPoint.depositTo(depositPaymaster.address, { value: utils.parseEther("1") });
      let verifyingPaymaster = await new VerifyingPaymaster__factory(deployer).deploy(
        entryPoint.address,
        userAddress, // paymaster signer for verifying signature
        maskToken.address,
        depositPaymaster.address,
      );
      await verifyingPaymaster.deposit({ value: utils.parseEther("1") });
      await verifyingPaymaster.addStake(0, { value: utils.parseEther("1") });

      let userOp1 = new UserOperation();
      userOp1.sender = walletProxyAddress;
      userOp1.maxFeePerGas = utils.parseUnits("1", "gwei");
      userOp1.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
      userOp1.paymaster = verifyingPaymaster.address;
      userOp1.initCode = "0x";
      userOp1.nonce = await walletLogic.nonce();

      const approveData = maskToken.interface.encodeFunctionData("approve", [
        depositPaymaster.address,
        constants.MaxUint256,
      ]);
      userOp1.callData = walletLogic.interface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        approveData,
      ]);
      await userOp1.estimateGas(ethers.provider, entryPoint.address);

      const paymasterSignHash = getPaymasterSignHash(userOp1);
      userOp1.paymasterData = signPaymasterHash(paymasterSignHash, userPrivateKey);

      userOp1.signature = signUserOp(userOp1, entryPoint.address, chainId, userPrivateKey);

      let userOp2 = new UserOperation();
      userOp2.sender = walletProxyAddress;
      userOp2.nonce = userOp1.nonce; // when calling simulateValidation(), nonce would be the same
      userOp2.initCode = "0x";
      userOp2.maxFeePerGas = utils.parseUnits("1", "gwei");
      userOp2.maxPriorityFeePerGas = utils.parseUnits("1", "gwei");
      userOp2.paymaster = depositPaymaster.address;
      userOp2.paymasterData = utils.hexZeroPad(maskToken.address, 32);
      const tokenApprovePaymaster = maskToken.interface.encodeFunctionData("approve", [
        verifyingPaymaster.address,
        constants.MaxUint256,
      ]);
      userOp2.callData = walletLogic.interface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        tokenApprovePaymaster,
      ]);
      await userOp2.estimateGas(ethers.provider, entryPoint.address);
      userOp2.signature = signUserOp(userOp2, entryPoint.address, chainId, userPrivateKey);

      let result = await entryPointStatic.callStatic.simulateValidation(userOp1);
      console.log(result);
      result = await entryPointStatic.callStatic.simulateValidation(userOp2);
      console.log(result);
      // when putting two userOpt in one tx, we have to calculate the nonce manually, and re-sign the userOpt
      userOp2.nonce = userOp1.nonce.add(1);
      userOp2.signature = signUserOp(userOp2, entryPoint.address, chainId, userPrivateKey);
      await entryPoint.handleOps([userOp1, userOp2], beneficialAccountAddress);
      expect(await maskToken.allowance(walletProxyAddress, depositPaymaster.address)).to.be.eq(constants.MaxUint256);
      expect(await maskToken.allowance(walletProxyAddress, verifyingPaymaster.address)).to.eq(constants.MaxUint256);
    });

    it("can receive erc721 assets", async () => {
      const testNft = await new TESTNFT__factory(deployer).deploy();
      await testNft.connect(deployer).mint(walletLogic.address, 0);
      expect(await testNft.ownerOf(0)).eq(walletLogic.address);
    });

    it("test deploy and send tx in the same tx", async () => {
      let userOperation: UserOperation = new UserOperation();
      let salt = utils.hexZeroPad("0x0", 32);
      const data = walletLogic.interface.encodeFunctionData("initialize", [
        entryPoint.address,
        userAddress,
        maskToken.address,
        depositPaymaster.address,
        utils.parseEther("200"),
      ]);
      // WalletProxy constructor
      const WalletProxyFactory = await ethers.getContractFactory("WalletProxy");
      walletProxyInitCode = WalletProxyFactory.getDeployTransaction(userAddress, simpleWallet.address, data).data!;
      let walletAddress = utils.getCreate2Address(singletonFactory.address, salt, utils.keccak256(walletProxyInitCode));
      await maskToken.transfer(walletAddress, utils.parseEther("55"));
      await depositPaymaster.connect(deployer).adjustAdmin(await deployer.getAddress(), true);
      await depositPaymaster.addDepositFor(walletAddress, utils.parseEther("200"));
      userOperation.sender = walletAddress;
      userOperation.initCode = walletProxyInitCode;
      userOperation.nonce = 0; // should match salt value if deploying through EP
      expect((await ethers.provider.getCode(walletAddress)) == "0x").to.be.true;
      let gasFee = {
        Max: BigNumber.from(5e9),
        MaxPriority: BigNumber.from(5e9),
      };
      userOperation.maxFeePerGas = gasFee.Max;
      userOperation.maxPriorityFeePerGas = gasFee.MaxPriority;
      userOperation.paymaster = depositPaymaster.address;
      userOperation.paymasterData = utils.hexZeroPad(maskToken.address, 32);
      const transferData = maskToken.interface.encodeFunctionData("transfer", [
        sponsorAddress,
        utils.parseUnits("1", "ether"),
      ]);
      userOperation.callData = walletLogic.interface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        transferData,
      ]);
      await userOperation.estimateGas(ethers.provider, entryPoint.address);
      userOperation.callGas = BigNumber.from(2).mul(userOperation.callGas); // FIXME: provider.estimateGas doesn't return enough gas to complete the tx
      userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
      let sponsorInitialBal = await maskToken.balanceOf(sponsorAddress);
      const result = await entryPointStatic.callStatic.simulateValidation(userOperation);
      console.log(`simulateValidation result:`, result);
      await entryPoint.handleOps([userOperation], beneficialAccountAddress);
      expect(await maskToken.balanceOf(sponsorAddress)).to.eq(sponsorInitialBal.add(utils.parseUnits("1", "ether")));
    });
  });
});
