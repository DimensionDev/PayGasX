import { ecsign, keccak256 as keccak256_buffer, toRpcSig } from "ethereumjs-util";
import { BigNumber, BigNumberish, Wallet } from "ethers";
import {
  arrayify,
  BytesLike,
  defaultAbiCoder,
  getCreate2Address,
  hexlify,
  hexZeroPad,
  keccak256,
  parseUnits,
} from "ethers/lib/utils";
import { ethers } from "hardhat";
import { UserOperation } from "./entity/userOperation";

import { utils } from "ethers";
import SimpleWalletArtifact from "../artifacts/contracts/SimpleWalletUpgradeable.sol/SimpleWalletUpgradeable.json";
import { SimpleWalletUpgradeable, SimpleWalletUpgradeable__factory, WalletProxy__factory } from "../types";
import { AddressZero } from "./utils/const";

export interface ContractWalletInfo {
  address: string;
  initCode: BytesLike;
}

let counter = 0;

// create non-random account, so gas calculations are deterministic
export function createWallet(): Wallet {
  const privateKey = keccak256(Buffer.from(arrayify(BigNumber.from(++counter))));
  return new ethers.Wallet(privateKey, ethers.provider);
}

const numberToBytes32Hex = (number: number): string => hexZeroPad(hexlify(number), 32);

export const create2 = (from: string, salt: number, initCode: BytesLike): string => {
  const saltBytes32 = numberToBytes32Hex(salt);
  const initCodeHash = keccak256(initCode);
  return getCreate2Address(from, saltBytes32, initCodeHash);
};

const encode = (typeValues: Array<{ type: string; val: any }>, forSignature: boolean): string => {
  const types = typeValues.map((typeValue) =>
    typeValue.type === "bytes" && forSignature ? "bytes32" : typeValue.type,
  );
  const values = typeValues.map((typeValue) =>
    typeValue.type === "bytes" && forSignature ? keccak256(typeValue.val) : typeValue.val,
  );
  return defaultAbiCoder.encode(types, values);
};

export const getPaymasterSignHash = (op: UserOperation): string => {
  return keccak256(
    defaultAbiCoder.encode(
      [
        "address", // sender
        "uint256", // nonce
        "bytes32", // initCode
        "bytes32", // callData
        "uint256", // callGas
        "uint", // verificationGas
        "uint", // preVerificationGas
        "uint256", // maxFeePerGas
        "uint256", // maxPriorityFeePerGas
        "address", // paymaster
      ],
      [
        op.sender,
        op.nonce,
        keccak256(op.initCode),
        keccak256(op.callData),
        op.callGas,
        op.verificationGas,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        op.paymaster,
      ],
    ),
  );
};

export const signPaymasterHash = (message: string, privateKey: string): string => {
  const msg1 = Buffer.concat([
    Buffer.from("\x19Ethereum Signed Message:\n32", "ascii"),
    Buffer.from(arrayify(message)),
  ]);

  const sig = ecsign(keccak256_buffer(msg1), Buffer.from(arrayify(privateKey)));
  // that's equivalent of:  await signer.signMessage(message);
  // (but without "async"
  const signedMessage1 = toRpcSig(sig.v, sig.r, sig.s);
  return signedMessage1;
};

export function packUserOp(op: UserOperation, forSignature = true): string {
  if (forSignature) {
    const userOpType = {
      components: [
        { type: "address", name: "sender" },
        { type: "uint256", name: "nonce" },
        { type: "bytes", name: "initCode" },
        { type: "bytes", name: "callData" },
        { type: "uint256", name: "callGas" },
        { type: "uint256", name: "verificationGas" },
        { type: "uint256", name: "preVerificationGas" },
        { type: "uint256", name: "maxFeePerGas" },
        { type: "uint256", name: "maxPriorityFeePerGas" },
        { type: "address", name: "paymaster" },
        { type: "bytes", name: "paymasterData" },
        { type: "bytes", name: "signature" },
      ],
      name: "userOp",
      type: "tuple",
    };
    let encoded = defaultAbiCoder.encode([userOpType as any], [{ ...op, signature: "0x" }]);
    // remove leading word (total length) and trailing word (zero-length signature)
    encoded = "0x" + encoded.slice(66, encoded.length - 64);
    return encoded;
  }

  const typeValues = [
    { type: "address", val: op.sender },
    { type: "uint256", val: op.nonce },
    { type: "bytes", val: op.initCode },
    { type: "bytes", val: op.callData },
    { type: "uint256", val: op.callGas },
    { type: "uint256", val: op.verificationGas },
    { type: "uint256", val: op.preVerificationGas },
    { type: "uint256", val: op.maxFeePerGas },
    { type: "uint256", val: op.maxPriorityFeePerGas },
    { type: "address", val: op.paymaster },
    { type: "bytes", val: op.paymasterData },
  ];
  if (!forSignature) typeValues.push({ type: "bytes", val: op.signature });
  return encode(typeValues, forSignature);
}

export function getRequestId(op: UserOperation, entryPointAddress: string, chainId: number): string {
  const userOpHash = keccak256(packUserOp(op, true));
  const enc = defaultAbiCoder.encode(["bytes32", "address", "uint256"], [userOpHash, entryPointAddress, chainId]);
  return keccak256(enc);
}

export const signUserOp = (
  op: UserOperation,
  entryPointAddress: string,
  chainId: number,
  privateKey: string,
): string => {
  const message = getRequestId(op, entryPointAddress, chainId);
  const msg1 = Buffer.concat([
    Buffer.from("\x19Ethereum Signed Message:\n32", "ascii"),
    Buffer.from(arrayify(message)),
  ]);

  const sig = ecsign(keccak256_buffer(msg1), Buffer.from(arrayify(privateKey)));
  const signedMessage1 = toRpcSig(sig.v, sig.r, sig.s);
  return signedMessage1;
};

export const getContractWalletInfo = async (
  simpleWalletCreateSalt: number,
  entryPointAddress: string,
  gasToken: string,
  paymaster: string,
  allowance: BigNumberish,
  ownerAddress: string,
  walletFactoryAddress: string,
): Promise<ContractWalletInfo> => {
  let contractFactory = await ethers.getContractFactory("SimpleWallet");
  let initCode = contractFactory.getDeployTransaction(
    entryPointAddress,
    ownerAddress,
    gasToken,
    paymaster,
    allowance,
  ).data;
  if (!initCode) throw new Error("node data");
  const address = create2(walletFactoryAddress, simpleWalletCreateSalt, initCode);
  return {
    address,
    initCode,
  };
};

export async function deployWallet(
  entryPointAddress,
  ownerAddress,
  signer = ethers.provider.getSigner(),
): Promise<SimpleWalletUpgradeable> {
  const walletLogicContract = await new SimpleWalletUpgradeable__factory(signer).deploy();

  const simpleWalletInterface = new utils.Interface(SimpleWalletArtifact.abi);
  const data = simpleWalletInterface.encodeFunctionData("initialize", [entryPointAddress, ownerAddress]);

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

export const createDefaultUserOp = (sender: string): UserOperation => {
  let userOp = new UserOperation();
  userOp.sender = sender;
  userOp.maxFeePerGas = parseUnits("1", "gwei");
  userOp.maxPriorityFeePerGas = parseUnits("1", "gwei");
  userOp.paymaster = AddressZero;
  return userOp;
};
