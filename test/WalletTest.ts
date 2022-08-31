import { use } from "chai";
import chaiAsPromised from "chai-as-promised";
import { BigNumber, constants, Contract, Signer, utils } from "ethers";
import { ethers, waffle } from "hardhat";
import EntryPointArtifact from "../artifacts/contracts/EntryPoint.sol/EntryPoint.json";
import WalletProxyArtifact from "../artifacts/contracts/proxy/WalletProxy.sol/WalletProxy.json";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWalletUpgradeable.sol/SimpleWalletUpgradeable.json";
import { UserOperation } from "./entity/userOperation";
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

  let entryPoint: Contract;
  let walletProxy: Contract;
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
    // FIXME: hardhat chainId 0 error
    // chainId = network.config.chainId;
    chainId = 0;

    const SimpleWalletFactory = await ethers.getContractFactory("SimpleWalletUpgradeable");
    let simpleWallet = await SimpleWalletFactory.deploy();
    const SingletonFactory = await ethers.getContractFactory("SingletonFactory");
    singletonFactory = await SingletonFactory.deploy();
    entryPoint = await deployContract(userSigner, EntryPointArtifact, [singletonFactory.address, 10, 10], {});

    const WalletProxyFactory = await ethers.getContractFactory("WalletProxy");
    const simpleWalletInterface = new utils.Interface(SimpleWalletArtifact.abi);
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
    walletProxy = new ethers.Contract(walletProxyAddress, SimpleWalletArtifact.abi, userSigner); // wallet doesn't exist yet
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
    // FIXME: causes error if wallet is deployed, call from non-entryPoint contract
    // potential fix: deploy wallet after estimateGas
    await userOperation.estimateGas(ethers.provider);

    // deploy wallet, check if wallet address match
    await singletonFactory.deploy(walletProxyInitCode, saltValue);
    let eventFilter = singletonFactory.filters.Deployed();
    let events = await singletonFactory.queryFilter(eventFilter);
    // console.log("singletonFactory: ", singletonFactory.address, events[0].args);
    expect((await ethers.provider.getCode(walletProxyAddress)) == "0x").to.be.false;
    expect(events[0].args[0]).to.eql(walletProxyAddress);
    expect(await walletProxy.entryPoint()).to.eql(entryPoint.address);

    if ((await ethers.provider.getCode(walletProxyAddress)) === "0x") {
      // should not reach here
      userOperation.initCode = walletProxyInitCode;
      userOperation.nonce = 0;
    } else {
      await walletProxy.addDeposit({ value: utils.parseUnits("1", "ether") });
      expect(await walletProxy.getDeposit()).to.eql(utils.parseUnits("1", "ether"));
      userOperation.nonce = parseInt(await walletProxy.nonce(), 10);
    }
    //transfer ether from simpleWallet for test
    let walletInterface = new utils.Interface(SimpleWalletArtifact.abi);
    userOperation.callData = walletInterface.encodeFunctionData("execFromEntryPoint", [
      userAddress,
      utils.parseUnits("0.00001", "ether"),
      "0x",
    ]);
    userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
    // FIXME: hardhat chainId 0 error
    const result = await entryPoint.callStatic.simulateValidation(userOperation);
    console.log(`simulateValidation result:`, result);

    // chainId = network.config.chainId;
    // chainId = 0;
    // userOperation.signature = signUserOp(userOperation, entryPoint.address, chainId, userPrivateKey);
    // console.log(userOperation);
    // console.log("test chain id: ", chainId);
    // await entryPoint.handleOps([userOperation], beneficialAccountAddress);
  });

  it("test upgradeability", async () => {
    const SimpleWalletFactory = await ethers.getContractFactory("SimpleWalletUpgradeable");
    let simpleWallet = await SimpleWalletFactory.deploy();
    walletProxy = new ethers.Contract(walletProxyAddress, WalletProxyArtifact.abi, userSigner);
    await expect(walletProxy.connect(beneficialAccount).upgradeToAndCall(simpleWallet.address, "0x", false)).to.be
      .rejected;
    await walletProxy.upgradeToAndCall(simpleWallet.address, "0x", false);
  });
});
