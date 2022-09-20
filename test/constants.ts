import { BigNumber, utils, Wallet } from "ethers";

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

// for test create redPacket
const testWallet = Wallet.createRandom();
export const testPrivateKey: string = testWallet.privateKey;
const testAddress: string = testWallet.address;
export const passwd = "password";
const ethAddress = `0x${"0".repeat(40)}`;

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
