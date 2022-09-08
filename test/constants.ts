import { BigNumber, utils, Wallet } from "ethers";
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
