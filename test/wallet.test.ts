import { use } from "chai";
import chaiAsPromised from "chai-as-promised";
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
  WalletProxy__factory,
} from "../types";
import { AddressZero, ONE_ETH, TWO_ETH } from "./constants";
import { UserOperation } from "./entity/userOperation";
import { revertToSnapShot, takeSnapshot } from "./helper";
import { createDefaultUserOp, getPaymasterSignHash, signPaymasterHash, signUserOp } from "./utils";

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
  let maskToken: MaskToken;

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
    sponsorAddress = await sponsorSigner.getAddress();
    beneficialAccountAddress = await beneficialAccount.getAddress();

    simpleWallet = await new SimpleWalletUpgradeable__factory(deployer).deploy();
    singletonFactory = await new SingletonFactory__factory(deployer).deploy();
    entryPoint = await new EntryPoint__factory(deployer).deploy(singletonFactory.address, 10, 10);
    entryPointStatic = entryPoint.connect(AddressZero);

    const WalletProxyFactory = await ethers.getContractFactory("WalletProxy");
    const data = simpleWallet.interface.encodeFunctionData("initialize", [
      entryPoint.address,
      userAddress,
      AddressZero,
      AddressZero,
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
    // deploy wallet, check if wallet address match
    let eventFilter = singletonFactory.filters.Deployed();
    await singletonFactory.deploy(walletProxyInitCode, utils.hexZeroPad("0x1234", 32)); // random salt
    let events = await singletonFactory.queryFilter(eventFilter);
    expect(events[0].args[0] == walletProxyAddress).be.be.false;

    await singletonFactory.deploy(walletProxyInitCode, saltValue);
    expect((await ethers.provider.getCode(walletProxyAddress)) == "0x").to.be.false;
    events = await singletonFactory.queryFilter(eventFilter);
    expect(events[1].args[0] == walletProxyAddress).be.be.true;
    expect(await walletLogic.entryPoint()).to.eql(entryPoint.address);

    maskToken = await new MaskToken__factory(deployer).deploy();
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async () => {
    await revertToSnapShot(snapshotId);
  });

  it("test wallet owner", async () => {
    let walletContract = await new SimpleWalletUpgradeable__factory(deployer).deploy();
    expect(await maskToken.allowance(walletContract.address, entryPoint.address)).to.eq(BigNumber.from(0));
    await walletContract.initialize(
      entryPoint.address,
      deployerAddress,
      maskToken.address,
      entryPoint.address,
      ONE_ETH,
    );
    expect(await maskToken.allowance(walletContract.address, entryPoint.address)).to.eq(ONE_ETH);
    await deployer.sendTransaction({
      from: deployerAddress,
      to: walletContract.address,
      value: TWO_ETH,
    });
    await expect(await ethers.provider.getBalance(walletContract.address)).to.be.eq(TWO_ETH);
    await walletContract.transfer(beneficialAccountAddress, ONE_ETH);
    await expect(await ethers.provider.getBalance(walletContract.address)).to.be.eq(ONE_ETH);
    await walletContract.changeOwner(beneficialAccountAddress);
    await expect(walletContract.transfer(beneficialAccountAddress, ONE_ETH)).to.be.revertedWith("only owner");
  });

  it("can receive erc721 assets", async () => {
    const testNft = await new TESTNFT__factory(deployer).deploy();
    await testNft.connect(deployer).mint(walletProxyAddress, 0);
    expect(await testNft.ownerOf(0)).eq(walletProxyAddress);
  });

  it("test bad cases without paymaster", async () => {
    //transfer ether from simpleWallet for test
    await deployer.sendTransaction({
      from: deployerAddress,
      to: walletProxyAddress,
      value: TWO_ETH,
    });
    let userOperation: UserOperation = createDefaultUserOp(walletProxyAddress);
    await walletLogic.addDeposit({ value: ONE_ETH });
    expect(await walletLogic.getDeposit()).to.eql(ONE_ETH);
    userOperation.nonce = 50;
    userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
    await expect(entryPointStatic.callStatic.simulateValidation(userOperation)).to.be.reverted; // no gas

    await userOperation.estimateGas(ethers.provider, entryPoint.address);
    userOperation.callData = walletLogic.interface.encodeFunctionData("execFromEntryPoint", [
      sponsorAddress,
      utils.parseUnits("0.1", "ether"),
      "0x",
    ]);
    userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
    await expect(entryPointStatic.callStatic.simulateValidation(userOperation)).to.be.revertedWith(
      "wallet: invalid nonce",
    );

    userOperation.nonce = await walletLogic.nonce();
    let tempKey = Wallet.createRandom().privateKey;
    userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, tempKey);
    await expect(entryPointStatic.callStatic.simulateValidation(userOperation)).to.be.revertedWith(
      "wallet: wrong signature",
    );

    userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
    await entryPointStatic.callStatic.simulateValidation(userOperation);
    try {
      const result = await entryPointStatic.callStatic.simulateValidation(userOperation);
      if (result) {
        let sponsorInitialBal = await ethers.provider.getBalance(sponsorAddress);
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
    await testSimpleWallet.initialize(entryPoint.address, await deployer.getAddress(), AddressZero, AddressZero, 0);
    await expect(
      testProxy.connect(beneficialAccount).upgradeToAndCall(testSimpleWallet.address, "0x", false),
    ).to.be.revertedWith("only owner");
    await testProxy.upgradeToAndCall(testSimpleWallet.address, "0x", false);
  });

  describe("test paymaster", async () => {
    let depositPaymaster: DepositPaymaster;
    let verifyingPaymaster: VerifyingPaymaster;

    before(async () => {
      await maskToken.transfer(walletProxyAddress, utils.parseEther("100"));
      depositPaymaster = await new DepositPaymaster__factory(deployer).deploy(entryPoint.address, maskToken.address);
      await depositPaymaster.addStake(0, { value: TWO_ETH });
      await maskToken.approve(depositPaymaster.address, constants.MaxUint256);
      await depositPaymaster.connect(deployer).adjustAdmin(await deployer.getAddress(), true);
      await depositPaymaster.addDepositFor(walletProxyAddress, TWO_ETH);
      await entryPoint.depositTo(depositPaymaster.address, { value: ONE_ETH });
      verifyingPaymaster = await new VerifyingPaymaster__factory(deployer).deploy(
        entryPoint.address,
        userAddress, // paymaster signer for verifying signature
        maskToken.address,
        depositPaymaster.address,
      );
      await verifyingPaymaster.deposit({ value: ONE_ETH });
      await verifyingPaymaster.addStake(0, { value: ONE_ETH });
    });

    it("test normal workflow", async () => {
      let userOp1 = createDefaultUserOp(walletProxyAddress);
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
      let userOp2 = createDefaultUserOp(walletProxyAddress);
      userOp2.nonce = userOp1.nonce; // when calling simulateValidation(), nonce would be the same
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

      try {
        let result = await entryPointStatic.callStatic.simulateValidation(userOp1);
        if (result) {
          result = await entryPointStatic.callStatic.simulateValidation(userOp2);
          if (result) {
            // FIXME:
            // when putting two userOpt in one tx, we have to calculate the nonce manually, and re-sign the userOpt
            userOp2.nonce = userOp1.nonce.add(1);
            userOp2.signature = signUserOp(userOp2, entryPoint.address, chainId, userPrivateKey);
            await entryPoint.handleOps([userOp1, userOp2], beneficialAccountAddress);
            expect(await maskToken.allowance(walletProxyAddress, depositPaymaster.address)).to.be.eq(
              constants.MaxUint256,
            );
            expect(await maskToken.allowance(walletProxyAddress, verifyingPaymaster.address)).to.eq(
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
      expect((await ethers.provider.getCode(walletAddress)) == "0x").to.be.true;
      let userOperation: UserOperation = createDefaultUserOp(walletAddress);
      await maskToken.transfer(walletAddress, utils.parseEther("55"));
      await depositPaymaster.connect(deployer).adjustAdmin(await deployer.getAddress(), true);
      await depositPaymaster.addDepositFor(walletAddress, utils.parseEther("200"));
      // userOperation.initCode = "0x";
      userOperation.nonce = 0; // should match salt value if deploying through EP
      userOperation.paymaster = depositPaymaster.address;
      userOperation.paymasterData = utils.hexZeroPad(maskToken.address, 32);
      const transferData = maskToken.interface.encodeFunctionData("transfer", [sponsorAddress, ONE_ETH]);
      userOperation.callData = walletLogic.interface.encodeFunctionData("execFromEntryPoint", [
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
          let sponsorInitialBal = await maskToken.balanceOf(sponsorAddress);
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
