import { BigNumber, utils, Wallet } from "ethers";

import { parseEther, parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { UserOperation } from "../Objects/userOperation";

export const paymasterStake = utils.parseEther("0.01");
export const unstakeDelaySec = 60;
export const AddressZero = ethers.constants.AddressZero;
export const HashZero = ethers.constants.HashZero;
export const MaxUint256 = ethers.constants.MaxUint256;
export const ONE_ETH = parseEther("1");
export const TWO_ETH = parseEther("2");
export const FIVE_ETH = parseEther("5");

// for test create redPacket
const testWallet = Wallet.createRandom();
export const testPrivateKey: string = testWallet.privateKey;
const testAddress: string = testWallet.address;
export const passwd = "password";
const ethAddress = `0x${"0".repeat(40)}`;

export const defaultForUserOp = new UserOperation();
defaultForUserOp.sender = AddressZero;
// default verification gas. will add create2 cost (3200+200*length) if initCode exists
defaultForUserOp.verificationGas = 100000;
defaultForUserOp.maxPriorityFeePerGas = parseUnits("1", "gwei");
defaultForUserOp.paymaster = AddressZero;

export const panicCodes: { [key: number]: string } = {
  // from https://docs.soliditylang.org/en/v0.8.0/control-structures.html
  0x01: "assert(false)",
  0x11: "arithmetic overflow/underflow",
  0x12: "divide by zero",
  0x21: "invalid enum value",
  0x22: "storage byte array that is incorrectly encoded",
  0x31: ".pop() on an empty array.",
  0x32: "array sout-of-bounds or negative index",
  0x41: "memory overflow",
  0x51: "zero-initialized variable of internal function type",
};

export const creationParams: FtCreationParamType = {
  publicKey: testAddress,
  number: 3,
  ifrandom: true,
  duration: 1000,
  seed: utils.sha256(utils.toUtf8Bytes("lajsdklfjaskldfhaikl")),
  message: "Hi",
  name: "cache",
  tokenType: 0,
  tokenAddr: ethAddress,
  totalTokens: 100000000,
  txParameters: {
    gasLimit: BigNumber.from("6000000"),
    value: BigNumber.from("100000000"),
  },
};

export interface FtCreationParamType {
  publicKey: string;
  number: number;
  ifrandom: boolean;
  duration: number;
  seed: string;
  message: string;
  name: string;
  tokenType: number;
  tokenAddr: string;
  totalTokens: number;
  txParameters?: TxParameter;
}

interface TxParameter {
  gasLimit?: BigNumber;
  value?: BigNumber;
}
