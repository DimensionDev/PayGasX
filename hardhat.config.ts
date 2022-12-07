import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@typechain/hardhat";
import "hardhat-abi-exporter";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import "hardhat-gas-reporter";
import { HardhatUserConfig } from "hardhat/config";
import "solidity-coverage";
import {
  EtherscanConfig,
  getHardhatNetworkConfig,
  HardhatGasReporterConfig,
  HardhatSolidityConfig,
} from "./SmartContractProjectConfig/config";

const networks = getHardhatNetworkConfig();
let solidity = HardhatSolidityConfig;
solidity.version = "0.8.12";
const gasReporter = HardhatGasReporterConfig;
const etherscan = EtherscanConfig;

const config: HardhatUserConfig = {
  networks,
  mocha: {
    timeout: 500000,
  },
  solidity,
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  etherscan,
  gasReporter,
  typechain: {
    outDir: "types",
    target: "ethers-v5",
    alwaysGenerateOverloads: false,
  },
};

export default config;
