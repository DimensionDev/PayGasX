// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UseAllMask {
    using SafeERC20 for IERC20;

    IERC20 public maskToken;

    constructor(IERC20 _maskToken) {
        maskToken = _maskToken;
    }

    function useAllMask() external {
        uint256 balance = maskToken.balanceOf(msg.sender);
        maskToken.safeTransferFrom(msg.sender, address(this), balance);
    }
}
