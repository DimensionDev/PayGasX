// reference: https://github.com/qbzzt/opengsn/blob/master/01_SimpleUse/test/testcontracts.js
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

describe("Wallet testing", () => {
  const mnemonic = "test test test test test test test test test test test junk";
  let userSigner: Signer;
  let userAddress: string;
  let userPrivateKey: string;
  let beneficialAccount: Signer;
  let beneficialAccountAddress: string;
  let salt = 0;
  let saltValue;
  // let testCreate2FactoryAddress = "0x9C410A51Be344D1C0bFF9dD2F9b7b7401f3029f5";

  let entryPoint: Contract;
  let walletProxy: Contract;
  let singletonFactory;
  let walletProxyAddress: string;
  let walletProxyInitCode: utils.BytesLike;

  let chainId;

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

    // utils.hexZeroPad(utils.hexlify(salt), 32) doesn't return the correct bytes32 salt
    // saltValue = utils.hexZeroPad(utils.hexlify(salt), 32);
    saltValue = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const WalletProxyFactory = await ethers.getContractFactory("WalletProxy");
    const simpleWalletInterface = new utils.Interface(SimpleWalletArtifact.abi);
    const data = simpleWalletInterface.encodeFunctionData("initialize", [entryPoint.address, userAddress]);
    // WalletProxy constructor
    walletProxyInitCode = WalletProxyFactory.getDeployTransaction(userAddress, simpleWallet.address, data).data!;

    let walletAddress = utils.getCreate2Address(
      singletonFactory.address,
      saltValue,
      utils.keccak256(walletProxyInitCode),
    );
    console.log("predict wallet addr: ", walletAddress);
    walletProxyAddress = walletAddress;
    walletProxy = new ethers.Contract(walletProxyAddress, SimpleWalletArtifact.abi, userSigner);
  });

  it("test simulation", async () => {
    let userOperation: UserOperation = new UserOperation();
    userOperation.sender = walletProxyAddress;
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
    expect(events[0].args[0]).to.equal(walletProxyAddress);

    expect((await ethers.provider.getCode(walletProxyAddress)) == "0x").to.be.false;
    // console.log("\nShould return false here:", (await ethers.provider.getCode(walletProxyAddress)) === "0x");
    if ((await ethers.provider.getCode(walletProxyAddress)) === "0x") {
      userOperation.initCode = walletProxyInitCode;
      userOperation.nonce = 0;
    } else {
      await walletProxy.addDeposit({ value: utils.parseUnits("1", "ether") });
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
    await walletProxy.upgradeToAndCall(simpleWallet.address, "0x", false);
  });
});
