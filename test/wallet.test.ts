import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { BigNumber, constants, Signer, utils, Wallet } from "ethers";
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
  TESTNFT__factory,
  VerifyingPaymaster,
  VerifyingPaymaster__factory,
  WalletProxy,
  WalletProxy__factory,
} from "../types";
import { SimpleWalletUpgradeableInterface } from "../types/contracts/SimpleWalletUpgradeable";
import { AddressZero, ONE_ETH, TWO_ETH } from "./constants";
import { UserOperation } from "./entity/userOperation";
import { revertToSnapShot, takeSnapshot } from "./helper";
import {
  createDefaultUserOp,
  createWallet,
  getPaymasterSignHash,
  getProxyWalletInfo,
  signPaymasterHash,
  signUserOp,
} from "./utils";

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

  let maskToken: MaskToken;
  let entryPoint: EntryPoint;
  let entryPointStatic: EntryPoint;
  let walletImp: SimpleWalletUpgradeable;
  let simpleWalletInterface: SimpleWalletUpgradeableInterface;
  let walletLogic: SimpleWalletUpgradeable;
  let singletonFactory: SingletonFactory;
  let walletProxyAddress: string;
  let walletProxyInitCode: utils.BytesLike;

  let saltValue: string;
  let chainId: number;
  let snapshotId: string;

  before(async () => {
    chainId = network.config.chainId!;
    userPrivateKey = Wallet.createRandom().privateKey;
    userSigner = new Wallet(userPrivateKey, ethers.provider);
    userAddress = await userSigner.getAddress();
    [deployer, beneficialAccount, sponsorSigner] = await ethers.getSigners();
    deployerAddress = await deployer.getAddress();
    beneficialAccountAddress = await beneficialAccount.getAddress();
    sponsorAddress = await sponsorSigner.getAddress();

    maskToken = await new MaskToken__factory(deployer).deploy();
    walletImp = await new SimpleWalletUpgradeable__factory(deployer).deploy();
    simpleWalletInterface = walletImp.interface;
    singletonFactory = await new SingletonFactory__factory(deployer).deploy();
    entryPoint = await new EntryPoint__factory(deployer).deploy(singletonFactory.address, 10, 10);
    entryPointStatic = entryPoint.connect(AddressZero);

    const initializeData = simpleWalletInterface.encodeFunctionData("initialize", [
      entryPoint.address,
      userAddress,
      AddressZero,
      AddressZero,
      0,
    ]);
    // WalletProxy constructor
    saltValue = utils.hexZeroPad(userAddress, 32);
    const proxyWalletInfo = await getProxyWalletInfo(
      saltValue,
      walletImp.address,
      initializeData,
      userAddress,
      singletonFactory.address,
    );
    walletProxyInitCode = proxyWalletInfo.initCode;
    walletProxyAddress = proxyWalletInfo.address;
    walletLogic = new ethers.Contract(
      walletProxyAddress,
      SimpleWalletUpgradeable__factory.abi,
      deployer,
    ) as SimpleWalletUpgradeable;
    // wallet doesn't exist yet
    expect((await ethers.provider.getCode(walletProxyAddress)) == "0x").to.be.true;
    // deploy wallet, check if wallet address match
    await singletonFactory.deploy(walletProxyInitCode, utils.hexZeroPad("0x1234", 32)); // random salt
    await singletonFactory.deploy(walletProxyInitCode, saltValue); // salt used to calculate wallet address
    const eventFilter = singletonFactory.filters.Deployed();
    const events = await singletonFactory.queryFilter(eventFilter);
    expect(events[0].args[0] == walletProxyAddress).be.be.false;
    expect(events[1].args[0] == walletProxyAddress).be.be.true;
    expect((await ethers.provider.getCode(walletProxyAddress)) == "0x").to.be.false;
    expect(await walletLogic.entryPoint()).to.eql(entryPoint.address);
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  describe("test wallet basic logics", async () => {
    let testProxy: WalletProxy;
    let testSimpleWallet: SimpleWalletUpgradeable;

    before(async () => {
      testProxy = await new WalletProxy__factory(deployer).deploy(await deployer.getAddress(), walletImp.address, "0x");
      testSimpleWallet = new ethers.Contract(
        testProxy.address,
        SimpleWalletUpgradeable__factory.abi,
        deployer,
      ) as SimpleWalletUpgradeable;
      // initialize proxy/wallet owner
      await testSimpleWallet.initialize(
        entryPoint.address,
        deployerAddress,
        maskToken.address,
        beneficialAccountAddress,
        ONE_ETH,
      );
    });

    it("can receive erc721 assets", async () => {
      const testNft = await new TESTNFT__factory(deployer).deploy();
      await testNft.connect(deployer).mint(testSimpleWallet.address, 0);
      expect(await testNft.ownerOf(0)).eq(testSimpleWallet.address);
    });

    it("test trusted paymaster", async () => {
      await deployer.sendTransaction({
        from: deployerAddress,
        to: testSimpleWallet.address,
        value: TWO_ETH,
      });
      expect(await ethers.provider.getBalance(testSimpleWallet.address)).to.eq(TWO_ETH);
      await testSimpleWallet.connect(beneficialAccount).transfer(userAddress, ONE_ETH);
      expect(await ethers.provider.getBalance(userAddress)).to.eq(ONE_ETH);
      const randomAddress = Wallet.createRandom().address;
      await expect(testSimpleWallet.changePaymaster(randomAddress))
        .to.emit(testSimpleWallet, "PaymasterChanged")
        .withArgs(beneficialAccountAddress, randomAddress);
    });

    it("test initialization/upgradeability with ownership", async () => {
      expect(await testSimpleWallet.owner()).to.eq(deployerAddress);
      expect(await maskToken.allowance(testSimpleWallet.address, beneficialAccountAddress)).to.eq(ONE_ETH);
      // only using "testSimpleWallet.address" for upgrade testing, could use any address here
      await expect(
        testProxy.connect(beneficialAccount).upgradeToAndCall(testSimpleWallet.address, "0x", false),
      ).to.be.revertedWith("only owner");
      await expect(testSimpleWallet.changeOwner(beneficialAccountAddress))
        .to.emit(testSimpleWallet, "OwnerChanged")
        .withArgs(deployerAddress, beneficialAccountAddress);
      expect(await testSimpleWallet.owner()).to.eq(beneficialAccountAddress);
      await testProxy.connect(beneficialAccount).upgradeToAndCall(testSimpleWallet.address, "0x", false);
    });
  });

  describe("test without paymaster", async () => {
    let userOperation: UserOperation;

    it("fail due to no gas", async () => {
      userOperation = createDefaultUserOp(walletProxyAddress);
      userOperation.nonce = 50;
      userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
      await expect(entryPointStatic.callStatic.simulateValidation(userOperation)).to.be.reverted;
    });

    it("fail due to invalid nonce", async () => {
      await userOperation.estimateGas(ethers.provider, entryPoint.address);
      userOperation.callData = simpleWalletInterface.encodeFunctionData("execFromEntryPoint", [
        sponsorAddress,
        utils.parseUnits("0.1", "ether"),
        "0x",
      ]);
      userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
      await expect(entryPointStatic.callStatic.simulateValidation(userOperation))
        .to.be.revertedWithCustomError(entryPoint, "FailedOp")
        .withArgs(anyValue, anyValue, "wallet: invalid nonce");
    });

    it("fail due to wrong signature", async () => {
      userOperation.nonce = await walletLogic.nonce();
      let randomKey = Wallet.createRandom().privateKey;
      userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, randomKey);
      await expect(entryPointStatic.callStatic.simulateValidation(userOperation))
        .to.be.revertedWithCustomError(entryPoint, "FailedOp")
        .withArgs(anyValue, anyValue, "wallet: wrong signature");
    });

    it("normal workflow", async () => {
      // transfer ether to wallet for testing
      await deployer.sendTransaction({
        from: deployerAddress,
        to: walletProxyAddress,
        value: TWO_ETH,
      });
      userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
      try {
        const result = await entryPointStatic.callStatic.simulateValidation(userOperation);
        if (result) {
          const sponsorInitialBal = await ethers.provider.getBalance(sponsorAddress);
          await entryPoint.handleOps([userOperation], beneficialAccountAddress);
          expect(await ethers.provider.getBalance(sponsorAddress)).to.eq(
            sponsorInitialBal.add(utils.parseUnits("0.1", "ether")),
          );
        }
      } catch (error) {
        console.error(error);
        throw new Error("Simulation error");
      }
    });
  });

  describe("test paymaster", async () => {
    let depositPaymaster: DepositPaymaster;
    let verifyingPaymaster: VerifyingPaymaster;
    let salt = 0;
    let paymasterSigner: Wallet;

    before(async () => {
      paymasterSigner = createWallet();
      await maskToken.transfer(walletProxyAddress, utils.parseEther("100"));
      depositPaymaster = await new DepositPaymaster__factory(deployer).deploy(entryPoint.address, maskToken.address);
      await depositPaymaster.addStake(0, { value: TWO_ETH });
      await maskToken.approve(depositPaymaster.address, constants.MaxUint256);
      await depositPaymaster.connect(deployer).adjustAdmin(await deployer.getAddress(), true);
      await depositPaymaster.addDepositFor(walletProxyAddress, TWO_ETH);
      await entryPoint.depositTo(depositPaymaster.address, { value: ONE_ETH });
      verifyingPaymaster = await new VerifyingPaymaster__factory(deployer).deploy(
        entryPoint.address,
        paymasterSigner.address,
        maskToken.address,
        depositPaymaster.address,
      );
      await verifyingPaymaster.deposit({ value: ONE_ETH });
      await verifyingPaymaster.addStake(0, { value: ONE_ETH });

      const initializeData = simpleWalletInterface.encodeFunctionData("initialize", [
        entryPoint.address,
        userAddress,
        maskToken.address,
        depositPaymaster.address,
        utils.parseEther("200"),
      ]);
      const proxyWalletInfo = await getProxyWalletInfo(
        salt,
        walletImp.address,
        initializeData,
        userAddress,
        singletonFactory.address,
      );
      walletProxyInitCode = proxyWalletInfo.initCode;
      walletProxyAddress = proxyWalletInfo.address;
      expect((await ethers.provider.getCode(walletProxyAddress)) == "0x").to.be.true;
      await depositPaymaster.addDepositFor(walletProxyAddress, TWO_ETH);
    });

    it("wallet deployment through EntryPoint", async () => {
      let userOperation = createDefaultUserOp(walletProxyAddress);
      userOperation.nonce = salt;
      userOperation.initCode = walletProxyInitCode;
      userOperation.paymaster = depositPaymaster.address;
      userOperation.paymasterData = utils.hexZeroPad(maskToken.address, 32);
      await userOperation.estimateGas(ethers.provider, entryPoint.address);
      // should be safe to set callGas to 0 when callData = "0x"
      userOperation.callGas = 0;
      userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
      try {
        const result = await entryPointStatic.callStatic.simulateValidation(userOperation);
        if (result) {
          await entryPoint.handleOps([userOperation], beneficialAccountAddress);
        }
      } catch (error) {
        console.error(error);
        throw new Error("Simulation error");
      }
    });

    it("normal workflow", async () => {
      let userOp1 = createDefaultUserOp(walletLogic.address);
      userOp1.paymaster = verifyingPaymaster.address;
      userOp1.nonce = await walletLogic.nonce();
      const approveData = maskToken.interface.encodeFunctionData("approve", [
        depositPaymaster.address,
        constants.MaxUint256,
      ]);
      userOp1.callData = simpleWalletInterface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        approveData,
      ]);
      await userOp1.estimateGas(ethers.provider, entryPoint.address);
      const paymasterSignHash = getPaymasterSignHash(userOp1);
      userOp1.paymasterData = signPaymasterHash(paymasterSignHash, paymasterSigner.privateKey);
      userOp1.signature = signUserOp(userOp1, entryPoint.address, chainId, userPrivateKey);

      let userOp2 = createDefaultUserOp(walletLogic.address);
      userOp2.nonce = userOp1.nonce; // when calling simulateValidation(), nonce would be the same
      userOp2.paymaster = depositPaymaster.address;
      userOp2.paymasterData = utils.hexZeroPad(maskToken.address, 32);
      const tokenApprovePaymaster = maskToken.interface.encodeFunctionData("approve", [
        verifyingPaymaster.address,
        constants.MaxUint256,
      ]);
      userOp2.callData = simpleWalletInterface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        tokenApprovePaymaster,
      ]);
      await userOp2.estimateGas(ethers.provider, entryPoint.address);
      userOp2.signature = signUserOp(userOp2, entryPoint.address, chainId, userPrivateKey);
      try {
        let result = await entryPointStatic.callStatic.simulateValidation(userOp1);
        if (result) {
          result = await entryPointStatic.callStatic.simulateValidation(userOp2);
          if (result) {
            userOp2.nonce = userOp1.nonce.add(1);
            userOp2.signature = signUserOp(userOp2, entryPoint.address, chainId, userPrivateKey);
            await entryPoint.handleOps([userOp1, userOp2], beneficialAccountAddress);
            expect(await maskToken.allowance(walletLogic.address, depositPaymaster.address)).to.be.eq(
              constants.MaxUint256,
            );
            expect(await maskToken.allowance(walletLogic.address, verifyingPaymaster.address)).to.eq(
              constants.MaxUint256,
            );
          }
        }
      } catch (error) {
        console.error(error);
        throw new Error("Simulation error");
      }
    });

    it("test deploy and send tx in the same tx", async () => {
      await maskToken.transfer(walletProxyAddress, TWO_ETH);
      let userOperation: UserOperation = createDefaultUserOp(walletProxyAddress);
      userOperation.nonce = salt; // should match salt value if deploying through EP
      userOperation.paymaster = depositPaymaster.address;
      userOperation.paymasterData = utils.hexZeroPad(maskToken.address, 32);
      const transferData = maskToken.interface.encodeFunctionData("transfer", [sponsorAddress, ONE_ETH]);
      userOperation.callData = simpleWalletInterface.encodeFunctionData("execFromEntryPoint", [
        maskToken.address,
        0,
        transferData,
      ]);
      await userOperation.estimateGas(ethers.provider, entryPoint.address);
      userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
      await expect(entryPointStatic.callStatic.simulateValidation(userOperation)).to.be.reverted; // wallet not deployed

      userOperation.initCode = walletProxyInitCode;
      await userOperation.estimateGas(ethers.provider, entryPoint.address);
      userOperation.callGas = BigNumber.from(2).mul(userOperation.callGas);
      userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
      try {
        const result = await entryPointStatic.callStatic.simulateValidation(userOperation);
        if (result) {
          const sponsorInitialBal = await maskToken.balanceOf(sponsorAddress);
          await entryPoint.handleOps([userOperation], beneficialAccountAddress);
          expect(await maskToken.balanceOf(sponsorAddress)).to.eq(sponsorInitialBal.add(ONE_ETH));
        }
      } catch (error) {
        console.error(error);
        throw new Error("Simulation error");
      }
    });
  });
});
