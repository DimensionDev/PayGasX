// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IDepositPaymaster.sol";

contract PresetFactory {
    using SafeERC20 for IERC20;

    uint96 public constant maskToGive = 6;
    address public paymaster;
    address public admin;
    //initial credit for a user is 5 $MASK
    uint96 public constant initialCredit = 6 ether;
    IERC20 public maskToken;

    mapping(address => bool) public isSetUp;

    modifier onlyAdmin() {
        require(msg.sender == admin, "PresetFactory: you are not admin");
        _;
    }

    constructor(
        address _paymaster,
        address _admin,
        IERC20 _mask
    ) {
        paymaster = _paymaster;
        admin = _admin;
        maskToken = _mask;
    }

    function setUpForAccount(address account) external onlyAdmin {
        isSetUp[account] = true;
        IERC20(maskToken).safeTransfer(account, maskToGive);
        IDepositPaymaster(paymaster).addDepositFor(account, initialCredit);
    }
}
