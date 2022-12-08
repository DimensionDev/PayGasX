import { ethers } from "hardhat";
import { Create2Factory } from "../test/utils/const";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // deploy fake mask token (only testnet)
  let maskTokenAddress;
  if (!maskTokenAddress) {
    const MaskTokenFactory = await ethers.getContractFactory("MaskToken");
    const maskToken = await MaskTokenFactory.deploy();

    await maskToken.deployed();
    console.log("MaskToken address:", maskToken.address);

    maskTokenAddress = maskToken.address;
  }

  // deploy entry point with create2 factory
  let entryPointAddress;
  if (!entryPointAddress) {
    const EntryPointFactory = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPointFactory.deploy(Create2Factory, ethers.utils.parseEther("0.01"), 60);

    await entryPoint.deployed();
    console.log("entryPoint address:", entryPoint.address);

    entryPointAddress = entryPoint.address;
  }

  // deploy deposit paymaster
  let depositPaymasterAddress;
  if (!depositPaymasterAddress) {
    const DepositPaymasterFactory = await ethers.getContractFactory("DepositPaymaster");
    const depositPaymaster = await DepositPaymasterFactory.deploy(entryPointAddress, maskTokenAddress);

    await depositPaymaster.deployed();
    console.log("depositPaymaster address:", depositPaymaster.address);

    depositPaymasterAddress = depositPaymaster.address;
  }

  // deploy verify paymaster
  let verifyPaymasterAddress;
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
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
