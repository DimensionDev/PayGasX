import { ethers } from "hardhat";

const Create2Factory = "0xce0042b868300000d44a59004da54a005ffdcf9f";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // deploy fake mask token (only testnet)
  let maskTokenAddress = "0xF8935Df67cAB7BfcA9532D1Ac2088C5c39b995b5";
  if (!maskTokenAddress) {
    const MaskTokenFactory = await ethers.getContractFactory("MaskToken");
    const maskToken = await MaskTokenFactory.deploy();

    await maskToken.deployed();
    console.log("MaskToken address:", maskToken.address);

    maskTokenAddress = maskToken.address;
  }

  // deploy entry point with create2 factory
  let entryPointAddress = "0x8A42F70047a99298822dD1dbA34b454fc49913F2";
  if (!entryPointAddress) {
    const EntryPointFactory = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPointFactory.deploy(Create2Factory, ethers.utils.parseEther("0.01"), 60);

    await entryPoint.deployed();
    console.log("entryPoint address:", entryPoint.address);

    entryPointAddress = entryPoint.address;
  }

  // deploy deposit paymaster
  let depositPaymasterAddress = "0x808c7f48a64404e4e97d9b62b21f13F984fF1a96";
  if (!depositPaymasterAddress) {
    const DepositPaymasterFactory = await ethers.getContractFactory("DepositPaymaster");
    const depositPaymaster = await DepositPaymasterFactory.deploy(entryPointAddress, maskTokenAddress);

    await depositPaymaster.deployed();
    console.log("depositPaymaster address:", depositPaymaster.address);

    depositPaymasterAddress = depositPaymaster.address;
  }

  let nativeTokenPaymasterAddress;
  if (!nativeTokenPaymasterAddress) {
    const NativeTokenPaymasterFactory = await ethers.getContractFactory("NativeTokenPaymaster");
    const nativeTokenPaymaster = await NativeTokenPaymasterFactory.deploy(entryPointAddress);

    await nativeTokenPaymaster.deployed();
    console.log("nativeTokenPaymaster address:", nativeTokenPaymaster.address);

    nativeTokenPaymasterAddress = nativeTokenPaymaster.address;
  }

  //deploy presetFactory
  let presetFactoryAddress;
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
  let verifyPaymasterAddress = "0xB349AC5E5C037C2ecb2AE9fCDc8F122b5f384620";
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
  let walletLogicAddress;
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
