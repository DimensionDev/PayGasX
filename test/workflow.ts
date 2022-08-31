// Temporary files for testing and deployment
// TODO: need to be deleted when test and deploy files are ready

import fs from "fs";
import { ethers } from "hardhat";
import { Create2Factory } from "./utils/const";

import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  // #region init variables

  if (!process.env.USER_PRIVATE_KEY) throw new Error("USER_PRIVATE_KEY is not defined");
  if (!process.env.PAYMASTER_PRIVATE_KEY) throw new Error("PAYMASTER_PRIVATE_KEY is not defined");
  if (!process.env.PAYMASTER_SIGN_KEY) throw new Error("PAYMASTER_SIGN_KEY is not defined");
  if (!process.env.BENEFICIARY_ADDR) throw new Error("BENEFICIARY_ADDR is not defined");
  if (!process.env.HTTP_PROVIDER) throw new Error("HTTP_PROVIDER is not defined");
  if (!process.env.SPONSOR_KEY) throw new Error("SPONSOR_KEY is not defined");

  /**
   * ETH provider url
   */
  const HTTP_PROVIDER = process.env.HTTP_PROVIDER;

  /**
   * paymaster private key
   */
  const PAYMASTER_PRIVATE_KEY = process.env.PAYMASTER_PRIVATE_KEY;

  /**
   * paymaster sign key
   */
  const PAYMASTER_SIGN_KEY = process.env.PAYMASTER_SIGN_KEY;

  /**
   * beneficiary address
   */
  const BENEFICIARY_ADDR = process.env.BENEFICIARY_ADDR;

  /**
   * user private key
   */
  const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY;

  /**
   * SPONSOR_KEY
   */

  // #region import accounts from private key
  const SPONSOR_KEY = process.env.SPONSOR_KEY;

  const provider = new ethers.providers.JsonRpcProvider(HTTP_PROVIDER);
  const { chainId } = await provider.getNetwork();

  console.log("chainId:", chainId);

  const accountSponsor = new ethers.Wallet(SPONSOR_KEY, provider);
  const balance = parseFloat(ethers.utils.formatEther(await accountSponsor.getBalance()));

  console.log(balance);

  if (balance < 1 /* 1 ETH */) {
    throw new Error("balance is not enough");
  }

  console.log(`account:${accountSponsor.address},balance: ${balance} ETH`);

  // #endregion

  // #region singletonFactory
  const singletonFactoryAbi = JSON.parse(fs.readFileSync(`${__dirname}/ABI/SingletonFactory.json`, "utf8"));
  const singletonFactoryContract = new ethers.Contract(Create2Factory, singletonFactoryAbi);

  let entryPointAddress = "0x1064D04E4A8d4733c2964b5Efce6C7A3C1b06660";
  // let entryPointAddress;

  if (!entryPointAddress) {
    const entryPointObj = await ethers.getContractFactory("EntryPoint", accountSponsor);

    const entryPointBytecode = entryPointObj.getDeployTransaction(Create2Factory, ethers.utils.parseEther("0.001"), 60)
      .data!;

    const entryPointCreateSalt = ethers.utils.formatBytes32String("3");

    const entryPointAddressCreate2 = ethers.utils.getCreate2Address(
      Create2Factory,
      entryPointCreateSalt,
      ethers.utils.keccak256(entryPointBytecode),
    );

    console.log("entryPoint addr: ", entryPointAddressCreate2);

    const receipt = await singletonFactoryContract
      .connect(accountSponsor)
      .deploy(entryPointBytecode, entryPointCreateSalt, {
        gasLimit: 2500000, // TODO: Need to manually calculate a gas limit
      });

    entryPointAddress = entryPointAddressCreate2;
    // according rpc network delay, please run again
    throw new Error("please fill entrypoint address and run again");
  }

  // #region PayMaster
  // let payMasterAddress;
  let payMasterAddress = "0x546A094d11b2D97842C04ed7542882bb926685E0";
  const paymasterSigner = new ethers.Wallet(PAYMASTER_SIGN_KEY, provider);
  const paymasterOwner = new ethers.Wallet(PAYMASTER_PRIVATE_KEY, provider);

  if (!payMasterAddress) {
    // deploy PayMaster contract
    const payMasterObj = await ethers.getContractFactory("VerifyingPaymaster", paymasterOwner);

    const paymasterContract = await payMasterObj.deploy(entryPointAddress, paymasterSigner.address);
    await paymasterContract.deployed();

    payMasterAddress = paymasterContract.address;
    console.log(`PayMaster contract address: ${paymasterContract.address}`);

    // according rpc network delay, please run again
    throw new Error("please fill paymaster address and run again");
  }

  // get deposit info from entrypoint contract
  const entryPointContract = await (await ethers.getContractFactory("EntryPoint")).attach(entryPointAddress);
  const payMasterContract = await (await ethers.getContractFactory("VerifyingPaymaster")).attach(payMasterAddress);

  const depositInfo = await entryPointContract.connect(paymasterOwner).getDepositInfo(payMasterAddress);
  if (!depositInfo) {
    throw new Error("depositInfo is null,maybe cannot connect to entryPoint contract");
  }

  console.log(depositInfo);

  if (depositInfo.staked === false || parseFloat(depositInfo.stake.toString()) < 0.05) {
    // deposit 0.1 ETH
    const depositReceipt = await payMasterContract.connect(paymasterOwner).deposit({
      value: ethers.utils.parseEther("0.1"),
    });

    const stakeReceipt = await payMasterContract.connect(paymasterOwner).addStake(
      60 * 60 * 24 * 10, // 10 days
      { value: ethers.utils.parseEther("0.1") },
    );

    // according rpc network delay, please run again
    throw new Error("stake successfully, please run again");
  }

  // #endregion

  //create wallet by proxy
}

main();
