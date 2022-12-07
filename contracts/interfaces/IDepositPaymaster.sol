// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./IPaymaster.sol";

interface IDepositPaymaster is IPaymaster {
    /**
     * allow us to add deposit for specific user address
     * @param account the account to deposit for.
     * @param amount the amount of token to deposit.
     */
    function addDepositFor(address account, uint256 amount) external;
}
