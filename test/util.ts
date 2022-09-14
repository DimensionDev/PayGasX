import { ecsign, keccak256 as keccak256_buffer, toRpcSig } from "ethereumjs-util";
import { BigNumber, Wallet, BigNumberish } from "ethers";
import {
  arrayify,
  BytesLike,
  defaultAbiCoder,
  getCreate2Address,
  hexlify,
  hexZeroPad,
  keccak256,
  parseEther,
  hexConcat,
} from "ethers/lib/utils";
import { ethers, waffle } from "hardhat";
import { UserOperation } from "../Objects/userOperation";
import { EntryPoint, EntryPoint__factory } from "../types";
import { Create2Factory } from "../src/Create2Factory";

export const AddressZero = ethers.constants.AddressZero;
export const HashZero = ethers.constants.HashZero;
export const ONE_ETH = parseEther("1");
export const TWO_ETH = parseEther("2");
export const FIVE_ETH = parseEther("5");

const { deployContract } = waffle;

interface ContractWalletInfo {
  address: string;
  initCode: BytesLike;
}

let counter = 0;

// create non-random account, so gas calculations are deterministic
export function createWalletOwner(): Wallet {
  const privateKey = keccak256(Buffer.from(arrayify(BigNumber.from(++counter))));
  return new ethers.Wallet(privateKey, ethers.provider);
  // return new ethers.Wallet('0x'.padEnd(66, privkeyBase), ethers.provider);
}

export function createAddress(): string {
  return createWalletOwner().address;
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
  ownerAddress: string,
  walletFactoryAddress: string,
): Promise<ContractWalletInfo> => {
  let contractFactory = await ethers.getContractFactory("SimpleWallet");
  let initCode = contractFactory.getDeployTransaction(entryPointAddress, ownerAddress).data;
  if (!initCode) throw new Error("node data");
  const address = create2(walletFactoryAddress, simpleWalletCreateSalt, initCode);
  return {
    address,
    initCode,
  };
};

export async function deployEntryPoint(
  paymasterStake: BigNumberish,
  unstakeDelaySecs: BigNumberish,
): Promise<EntryPoint> {
  const provider = ethers.provider;
  const create2factory = new Create2Factory(provider);
  const epf = new EntryPoint__factory(ethers.provider.getSigner());
  const ctrParams = defaultAbiCoder.encode(
    ["address", "uint256", "uint256"],
    [Create2Factory.contractAddress, paymasterStake, unstakeDelaySecs],
  );

  const addr = await create2factory.deploy(hexConcat([epf.bytecode, ctrParams]), 0);
  return EntryPoint__factory.connect(addr, provider.getSigner());
}

export function callDataCost(data: string): number {
  return ethers.utils
    .arrayify(data)
    .map((x) => (x === 0 ? 4 : 16))
    .reduce((sum, x) => sum + x);
}

const panicCodes: { [key: number]: string } = {
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

// rethrow "cleaned up" exception.
// - stack trace goes back to method (or catch) line, not inner provider
// - attempt to parse revert data (needed for geth)
// use with ".catch(rethrow())", so that current source file/line is meaningful.
export function rethrow(): (e: Error) => void {
  const callerStack = new Error().stack!.replace(/Error.*\n.*at.*\n/, "").replace(/.*at.* \(internal[\s\S]*/, "");

  if (arguments[0] != null) {
    throw new Error("must use .catch(rethrow()), and NOT .catch(rethrow)");
  }
  return function (e: Error) {
    const solstack = e.stack!.match(/((?:.* at .*\.sol.*\n)+)/);
    const stack = (solstack != null ? solstack[1] : "") + callerStack;
    // const regex = new RegExp('error=.*"data":"(.*?)"').compile()
    const found = /error=.*?"data":"(.*?)"/.exec(e.message);
    let message: string;
    if (found != null) {
      const data = found[1];
      message = decodeRevertReason(data) ?? e.message + " - " + data.slice(0, 100);
    } else {
      message = e.message;
    }
    const err = new Error(message);
    err.stack = "Error: " + message + "\n" + stack;
    throw err;
  };
}

export function decodeRevertReason(data: string, nullIfNoMatch = true): string | null {
  const methodSig = data.slice(0, 10);
  const dataParams = "0x" + data.slice(10);

  if (methodSig === "0x08c379a0") {
    const [err] = ethers.utils.defaultAbiCoder.decode(["string"], dataParams);
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `Error(${err})`;
  } else if (methodSig === "0x00fa072b") {
    const [opindex, paymaster, msg] = ethers.utils.defaultAbiCoder.decode(["uint256", "address", "string"], dataParams);
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `FailedOp(${opindex}, ${paymaster !== AddressZero ? paymaster : "none"}, ${msg})`;
  } else if (methodSig === "0x4e487b71") {
    const [code] = ethers.utils.defaultAbiCoder.decode(["uint256"], dataParams);
    return `Panic(${panicCodes[code] ?? code} + ')`;
  }
  if (!nullIfNoMatch) {
    return data;
  }
  return null;
}
