//SPDX-License-Identifier: MIT

import "./BasePaymaster.sol";
import "./lib/UserOperation.sol";
import "./interfaces/IWallet.sol";

contract NativeTokenPaymaster is BasePaymaster {
    using UserOperationLib for UserOperation;

    //calculated cost of the postOp TODO: get the correct cost;
    uint256 public constant COST_OF_POST = 35000;

    mapping(address => uint256) public credits;
    mapping(address => bool) public isAdmin;

    modifier onlyAdmin() {
        require(isAdmin[msg.sender] == true, "Paymaster: you are not admin");
        _;
    }

    constructor(EntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    /**
     * deposit for an account. The deposit is actually the credit we give to users
     * @param account the account to deposit for.
     * @param amount the amount of token to deposit.
     */
    function addDepositFor(address account, uint256 amount) external onlyAdmin {
        credits[account] += amount;
    }

    function adjustAdmin(address account, bool admin) external onlyOwner {
        isAdmin[account] = admin;
    }

    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 requestId,
        uint256 maxCost
    ) external view override returns (bytes memory context) {
        (requestId);

        require(userOp.verificationGas > COST_OF_POST, "DepositPaymaster: gas too low for postOp");
        address sender = userOp.getSender();
        uint256 accountBalance = sender.balance;
        require(IWallet(sender)._paymaster() == address(this), "Paymaster: not registered in sender account");
        require(accountBalance >= maxCost, "Paymaster: no enough native token");
        require(credits[sender] >= maxCost, "Paymaster: deposit too low");
        return abi.encode(sender, maxCost);
    }

    /**
     * withdraw native token
     *
     * @param target token recipient
     * @param amount amount to withdraw
     */
    function withdraw(address payable target, uint256 amount) public onlyOwner {
        if (amount >= address(this).balance) amount = address(this).balance;
        target.transfer(amount);
    }

    /**
     * perform the post-operation to charge the sender for the gas
     * in normal mode, call the transfer function in wallet to charge the gas fee
     * in case the transfer function fails, the _postOp reverts and the entryPoint will call it again,
     * this time in *postOpReverted* mode.
     * In this mode, we use the deposit to pay (which we validated to be large enough)
     */
    function _postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost) internal override {
        (address account, uint256 maxCost) = abi.decode(context, (address, uint256));
        uint256 actualTotalCost = actualGasCost + COST_OF_POST;
        if (mode != PostOpMode.postOpReverted) {
            IWallet(account).transfer(payable(address(this)), actualTotalCost);
        } else {
            //in case above transfer failed, pay with deposit
            credits[account] -= actualTotalCost;
        }
    }

    receive() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }
}
