import { Contract, Signer, Wallet } from "ethers";
import { arrayify, hexlify, hexZeroPad, parseEther, parseUnits } from "ethers/lib/utils";
import fs from "fs/promises";
import { ethers, network } from "hardhat";
import path from "path";
import { format } from "prettier";
import {
  AddressZero,
  creationParams,
  FIVE_ETH,
  MaxUint256,
  ONE_ETH,
  paymasterStake,
  testPrivateKey,
  TWO_ETH,
  unstakeDelaySec,
} from "./test/constants";
import { UserOperation } from "./test/entity/userOperation";
import { createWallet, getProxyWalletInfo, signUserOp } from "./test/utils";
import {
  DepositPaymaster,
  DepositPaymaster__factory,
  EntryPoint,
  EntryPoint__factory,
  HappyRedPacket,
  HappyRedPacket__factory,
  MaskToken,
  MaskToken__factory,
  SimpleWalletUpgradeable,
  SimpleWalletUpgradeable__factory,
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

type RPGasResult = {
  createRP: string;
  claimRP: string;
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
let walletImp: SimpleWalletUpgradeable;
let redPacket: HappyRedPacket;

async function main() {
  const content = await fs.readFile(README_PATH, "utf-8");
  await setUp();
  const eoaGasResult = await getEOAGasResult();
  const scWalletGasResult = await get4337WalletGasResultWithoutEP();
  const scWalletGasResultWithEP = await get4337WalletGasResultWithEP();
  const scWalletGasWithEPDeployment = await get4337GasWithEPDeployment();
  const scWalletRPResultWithPaymaster = await getRedpacket4337GasWithPaymaster();
  const eoaRPResult = await getRPEoaResult();
  let replaced = replace(
    content,
    Array.from(makeTable(eoaGasResult, scWalletGasResult, scWalletGasResultWithEP, scWalletGasWithEPDeployment))
      .filter(Boolean)
      .join("\n"),
    "Wallet",
  );
  replaced = replace(
    replaced,
    Array.from(makeRPTable(eoaRPResult, scWalletRPResultWithPaymaster)).filter(Boolean).join("\n"),
    "Paymaster",
  );
  const formatted = format(replaced, {
    parser: "markdown",
    printWidth: 160,
  });

  await fs.writeFile(README_PATH, formatted, "utf-8");
}

main();

function* makeTable(
  eoaGasResult: GasResult,
  scWalletGasResult: GasResult,
  scWalletGasResultWithEP: GasResult,
  scWalletGasWithEPDeployment: GasResult,
) {
  yield "|  | EOA Wallet | 4337 Wallet without EP | 4337 Wallet with EP | 4337 Wallet with EP Deploy Wallet* |";
  yield "| - | :-: | :-: | :-: | :-: |";
  yield `| Transfer ETH | ${eoaGasResult.TransferEther}| ${scWalletGasResult.TransferEther} | ${scWalletGasResultWithEP.TransferEther} | ${scWalletGasWithEPDeployment.TransferEther} |`;
  yield `| Approve ERC20 | ${eoaGasResult.Approve}| ${scWalletGasResult.Approve} | ${scWalletGasResultWithEP.Approve} | ${scWalletGasWithEPDeployment.Approve} |`;
  yield `| Transfer ERC20 | ${eoaGasResult.ERC20Transfer}| ${scWalletGasResult.ERC20Transfer} | ${scWalletGasResultWithEP.ERC20Transfer} | ${scWalletGasWithEPDeployment.ERC20Transfer} |`;
  yield `| Mint ERC721 | ${eoaGasResult.ERC721Mint}| ${scWalletGasResult.ERC721Mint} | ${scWalletGasResultWithEP.ERC721Mint} | ${scWalletGasWithEPDeployment.ERC721Mint} |`;
}

function* makeRPTable(eoaGasResult: RPGasResult, scWalletGasResultWithPaymaster: RPGasResult) {
  yield "|  | EOA Wallet | 4337 Wallet with Paymaster |";
  yield "| - | :-: | :-: |";
  yield `| create | ${eoaGasResult.createRP}| ${scWalletGasResultWithPaymaster.createRP} |`;
  yield `| claim | ${eoaGasResult.claimRP}| ${scWalletGasResultWithPaymaster.claimRP} |`;
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
  const mintTx = await testNft.connect(ethersSigner).mint(createWallet().address, 1);
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

  const execApprove = maskToken.interface.encodeFunctionData("approve", [redPacket.address, MaxUint256]);
  const approveTx = await contractWallet.connect(walletOwner).exec(maskToken.address, 0, execApprove);
  const approveReceipt = await ethers.provider.getTransactionReceipt(approveTx.hash);

  const execTransfer = maskToken.interface.encodeFunctionData("transfer", [createWallet().address, 1]);
  const transfer20Tx = await contractWallet.connect(walletOwner).exec(maskToken.address, 0, execTransfer);
  const transfer20Receipt = await ethers.provider.getTransactionReceipt(transfer20Tx.hash);

  const execMint = testNft.interface.encodeFunctionData("mint", [createWallet().address, 2]);
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
  const execApprove = maskToken.interface.encodeFunctionData("approve", [paymaster.address, MaxUint256]);
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
  const execMint = testNft.interface.encodeFunctionData("mint", [createWallet().address, 3]);
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
async function get4337GasWithEPDeployment(): Promise<GasResult> {
  const beneficiaryAddress = await sponsor.getAddress();
  let createWalletSalt = 0;

  //#region transferEth via EntryPoint
  const initializeData = walletImp.interface.encodeFunctionData("initialize", [
    entryPoint.address,
    walletOwner.address,
    AddressZero,
    AddressZero,
    0,
  ]);
  // WalletProxy constructor
  const proxyWalletInfo = await getProxyWalletInfo(
    createWalletSalt,
    walletImp.address,
    initializeData,
    walletOwner.address,
    walletFactory.address,
  );
  sponsor.sendTransaction({
    to: proxyWalletInfo.address,
    value: ONE_ETH,
  });
  await entryPoint.connect(sponsor).depositTo(proxyWalletInfo.address, { value: ONE_ETH });
  let transferEthUserOp = createDefaultUserOp(proxyWalletInfo.address);
  transferEthUserOp.nonce = createWalletSalt;
  transferEthUserOp.initCode = proxyWalletInfo.initCode;
  transferEthUserOp.callData = walletImp.interface.encodeFunctionData("execFromEntryPoint", [
    createWallet().address,
    ONE_ETH,
    "0x",
  ]);
  await transferEthUserOp.estimateGas(ethers.provider, entryPoint.address);
  transferEthUserOp.signature = signUserOp(transferEthUserOp, entryPoint.address, chainId, walletOwner.privateKey);
  const transferEthTx = await entryPoint.connect(sponsor).handleOps([transferEthUserOp], beneficiaryAddress);
  const transferEthReceipt = await ethers.provider.getTransactionReceipt(transferEthTx.hash);
  createWalletSalt++;
  //#endregion

  //#region approve ERC20 via EntryPoint
  const proxyWalletInfo1 = await getProxyWalletInfo(
    createWalletSalt,
    walletImp.address,
    initializeData,
    walletOwner.address,
    walletFactory.address,
  );
  await entryPoint.connect(sponsor).depositTo(proxyWalletInfo1.address, { value: ONE_ETH });
  let approveUserOp = createDefaultUserOp(proxyWalletInfo1.address);
  approveUserOp.nonce = createWalletSalt;
  approveUserOp.initCode = proxyWalletInfo1.initCode;
  const execApprove = maskToken.interface.encodeFunctionData("approve", [paymaster.address, MaxUint256]);
  approveUserOp.callData = walletImp.interface.encodeFunctionData("execFromEntryPoint", [
    maskToken.address,
    0,
    execApprove,
  ]);
  await approveUserOp.estimateGas(ethers.provider, entryPoint.address);
  approveUserOp.signature = signUserOp(approveUserOp, entryPoint.address, chainId, walletOwner.privateKey);
  const approveTx = await entryPoint.connect(sponsor).handleOps([approveUserOp], beneficiaryAddress);
  const approveReceipt = await ethers.provider.getTransactionReceipt(approveTx.hash);
  createWalletSalt++;
  //#endregion

  //#region transfer ERC20 via EntryPoint
  const proxyWalletInfo2 = await getProxyWalletInfo(
    createWalletSalt,
    walletImp.address,
    initializeData,
    walletOwner.address,
    walletFactory.address,
  );
  await entryPoint.connect(sponsor).depositTo(proxyWalletInfo2.address, { value: ONE_ETH });
  await maskToken.connect(ethersSigner).transfer(proxyWalletInfo2.address, TWO_ETH);
  let transfer20UserOp = createDefaultUserOp(proxyWalletInfo2.address);
  transfer20UserOp.nonce = createWalletSalt;
  transfer20UserOp.initCode = proxyWalletInfo2.initCode;
  const execTransfer = maskToken.interface.encodeFunctionData("transfer", [createWallet().address, ONE_ETH]);
  transfer20UserOp.callData = walletImp.interface.encodeFunctionData("execFromEntryPoint", [
    maskToken.address,
    0,
    execTransfer,
  ]);
  await transfer20UserOp.estimateGas(ethers.provider, entryPoint.address);
  transfer20UserOp.signature = signUserOp(transfer20UserOp, entryPoint.address, chainId, walletOwner.privateKey);
  const transfer20Tx = await entryPoint.connect(sponsor).handleOps([transfer20UserOp], beneficiaryAddress);
  const transfer20Receipt = await ethers.provider.getTransactionReceipt(transfer20Tx.hash);
  createWalletSalt++;
  //#endregion

  //#region mint ERC721 via EntryPoint
  const proxyWalletInfo3 = await getProxyWalletInfo(
    createWalletSalt,
    walletImp.address,
    initializeData,
    walletOwner.address,
    walletFactory.address,
  );
  await entryPoint.connect(sponsor).depositTo(proxyWalletInfo3.address, { value: ONE_ETH });
  let mintUserOp = createDefaultUserOp(proxyWalletInfo3.address);
  mintUserOp.nonce = createWalletSalt;
  mintUserOp.initCode = proxyWalletInfo3.initCode;
  const execMint = testNft.interface.encodeFunctionData("mint", [createWallet().address, 3]);
  mintUserOp.callData = walletImp.interface.encodeFunctionData("execFromEntryPoint", [testNft.address, 0, execMint]);
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

  walletImp = await new SimpleWalletUpgradeable__factory(ethersSigner).deploy();
  const initializeData = walletImp.interface.encodeFunctionData("initialize", [
    entryPoint.address,
    walletOwner.address,
    maskToken.address,
    paymaster.address,
    MaxUint256,
  ]);
  // WalletProxy constructor
  const proxyWalletInfo = await getProxyWalletInfo(
    0,
    walletImp.address,
    initializeData,
    walletOwner.address,
    walletFactory.address,
  );

  await walletFactory.deploy(proxyWalletInfo.initCode, hexZeroPad(hexlify(0), 32));
  contractWallet = new Contract(
    proxyWalletInfo.address,
    walletImp.interface,
    ethers.provider,
  ) as SimpleWalletUpgradeable;

  await paymaster.addStake(0, { value: parseEther("2") });
  await entryPoint.depositTo(paymaster.address, { value: parseEther("1") });
  await maskToken.connect(ethersSigner).approve(paymaster.address, ethers.constants.MaxUint256);

  await paymaster.connect(ethersSigner).adjustAdmin(await ethersSigner.getAddress(), true);
  await paymaster.connect(ethersSigner).addDepositFor(contractWallet.address, FIVE_ETH);

  await maskToken.connect(ethersSigner).transfer(contractWallet.address, FIVE_ETH);
  await paymaster.setMaskToMaticRatio([1, 4]);

  await ethersSigner.sendTransaction({
    to: contractWallet.address,
    value: FIVE_ETH,
  });

  redPacket = await new HappyRedPacket__factory(ethersSigner).deploy();
}

async function getRedpacket4337GasWithPaymaster(): Promise<RPGasResult> {
  const beneficiaryAddress = await sponsor.getAddress();
  await paymaster.addDepositFor(contractWallet.address, ONE_ETH);
  //#region create Redpacket user operation
  let createRpUserOp = createDefaultUserOp(contractWallet.address);
  createRpUserOp.paymaster = paymaster.address;
  createRpUserOp.paymasterData = hexZeroPad(maskToken.address, 32);
  createRpUserOp.nonce = await contractWallet.nonce();

  const createRpData = redPacket.interface.encodeFunctionData("create_red_packet", [
    creationParams.publicKey,
    creationParams.number,
    creationParams.ifrandom,
    creationParams.duration,
    creationParams.seed,
    creationParams.message,
    creationParams.name,
    1,
    maskToken.address,
    creationParams.totalTokens,
  ]);

  createRpUserOp.callData = contractWallet.interface.encodeFunctionData("execFromEntryPoint", [
    redPacket.address,
    0,
    createRpData,
  ]);
  await createRpUserOp.estimateGas(ethers.provider, entryPoint.address);

  createRpUserOp.signature = signUserOp(createRpUserOp, entryPoint.address, chainId, walletOwner.privateKey);
  const createRpTx = await entryPoint.connect(sponsor).handleOps([createRpUserOp], beneficiaryAddress);
  const createRPReceipt = await ethers.provider.getTransactionReceipt(createRpTx.hash);
  const createSuccess = (await redPacket.queryFilter(redPacket.filters.CreationSuccess()))[0];
  if (!createSuccess) throw Error("Create redpacket fail");
  const pktId = createSuccess?.args.id;
  //#endregion

  //#region claim
  let claimRpUserOp = createDefaultUserOp(contractWallet.address);
  claimRpUserOp.paymaster = paymaster.address;
  claimRpUserOp.paymasterData = hexZeroPad(maskToken.address, 32);
  claimRpUserOp.nonce = await contractWallet.nonce();

  const testWallet = new Wallet(testPrivateKey);
  const claimSignedMsg = await testWallet.signMessage(arrayify(contractWallet.address));

  const claimRpData = redPacket.interface.encodeFunctionData("claim", [pktId, claimSignedMsg, contractWallet.address]);

  claimRpUserOp.callData = contractWallet.interface.encodeFunctionData("execFromEntryPoint", [
    redPacket.address,
    0,
    claimRpData,
  ]);
  await claimRpUserOp.estimateGas(ethers.provider, entryPoint.address);

  claimRpUserOp.signature = signUserOp(claimRpUserOp, entryPoint.address, chainId, walletOwner.privateKey);
  const claimRpTx = await entryPoint.connect(sponsor).handleOps([claimRpUserOp], beneficiaryAddress);
  const claimRPReceipt = await ethers.provider.getTransactionReceipt(claimRpTx.hash);
  //#endregion

  return {
    createRP: createRPReceipt.gasUsed.toString(),
    claimRP: claimRPReceipt.gasUsed.toString(),
  };
}

async function getRPEoaResult(): Promise<RPGasResult> {
  const beneficiaryAddress = await sponsor.getAddress();
  await maskToken.connect(ethersSigner).transfer(beneficiaryAddress, FIVE_ETH);
  const createRPParam = {
    ...creationParams,
    tokenType: 1,
    tokenAddr: maskToken.address,
  };
  await maskToken.connect(sponsor).approve(redPacket.address, MaxUint256);
  const createRpTx = await redPacket.connect(sponsor).create_red_packet.apply(null, Object.values(createRPParam));
  const createRpReceipt = await ethers.provider.getTransactionReceipt(createRpTx.hash);
  const createSuccess = (await redPacket.queryFilter(redPacket.filters.CreationSuccess()))[0];
  if (!createSuccess) throw Error("Create redpacket fail");
  const pktId = createSuccess?.args.id;

  const testWallet = new Wallet(testPrivateKey);
  const claimSignedMsg = await testWallet.signMessage(arrayify(beneficiaryAddress));
  const claimParam = {
    id: pktId,
    signedMsg: claimSignedMsg,
    recipient: beneficiaryAddress,
  };
  const claimRpTx = await redPacket.connect(sponsor).claim.apply(null, Object.values(claimParam));
  const claimRpReceipt = await ethers.provider.getTransactionReceipt(claimRpTx.hash);
  return {
    createRP: createRpReceipt.gasUsed.toString(),
    claimRP: claimRpReceipt.gasUsed.toString(),
  };
}

function createDefaultUserOp(sender: string): UserOperation {
  let userOp = new UserOperation();
  userOp.sender = sender;
  userOp.maxFeePerGas = parseUnits("1", "gwei");
  userOp.maxPriorityFeePerGas = parseUnits("1", "gwei");
  userOp.paymaster = AddressZero;
  return userOp;
}
