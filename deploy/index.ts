import { ethers } from "hardhat";

const Create2Factory = "0xce0042b868300000d44a59004da54a005ffdcf9f";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // deploy fake mask token (only testnet)
  let maskTokenAddress = "0x2b9e7ccdf0f4e5b24757c1e1a80e311e34cb10c7";
  if (!maskTokenAddress) {
    const MaskTokenFactory = await ethers.getContractFactory("MaskToken");
    const maskToken = await MaskTokenFactory.deploy();

    await maskToken.deployed();
    console.log("MaskToken address:", maskToken.address);

    maskTokenAddress = maskToken.address;
  }

  // deploy entry point with create2 factory
  let entryPointAddress = "0x43B87595F319B17F3386Ac244A00944B3f5A532A";
  if (!entryPointAddress) {
    const EntryPointFactory = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPointFactory.deploy(Create2Factory, ethers.utils.parseEther("0.01"), 60);

    await entryPoint.deployed();
    console.log("entryPoint address:", entryPoint.address);

    entryPointAddress = entryPoint.address;
  }

  // deploy deposit paymaster
  let depositPaymasterAddress = "0x46a47fEf332FBB124D8197afFED5994D89B6BF71";
  if (!depositPaymasterAddress) {
    const DepositPaymasterFactory = await ethers.getContractFactory("DepositPaymaster");
    const depositPaymaster = await DepositPaymasterFactory.deploy(entryPointAddress, maskTokenAddress);

    await depositPaymaster.deployed();
    console.log("depositPaymaster address:", depositPaymaster.address);

    depositPaymasterAddress = depositPaymaster.address;
  }

  let nativeTokenPaymasterAddress = "0x0B81e2d66F6c52AaAEa836240f63e1b43643B5f9";
  if (!nativeTokenPaymasterAddress) {
    const NativeTokenPaymasterFactory = await ethers.getContractFactory("NativeTokenPaymaster");
    const nativeTokenPaymaster = await NativeTokenPaymasterFactory.deploy(entryPointAddress);

    await nativeTokenPaymaster.deployed();
    console.log("nativeTokenPaymaster address:", nativeTokenPaymaster.address);

    nativeTokenPaymasterAddress = nativeTokenPaymaster.address;
  }

  //deploy presetFactory
  let presetFactoryAddress = "0xce822a5904ef877caf11aaa02ccf4ab13f18dfb6";
  if (!presetFactoryAddress) {
    const PresetFactoryFactory = await ethers.getContractFactory("PresetFactory");
    const presetFactory = await PresetFactoryFactory.deploy(
      depositPaymasterAddress,
      nativeTokenPaymasterAddress,
      deployer.address,
      maskTokenAddress,
      ethers.utils.parseEther("1"),
      ethers.utils.parseEther("1"),
      ethers.utils.parseEther("1"),
    );
    await presetFactory.deployed();
    console.log("presetFactory address:", presetFactory.address);

    presetFactoryAddress = presetFactory.address;

    // give admin permission to deposit paymaster
    const depositPaymaster = await (
      await ethers.getContractFactory("DepositPaymaster")
    ).attach(depositPaymasterAddress);
    await depositPaymaster.connect(deployer).adjustAdmin(presetFactoryAddress, true);

    // give admin permission to native token paymaster
    const nativeTokenPaymaster = await (
      await ethers.getContractFactory("NativeTokenPaymaster")
    ).attach(nativeTokenPaymasterAddress);
    await nativeTokenPaymaster.connect(deployer).adjustAdmin(presetFactoryAddress, true);
  }

  // deploy verify paymaster
  let verifyPaymasterAddress = "0x540dcAc69cfFD35e2afDDdf610Ba8E7b2A917E6E";
  if (!verifyPaymasterAddress) {
    const VerifyingPaymasterFactory = await ethers.getContractFactory("VerifyingPaymaster");
    const verifyingPaymaster = await VerifyingPaymasterFactory.deploy(
      entryPointAddress,
      await deployer.getAddress(), // can be any singer address
      maskTokenAddress,
      depositPaymasterAddress,
    );

    await verifyingPaymaster.deployed();
    console.log("verifyingPaymaster address:", verifyingPaymaster.address);

    verifyPaymasterAddress = verifyingPaymaster.address;
  }

  // deploy wallet logic contract
  let walletLogicAddress = "0xa835e7ebe39107907d7f58d459945979f86a34ad";
  if (!walletLogicAddress) {
    const WalletLogicFactory = await ethers.getContractFactory("SimpleWalletUpgradeable");
    const walletLogic = await WalletLogicFactory.deploy();

    await walletLogic.deployed();
    console.log("walletLogic address:", walletLogic.address);

    walletLogicAddress = walletLogic.address;
  }

  const entryPoint = await (await ethers.getContractFactory("EntryPoint")).attach(entryPointAddress);
  const depositPaymaster = await (await ethers.getContractFactory("DepositPaymaster")).attach(depositPaymasterAddress);
  await depositPaymaster.addStake(0, { value: ethers.utils.parseEther("1") });
  await entryPoint.depositTo(depositPaymaster.address, { value: ethers.utils.parseEther("1") });

  const nativeTokenPaymaster = await (
    await ethers.getContractFactory("NativeTokenPaymaster")
  ).attach(nativeTokenPaymasterAddress);
  await nativeTokenPaymaster.addStake(0, { value: ethers.utils.parseEther("1") });
  await entryPoint.depositTo(nativeTokenPaymaster.address, { value: ethers.utils.parseEther("1") });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
