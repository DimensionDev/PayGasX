import { BigNumber, utils, Wallet } from "ethers";
import { arrayify, keccak256, parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWalletUpgradeable.sol/SimpleWalletUpgradeable.json";
import { SimpleWalletUpgradeable, SimpleWalletUpgradeable__factory, WalletProxy__factory } from "../types";

export const AddressZero = ethers.constants.AddressZero;

export const ONE_ETH = parseEther("1");
export const TWO_ETH = parseEther("2");
export const FIVE_ETH = parseEther("5");

let counter = 0;

// create non-random account, so gas calculations are deterministic
export function createWalletOwner(): Wallet {
  const privateKey = keccak256(Buffer.from(arrayify(BigNumber.from(++counter))));
  return new ethers.Wallet(privateKey, ethers.provider);
}

export async function deployWallet(
  entryPointAddress,
  ownerAddress,
  signer = ethers.provider.getSigner(),
): Promise<SimpleWalletUpgradeable> {
  const walletLogicContract = await new SimpleWalletUpgradeable__factory(signer).deploy();

  const simpleWalletInterface = new utils.Interface(SimpleWalletArtifact.abi);
  const data = simpleWalletInterface.encodeFunctionData("initialize", [entryPointAddress]);

  const wallet = await new WalletProxy__factory(signer).deploy(ownerAddress, walletLogicContract.address, data);

  await wallet.deployed();

  //not use hardhat-upgrade in case we should modify proxy shell itself
  const walletContract: SimpleWalletUpgradeable = new ethers.Contract(
    wallet.address,
    SimpleWalletArtifact.abi,
    signer,
  ) as SimpleWalletUpgradeable;
  return walletContract;
}
