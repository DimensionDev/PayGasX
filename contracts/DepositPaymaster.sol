// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BasePaymaster.sol";
import "./lib/UserOperation.sol";
import "hardhat/console.sol";

/*
 * clone from https://github.com/eth-infinitism/account-abstraction/blob/develop/contracts/samples/DepositPaymaster.sol
 *
 * A token-based paymaster that accepts token deposit
 * The deposit is only a safeguard: the user pays with his token balance.
 * only if the user didn't approve() the paymaster, or if the token balance is not enough, the deposit will be used.
 * thus the required deposit is to cover just one method call.
 * The deposit is locked for the current block: the user must issue unlockTokenDeposit() to be allowed to withdraw
 *  (but can't use the deposit for this or further operations)
 *
 * base on that sample, use one specific ERC20 Token (MaskToken) instead of multi token support
 * remove the IOracle Part to avoid violating the rules of EIP4337
 */
contract DepositPaymaster is BasePaymaster {
    using UserOperationLib for UserOperation;
    using SafeERC20 for IERC20;

    //calculated cost of the postOp
    uint256 public constant COST_OF_POST = 35000;

    //paytoken to eth ratio
    uint256 public PAYTOKEN_TO_ETH_RATIO = 1500;

    IERC20 public payToken;

    mapping(address => uint256) public balances;
    mapping(address => uint256) public unlockBlock;

    /**
     * here, we choose $Mask as the paytoken
     */
    constructor(EntryPoint _entryPoint, address _payToken) BasePaymaster(_entryPoint) {
        //owner account is unblocked, to allow withdraw of paid tokens;
        //unlockTokenDeposit();
        payToken = IERC20(_payToken);
    }

    /**
     * deposit for an account
     * @param account the account to deposit for.
     * @param amount the amount of token to deposit.
     */
    function addDepositFor(address account, uint256 amount) external onlyOwner {
        //(sender must have approval for the paymaster)
        payToken.safeTransferFrom(msg.sender, address(this), amount);
        balances[account] += amount;
    }

    function depositInfo(address account) public view returns (uint256 amount, uint256 _unlockBlock) {
        amount = balances[account];
        _unlockBlock = unlockBlock[account];
    }

    /**
     * withdraw tokens.
     *
     * @param target address to send to
     * @param amount amount to withdraw
     */
    function withdrawTokensTo(address target, uint256 amount) public onlyOwner {
        balances[target] -= amount;
        payToken.safeTransfer(target, amount);
    }

    /**
     * translate the given eth value to token amount
     * @param ethBought the required eth value we want to "buy"
     * @return requiredTokens the amount of tokens required to get this amount of eth
     */
    function getTokenValueOfEth(uint256 ethBought) internal view virtual returns (uint256 requiredTokens) {
        return ethBought * PAYTOKEN_TO_ETH_RATIO;
    }

    function setMaskToEthRadio(uint256 radio) public onlyOwner {
        PAYTOKEN_TO_ETH_RATIO = radio;
    }

    /**
     * given the estimate gas cost, base on the UserOperation and specific token to eth ratio
     */
    function estimateCost(UserOperation calldata userOp) public view returns (uint256 amount) {
        return PAYTOKEN_TO_ETH_RATIO * userOp.requiredPreFund();
    }

    /**
     * Validate the request:
     * The sender should have enough deposit to pay the max possible cost.
     * Note that the sender's balance is not checked. If it fails to pay from its balance,
     * this deposit will be used to compensate the paymaster for the transaction.
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 requestId,
        uint256 maxCost
    ) external view override returns (bytes memory context) {
        (requestId);

        // verificationGas is dual-purposed, as gas limit for postOp. make sure it is high enough
        require(userOp.verificationGas > COST_OF_POST, "DepositPaymaster: gas too low for postOp");

        require(userOp.paymasterData.length == 32, "DepositPaymaster: paymasterData must specify token");
        address account = userOp.getSender();

        uint256 maxTokenCost = getTokenValueOfEth(maxCost);
        require(unlockBlock[account] == 0, "DepositPaymaster: deposit not locked");
        require(balances[account] >= maxTokenCost, "DepositPaymaster: deposit too low");
        return abi.encode(account, maxTokenCost, maxCost);
    }

    /**
     * perform the post-operation to charge the sender for the gas.
     * in normal mode, use transferFrom to withdraw enough tokens from the sender's balance.
     * in case the transferFrom fails, the _postOp reverts and the entryPoint will call it again,
     * this time in *postOpReverted* mode.
     * In this mode, we use the deposit to pay (which we validated to be large enough)
     */
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) internal override {
        (address account, uint256 maxTokenCost, uint256 maxCost) = abi.decode(context, (address, uint256, uint256));
        //use same conversion rate as used for validation.
        uint256 actualTokenCost = ((actualGasCost + COST_OF_POST) * maxTokenCost) / maxCost;

        if (mode != PostOpMode.postOpReverted) {
            // attempt to pay with tokens:
            payToken.safeTransferFrom(account, address(this), actualTokenCost);
        } else {
            //in case above transferFrom failed, pay with deposit:
            balances[account] -= actualTokenCost;
        }
        balances[owner()] += actualTokenCost;
    }
}
