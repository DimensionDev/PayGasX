// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

/* solhint-disable reason-string */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IDepositPaymaster.sol";

contract PresetFactory {
    using SafeERC20 for IERC20;

    uint96 public immutable maskToGive;
    address public depositPaymaster;
    address public nativeTokenPaymaster;
    address public admin;
    //initial credit for a user is 5 $MASK
    uint96 public immutable initialMaskCredit;
    uint96 public immutable initialNativeCredit;
    IERC20 public maskToken;

    mapping(address => bool) public isSetUp;

    modifier onlyAdmin() {
        require(msg.sender == admin, "PresetFactory: you are not admin");
        _;
    }

    constructor(
        address _depositPaymaster,
        address _nativeTokenPaymaster,
        address _admin,
        IERC20 _mask,
        uint96 _maskToGive,
        uint96 _initialMaskCredit,
        uint96 _initialNativeCredit
    ) {
        depositPaymaster = _depositPaymaster;
        nativeTokenPaymaster = _nativeTokenPaymaster;
        admin = _admin;
        maskToken = _mask;
        maskToGive = _maskToGive;
        initialMaskCredit = _initialMaskCredit;
        initialNativeCredit = _initialNativeCredit;
    }

    function setUpForAccount(address account) external onlyAdmin {
        require(isSetUp[account] == false, "PresetFactory: This account is already set up");
        isSetUp[account] = true;
        IERC20(maskToken).safeTransfer(account, maskToGive);
        IDepositPaymaster(depositPaymaster).addDepositFor(account, initialMaskCredit);
        IDepositPaymaster(nativeTokenPaymaster).addDepositFor(account, initialNativeCredit);
    }

    function withdrawToken(address recipient) external onlyAdmin {
        uint256 tokenBalance = maskToken.balanceOf(address(this));
        maskToken.transfer(recipient, tokenBalance);
    }
}
