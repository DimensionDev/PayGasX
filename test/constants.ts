import { utils } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

export const paymasterStake = utils.parseEther("0.01");
export const unstakeDelaySec = 60;
export const AddressZero = ethers.constants.AddressZero;
export const HashZero = ethers.constants.HashZero;
export const MaxUint256 = ethers.constants.MaxUint256;
export const ONE_ETH = parseEther("1");
export const TWO_ETH = parseEther("2");
export const FIVE_ETH = parseEther("5");
