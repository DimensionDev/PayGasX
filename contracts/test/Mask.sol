// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MaskToken is ERC20 {
    constructor()
        // solhint-disable-next-line no-empty-blocks
        ERC20("Mask Network", "MASK")
    {}

    function mint(address sender, uint256 amount) external {
        _mint(sender, amount);
    }
}
