import { Signer, Wallet } from "ethers";
import { parseEther, parseUnits } from "ethers/lib/utils";
import fs from "fs/promises";
import { ethers, network } from "hardhat";
import path from "path";
import { format } from "prettier";
import { UserOperation } from "./Objects/userOperation";
import { AddressZero, FIVE_ETH, MaxUint256, ONE_ETH, paymasterStake, TWO_ETH, unstakeDelaySec } from "./test/constants";
import { createWallet, deployWallet, signUserOp } from "./test/utils";
import {
  DepositPaymaster,
  DepositPaymaster__factory,
  EntryPoint,
  EntryPoint__factory,
  MaskToken,
  MaskToken__factory,
  SimpleWalletUpgradeable,
  SingletonFactory,
  SingletonFactory__factory,
  TESTNFT,
  TESTNFT__factory,
} from "./types";

type GasResult = {
  TransferEther: string;
  Approve: string;
  ERC20Transfer: string;
  ERC721Mint: string;
};

const README_PATH = path.resolve(__dirname, "DOC", "GasReport.md");
let chainId = network.config.chainId!;
let sponsor: Signer;
let faucet: Signer;
let ethersSigner: Signer;
let walletFactory: SingletonFactory;
let maskToken: MaskToken;
let testNft: TESTNFT;
let testWallet: Wallet;
let walletOwner: Wallet;
let entryPoint: EntryPoint;
let paymaster: DepositPaymaster;
let contractWallet: SimpleWalletUpgradeable;

async function main() {
  const content = await fs.readFile(README_PATH, "utf-8");
  await setUp();
  const eoaGasResult = await getEOAGasResult();
  const scWalletGasResult = await get4337WalletGasResultWithoutEP();
  const scWalletGasResultWithEP = await get4337WalletGasResultWithEP();
  const replaced = replace(
    content,
    Array.from(makeTable(eoaGasResult, scWalletGasResult, scWalletGasResultWithEP)).filter(Boolean).join("\n"),
    "Wallet",
  );
  const formatted = format(replaced, {
    parser: "markdown",
    printWidth: 160,
  });

  await fs.writeFile(README_PATH, formatted, "utf-8");
}

main();

function* makeTable(eoaGasResult: GasResult, scWalletGasResult: GasResult, scWalletGasResultWithEP: GasResult) {
  yield "|  | EOA Wallet | 4337 Wallet without EP | 4337 Wallet with EP |";
  yield "| - | :-: | :-: | :-: |";
  yield `| Transfer ETH | ${eoaGasResult.TransferEther}| ${scWalletGasResult.TransferEther} | ${scWalletGasResultWithEP.TransferEther} |`;
  yield `| Approve ERC20 | ${eoaGasResult.Approve}| ${scWalletGasResult.Approve} | ${scWalletGasResultWithEP.Approve} |`;
  yield `| Transfer ERC20 | ${eoaGasResult.ERC20Transfer}| ${scWalletGasResult.ERC20Transfer} | ${scWalletGasResultWithEP.ERC20Transfer} |`;
  yield `| Mint ERC721 | ${eoaGasResult.ERC721Mint}| ${scWalletGasResult.ERC721Mint} | ${scWalletGasResultWithEP.ERC721Mint} |`;
}

function replace(content: string, replace: string, section: string) {
  const pattern = new RegExp(`(<!-- begin ${section} -->)(.+)(<!-- end ${section} -->)`, "gs");
  return content.replace(pattern, `$1\n${replace}\n$3`);
}

async function getEOAGasResult(): Promise<GasResult> {
  const transferEthTx = await ethersSigner.sendTransaction({
    to: testWallet.address,
    value: TWO_ETH,
  });
  const transferEthReceipt = await ethers.provider.getTransactionReceipt(transferEthTx.hash);
  const approveTx = await maskToken.connect(ethersSigner).approve(testWallet.address, 1);
  const approveReceipt = await ethers.provider.getTransactionReceipt(approveTx.hash);
  const transferTx = await maskToken.connect(ethersSigner).transfer(testWallet.address, 1);
  const transferReceipt = await ethers.provider.getTransactionReceipt(transferTx.hash);
  const mintTx = await testNft.connect(ethersSigner).mint(createWallet().address);
  const mintReceipt = await ethers.provider.getTransactionReceipt(mintTx.hash);
  return {
    TransferEther: transferEthReceipt.gasUsed.toString(),
    Approve: approveReceipt.gasUsed.toString(),
    ERC20Transfer: transferReceipt.gasUsed.toString(),
    ERC721Mint: mintReceipt.gasUsed.toString(),
  };
}

async function get4337WalletGasResultWithoutEP(): Promise<GasResult> {
  await faucet.sendTransaction({
    to: walletOwner.address,
    value: ONE_ETH,
  });
  const transferEthTx = await contractWallet.connect(walletOwner).transfer(createWallet().address, ONE_ETH);
  const transferEthReceipt = await ethers.provider.getTransactionReceipt(transferEthTx.hash);

  const execApprove = maskToken.interface.encodeFunctionData("approve", [createWallet().address, ONE_ETH]);
  const approveTx = await contractWallet.connect(walletOwner).exec(maskToken.address, 0, execApprove);
  const approveReceipt = await ethers.provider.getTransactionReceipt(approveTx.hash);

  const execTransfer = maskToken.interface.encodeFunctionData("transfer", [createWallet().address, 1]);
  const transfer20Tx = await contractWallet.connect(walletOwner).exec(maskToken.address, 0, execTransfer);
  const transfer20Receipt = await ethers.provider.getTransactionReceipt(transfer20Tx.hash);

  const execMint = testNft.interface.encodeFunctionData("mint", [createWallet().address]);
  const mintTx = await contractWallet.connect(walletOwner).exec(testNft.address, 0, execMint);
  const mintReceipt = await ethers.provider.getTransactionReceipt(mintTx.hash);

  return {
    TransferEther: transferEthReceipt.gasUsed.toString(),
    Approve: approveReceipt.gasUsed.toString(),
    ERC20Transfer: transfer20Receipt.gasUsed.toString(),
    ERC721Mint: mintReceipt.gasUsed.toString(),
  };
}

async function get4337WalletGasResultWithEP(): Promise<GasResult> {
  const beneficiaryAddress = await sponsor.getAddress();

  //#region transferEth via EntryPoint
  let transferEthUserOp = createDefaultUserOp(contractWallet.address);
  transferEthUserOp.nonce = await contractWallet.nonce();
  transferEthUserOp.callData = contractWallet.interface.encodeFunctionData("execFromEntryPoint", [
    createWallet().address,
    ONE_ETH,
    "0x",
  ]);
  await transferEthUserOp.estimateGas(ethers.provider, entryPoint.address);
  transferEthUserOp.signature = signUserOp(transferEthUserOp, entryPoint.address, chainId, walletOwner.privateKey);
  const transferEthTx = await entryPoint.connect(sponsor).handleOps([transferEthUserOp], beneficiaryAddress);
  const transferEthReceipt = await ethers.provider.getTransactionReceipt(transferEthTx.hash);
  //#endregion

  //#region approve ERC20 via EntryPoint
  let approveUserOp = createDefaultUserOp(contractWallet.address);
  approveUserOp.nonce = await contractWallet.nonce();
  const execApprove = maskToken.interface.encodeFunctionData("approve", [createWallet().address, MaxUint256]);
  approveUserOp.callData = contractWallet.interface.encodeFunctionData("execFromEntryPoint", [
    maskToken.address,
    0,
    execApprove,
  ]);
  await approveUserOp.estimateGas(ethers.provider, entryPoint.address);
  approveUserOp.signature = signUserOp(approveUserOp, entryPoint.address, chainId, walletOwner.privateKey);
  const approveTx = await entryPoint.connect(sponsor).handleOps([approveUserOp], beneficiaryAddress);
  const approveReceipt = await ethers.provider.getTransactionReceipt(approveTx.hash);
  //#endregion

  //#region transfer ERC20 via EntryPoint
  let transfer20UserOp = createDefaultUserOp(contractWallet.address);
  transfer20UserOp.nonce = await contractWallet.nonce();
  const execTransfer = maskToken.interface.encodeFunctionData("transfer", [createWallet().address, ONE_ETH]);
  transfer20UserOp.callData = contractWallet.interface.encodeFunctionData("execFromEntryPoint", [
    maskToken.address,
    0,
    execTransfer,
  ]);
  await transfer20UserOp.estimateGas(ethers.provider, entryPoint.address);
  transfer20UserOp.signature = signUserOp(transfer20UserOp, entryPoint.address, chainId, walletOwner.privateKey);
  const transfer20Tx = await entryPoint.connect(sponsor).handleOps([transfer20UserOp], beneficiaryAddress);
  const transfer20Receipt = await ethers.provider.getTransactionReceipt(transfer20Tx.hash);
  //#endregion

  //#region mint ERC721 via EntryPoint
  let mintUserOp = createDefaultUserOp(contractWallet.address);
  mintUserOp.nonce = await contractWallet.nonce();
  const execMint = testNft.interface.encodeFunctionData("mint", [createWallet().address]);
  mintUserOp.callData = contractWallet.interface.encodeFunctionData("execFromEntryPoint", [
    testNft.address,
    0,
    execMint,
  ]);
  await mintUserOp.estimateGas(ethers.provider, entryPoint.address);
  mintUserOp.signature = signUserOp(mintUserOp, entryPoint.address, chainId, walletOwner.privateKey);
  const mintTx = await entryPoint.connect(sponsor).handleOps([mintUserOp], beneficiaryAddress);
  const mintReceipt = await ethers.provider.getTransactionReceipt(mintTx.hash);
  //#endregion
  return {
    TransferEther: transferEthReceipt.gasUsed.toString(),
    Approve: approveReceipt.gasUsed.toString(),
    ERC20Transfer: transfer20Receipt.gasUsed.toString(),
    ERC721Mint: mintReceipt.gasUsed.toString(),
  };
}

async function setUp() {
  const signers = await ethers.getSigners();
  ethersSigner = signers[0];
  sponsor = signers[1];
  faucet = signers[2];
  maskToken = await new MaskToken__factory(ethersSigner).deploy();
  testNft = await new TESTNFT__factory(ethersSigner).deploy();
  testWallet = createWallet();
  walletOwner = createWallet();
  walletFactory = await new SingletonFactory__factory(ethersSigner).deploy();
  entryPoint = await new EntryPoint__factory(ethersSigner).deploy(
    walletFactory.address,
    paymasterStake,
    unstakeDelaySec,
  );

  paymaster = await new DepositPaymaster__factory(ethersSigner).deploy(entryPoint.address, maskToken.address);
  await paymaster.addStake(0, { value: parseEther("2") });
  await entryPoint.depositTo(paymaster.address, { value: parseEther("1") });
  await maskToken.connect(ethersSigner).approve(paymaster.address, ethers.constants.MaxUint256);

  contractWallet = await deployWallet(entryPoint.address, walletOwner.address);

  await paymaster.addDepositFor(contractWallet.address, FIVE_ETH);

  await maskToken.connect(ethersSigner).transfer(contractWallet.address, FIVE_ETH);
  await paymaster.setMaskToEthRadio(2000);

  await ethersSigner.sendTransaction({
    to: contractWallet.address,
    value: FIVE_ETH,
  });
}

function createDefaultUserOp(sender: string): UserOperation {
  let userOp = new UserOperation();
  userOp.sender = sender;
  userOp.maxFeePerGas = parseUnits("1", "gwei");
  userOp.maxPriorityFeePerGas = parseUnits("1", "gwei");
  userOp.paymaster = AddressZero;
  return userOp;
}
