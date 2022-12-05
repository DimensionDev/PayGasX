// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BasePaymaster.sol";
import "./lib/UserOperation.sol";

/*
 * A token-based paymaster that accept one specific ERC20 token as payment.
 * We use a blacklist mechanism to act as a safeguard.
 * If the user passes the validation in pre-check stage, but fail to pay gas in `postOp()` for
    more than ${max_acceptable_times}, they will be blacklisted.
 *
 * In our demo, we use $MASK token as the only payment approach.
 * We also reserved a method to help deal with the ban by mistake.
 */

contract TokenPaymaster is BasePaymaster {
    using UserOperationLib for UserOperation;
    using SafeERC20 for IERC20;

    IERC20 public payToken;

    //calculated cost of the postOp
    uint48 public constant COST_OF_POST = 35000;

    //most acceptable times for suspicious operation
    uint48 public constant MAX_ACCEPTABLE_TIME = 3;

    //paytoken to eth ratio
    uint256 public PAYTOKEN_TO_ETH_RATIO = 1500;

    //max gas amount for one single userOperation
    uint256 public maxGasAmount = 1000000 gwei;

    mapping(address => uint256) public suspiciousCost;
    mapping(address => uint256) public suspiciousOps;

    constructor(EntryPoint _entryPoint, address _payToken) BasePaymaster(_entryPoint) {
        payToken = IERC20(_payToken);
    }

    /**
     * Correct the number of suspicious operations from one user.
     * @param account user address.
     * @param number the correct number of suspicious operation from this user.
     */
    function changeSuspiciousTime(address account, uint256 number) external onlyOwner {
        suspiciousOps[account] = number;
    }

    /**
     * Adjust max gas amount for single user operation.
     * @param amount the neew max gas amount.
     */
    function changeMaxGasAmount(uint256 amount) external onlyOwner {
        maxGasAmount = amount;
    }

    /**
     * Withdraw all mask token received.
     */

    function withdraw() external onlyOwner {
        uint256 balance = payToken.balanceOf(address(this));
        payToken.safeTransfer(owner(), balance);
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
     * The sender should:
        1. not be in the blacklist,
        2. give our paymaster enough erc20 token allowance,
        3. have enough erc20 balance.
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 requestId,
        uint256 maxCost
    ) external view override returns (bytes memory context) {
        (requestId);
        require(maxCost <= maxGasAmount, "TokenPaymaster: required gas amount too high");
        // verificationGas is dual-purposed, as gas limit for postOp. make sure it is high enough
        require(userOp.verificationGas > COST_OF_POST, "TokenPaymaster: gas too low for postOp");

        require(userOp.paymasterData.length == 32, "TokenPaymaster: paymasterData must specify token");
        address account = userOp.getSender();

        uint256 maxTokenCost = getTokenValueOfEth(maxCost);
        require(payToken.allowance(account, address(this)) >= maxTokenCost, "TokenPaymaster: insufficient allowance");
        require(payToken.balanceOf(account) >= maxTokenCost, "TokenPaymaster: do not have enough $MASK balance");
        return abi.encode(account, maxTokenCost, maxCost);
    }

    /**
     * perform the post-operation to charge the sender for the gas.
     * in normal mode, use transferFrom to withdraw enough tokens from the sender's balance.
     * in case the transferFrom fails, the _postOp reverts and the entryPoint will call it again,
     * this time in *postOpReverted* mode.
     * In this mode, our paymaster will help pay the fee and this op is regarded as one suspicious op.
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
            suspiciousOps[account] += 1;
            suspiciousCost[account] += actualTokenCost;
        }
    }
}
