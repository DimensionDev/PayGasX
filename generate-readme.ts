import { parse } from "csv-parse/sync";
import fs from "fs/promises";
import path from "path";
import { format } from "prettier";
import { getAllBrowserPath } from "./SmartContractProjectConfig/chains";

const README_PATH = path.resolve(__dirname, "README.md");
const ADDRESS_TABLE_PATH = path.resolve(__dirname, "contract-addresses.csv");
let contractPath: Record<string, string>;
type DeployedAddressRow = {
  Chain: string;
  MaskToken: string;
  EntryPoint: string;
  DepositPaymaster: string;
  VerifyingPaymaster: string;
  WalletLogic: string;
  PresetFactory: string;
};

async function main() {
  const content = await fs.readFile(README_PATH, "utf-8");
  contractPath = await getAllBrowserPath("address");
  const rows: DeployedAddressRow[] = await loadDeployedAddressRows();
  const replaced = replace(content, Array.from(makeTable(rows)).filter(Boolean).join("\n"));
  const formatted = format(replaced, {
    parser: "markdown",
    printWidth: 160,
  });
  await fs.writeFile(README_PATH, formatted, "utf-8");
}

main();

function* makeTable(rows: DeployedAddressRow[]) {
  yield "| Chain | MaskToken | EntryPoint | DepositPaymaster | VerifyingPaymaster | WalletLogic | PresetFactory |";
  yield "| - | - | - | - | - | - | - |";
  for (const {
    Chain,
    MaskToken,
    EntryPoint,
    DepositPaymaster,
    VerifyingPaymaster,
    WalletLogic,
    PresetFactory,
  } of rows) {
    const mtElement = formElement(MaskToken, `mt-${Chain}`);
    const epElement = formElement(EntryPoint, `ep-${Chain}`);
    const dpmElement = formElement(DepositPaymaster, `dpm-${Chain}`);
    const vpmElement = formElement(VerifyingPaymaster, `vpm-${Chain}`);
    const wtElement = formElement(WalletLogic, `wl-${Chain}`);
    const pfElement = formElement(PresetFactory, `pf-${Chain}`);
    yield `| ${Chain} | ${mtElement} | ${epElement} | ${dpmElement} | ${vpmElement} | ${wtElement} | ${pfElement} |`;
  }
  yield "";
  yield* rows.map(({ Chain, MaskToken }) => formLink(MaskToken, Chain, "mt"));
  yield* rows.map(({ Chain, EntryPoint }) => formLink(EntryPoint, Chain, "ep"));
  yield* rows.map(({ Chain, DepositPaymaster }) => formLink(DepositPaymaster, Chain, "dpm"));
  yield* rows.map(({ Chain, VerifyingPaymaster }) => formLink(VerifyingPaymaster, Chain, "vpm"));
  yield* rows.map(({ Chain, WalletLogic }) => formLink(WalletLogic, Chain, "wl"));
  yield* rows.map(({ Chain, PresetFactory }) => formLink(PresetFactory, Chain, "pf"));
}

async function loadDeployedAddressRows(): Promise<DeployedAddressRow[]> {
  const data = await fs.readFile(ADDRESS_TABLE_PATH, "utf-8");
  const columns = [
    "Chain",
    "MaskToken",
    "EntryPoint",
    "DepositPaymaster",
    "VerifyingPaymaster",
    "WalletLogic",
    "PresetFactory",
  ];
  return parse(data, { delimiter: ",", columns, from: 2 });
}

function formElement(address: string, linkTag: string) {
  if (address == "") {
    return "";
  }
  return `[\`${address.slice(0, 10)}\`][${linkTag}]`;
}

function formLink(address: string, chain: string, contract: string) {
  if (address == "") {
    return null;
  }
  const browserPath = contractPath[chain] + address;
  return `[${contract}-${chain}]:${browserPath}`;
}

function replace(content: string, replace: string) {
  const pattern = new RegExp(`(<!-- begin PayGasX -->)(.+)(<!-- end PayGasX -->)`, "gs");
  return content.replace(pattern, `$1\n${replace}\n$3`);
}
