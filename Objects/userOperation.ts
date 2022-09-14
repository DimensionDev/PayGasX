import { BytesLike } from "@ethersproject/bytes";
import { BigNumber, BigNumberish, providers } from "ethers";

/**
 * @link https://github.com/eth-infinitism/account-abstraction/blob/develop/contracts/UserOperation.sol
 */
class UserOperation {
  /**
   * @param sender the sender account of this request
   */
  sender: string = "";
  /**
   * @param nonce unique value the sender uses to verify it is not a replay.
   */
  nonce: BigNumberish = 0;
  /**
   * @param initCode if set, the account contract will be created by this constructor
   */
  initCode: BytesLike = "0x";
  /**
   * @param callData the method call to execute on this account.
   */
  callData: BytesLike = "0x";
  /**
   * @param callGas gas used for validateUserOp and validatePaymasterUserOp
   */
  callGas: BigNumberish = 0;
  /**
   * @param verificationGas gas not calculated by the handleOps method, but added to the gas paid. Covers batch overhead.
   */
  verificationGas: BigNumberish = 0;
  /**
   * @param preVerificationGas gas not calculated by the handleOps method, but added to the gas paid. Covers batch overhead.
   */
  preVerificationGas: BigNumberish = 21000;
  /**
   * @param maxFeePerGas same as EIP-1559 gas parameter
   */
  maxFeePerGas: BigNumberish = 0;
  /**
   * @param maxPriorityFeePerGas same as EIP-1559 gas parameter
   */
  maxPriorityFeePerGas: BigNumberish = 0;
  /**
   * @param paymaster if set, the paymaster will pay for the transaction instead of the sender
   */
  paymaster: string = "0x";
  /**
   * @param paymasterData extra data used by the paymaster for validation
   */
  paymasterData: BytesLike = "0x";
  /**
   * @param signature sender-verified signature over the entire request, the EntryPoint address and the chain ID.
   */
  signature: BytesLike = "0x";

  /**
   * update verificationGas
   */
  private estimateVerificationGas() {
    //100000 default verification gas. will add create2 cost (3200+200*length) if initCode exists
    this.verificationGas = 100000;
    if (this.initCode.length > 0) {
      this.verificationGas += 3200 + 200 * this.initCode.length;
    }
  }

  /**
   * update callGas
   * @param web3 web3 instance
   * @param entryPointAddress entry point address
   */
  private async estimateCallGas(provider: providers.JsonRpcProvider, entryPointAddress: string) {
    const calldata: string = this.callData as string;
    const estimatedGas =
      (
        await provider.estimateGas({
          from: entryPointAddress,
          to: this.sender,
          data: calldata,
        })
      ).toNumber() * 1.5;
    this.callGas = BigNumber.from(Math.floor(estimatedGas));
  }

  /**
   * update Gas
   * @param web3 web3 instance
   * @param entryPointAddress entry point address
   */
  public async estimateGas(provider: providers.JsonRpcProvider, entryPointAddress: string) {
    this.estimateVerificationGas();
    await this.estimateCallGas(provider, entryPointAddress);
  }
}

export { UserOperation };
