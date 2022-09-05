import { BigNumber, Wallet } from "ethers";
import { arrayify, keccak256, parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

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
