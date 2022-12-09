// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IDepositPaymaster.sol";

contract PresetFactory {
    using SafeERC20 for IERC20;

    uint96 public immutable maskToGive;
    address public paymaster;
    address public admin;
    //initial credit for a user is 5 $MASK
    uint96 public immutable initialCredit;
    IERC20 public maskToken;

    mapping(address => bool) public isSetUp;

    modifier onlyAdmin() {
        require(msg.sender == admin, "PresetFactory: you are not admin");
        _;
    }

    constructor(address _paymaster, address _admin, IERC20 _mask, uint96 _maskToGive, uint96 _initialCredit) {
        paymaster = _paymaster;
        admin = _admin;
        maskToken = _mask;
        maskToGive = _maskToGive;
        initialCredit = _initialCredit;
    }

    function setUpForAccount(address account) external onlyAdmin {
        require(isSetUp[account] == false, "PresetFactory: This account is already set up");
        isSetUp[account] = true;
        IERC20(maskToken).safeTransfer(account, maskToGive);
        IDepositPaymaster(paymaster).addDepositFor(account, initialCredit);
    }

    function withdrawToken(address recipient) external onlyAdmin {
        uint256 tokenBalance = maskToken.balanceOf(address(this));
        maskToken.transfer(recipient, tokenBalance);
    }
}
