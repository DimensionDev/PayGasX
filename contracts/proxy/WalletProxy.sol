// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.12;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract WalletProxy is ERC1967Proxy {
    modifier onlyOwner() {
        require(msg.sender == _getAdmin());
        _;
    }

    constructor(
        address _owner,
        address _logic,
        bytes memory _data
    ) payable ERC1967Proxy(_logic, _data) {
        _changeAdmin(_owner);
    }

    function upgradeToAndCall(
        address _newImplementation,
        bytes memory _data,
        bool _forceCall
    ) public onlyOwner {
        _upgradeToAndCall(_newImplementation, _data, _forceCall);
    }
}
