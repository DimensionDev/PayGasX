// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.12;

import "./BaseWallet.sol";
import "./lib/ECDSA.sol";
import "./lib/UserOperation.sol";
import "./EntryPoint.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@gnosis.pm/safe-contracts/contracts/handler/DefaultCallbackHandler.sol";

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */
/**
 * minimal wallet.
 *  this is sample minimal wallet.
 *  has execute, eth handling methods
 *  has a single signer that can send requests through the entryPoint.
 */

contract SimpleWallet is BaseWallet, DefaultCallbackHandler {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    //explicit sizes of nonce, to fit a single storage cell with "owner"
    uint96 private _nonce;
    address public owner;
    address public nativeTokenPaymaster;

    function nonce() public view virtual override returns (uint256) {
        return _nonce;
    }

    function entryPoint() public view virtual override returns (EntryPoint) {
        return _entryPoint;
    }

    EntryPoint private _entryPoint;

    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    event PaymasterChanged(address indexed oldPaymaster, address indexed newPaymaster);

    event EntryPointChanged(address indexed oldEntryPoint, address indexed newEntryPoint);

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    constructor(
        EntryPoint _entryPointAddress,
        address _owner,
        address _gasToken,
        address _approveFor,
        uint256 _amount,
        address _nativeTokenPaymaster
    ) {
        _entryPoint = _entryPointAddress;
        owner = _owner;
        if (_gasToken != address(0)) IERC20(_gasToken).approve(_approveFor, _amount);
        nativeTokenPaymaster = _nativeTokenPaymaster;
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier onlyOwnerOrPaymaster() {
        require(
            msg.sender == owner || msg.sender == address(this) || msg.sender == nativeTokenPaymaster,
            "not owner or paymaster"
        );
        _;
    }

    function _onlyOwner() internal view {
        //directly from EOA owner, or through the entryPoint (which gets redirected through execFromEntryPoint)
        require(msg.sender == owner || msg.sender == address(this), "only owner");
    }

    /**
     * transfer the ownership to another address
     */
    function changeOwner(address newOwner) public onlyOwner {
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    /**
     * change the trusted paymaster address
     */
    function changePaymaster(address newPaymaster) public onlyOwner {
        emit PaymasterChanged(nativeTokenPaymaster, newPaymaster);
        nativeTokenPaymaster = newPaymaster;
    }

    /**
     * transfer eth value to a destination address
     */
    function transfer(address payable dest, uint256 amount) external onlyOwnerOrPaymaster {
        dest.transfer(amount);
    }

    /**
     * execute a transaction (called directly from owner, not by entryPoint)
     */
    function exec(address dest, uint256 value, bytes calldata func) external onlyOwner {
        _call(dest, value, func);
    }

    /**
     * execute a sequence of transaction
     */
    function execBatch(address[] calldata dest, bytes[] calldata func) external onlyOwner {
        require(dest.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }

    /**
     * change entry-point:
     * a wallet must have a method for replacing the entryPoint, in case the the entryPoint is
     * upgraded to a newer version.
     */
    function _updateEntryPoint(address newEntryPoint) internal override {
        emit EntryPointChanged(address(_entryPoint), newEntryPoint);
        _entryPoint = EntryPoint(payable(newEntryPoint));
    }

    function _requireFromAdmin() internal view override {
        _onlyOwner();
    }

    /**
     * validate the userOp is correct.
     * revert if it doesn't.
     * - must only be called from the entryPoint.
     * - make sure the signature is of our supported signer.
     * - validate current nonce matches request nonce, and increment it.
     * - pay prefund, in case current deposit is not enough
     */
    function _requireFromEntryPoint() internal view override {
        require(msg.sender == address(entryPoint()), "wallet: not from EntryPoint");
    }

    // called by entryPoint, only after validateUserOp succeeded.
    function execFromEntryPoint(address dest, uint256 value, bytes calldata func) external {
        _requireFromEntryPoint();
        _call(dest, value, func);
    }

    /// implement template method of BaseWallet
    function _validateAndUpdateNonce(UserOperation calldata userOp) internal override {
        require(_nonce++ == userOp.nonce, "wallet: invalid nonce");
    }

    /// implement template method of BaseWallet
    function _validateSignature(UserOperation calldata userOp, bytes32 requestId) internal view override {
        bytes32 hash = requestId.toEthSignedMessageHash();
        require(owner == hash.recover(userOp.signature), "wallet: wrong signature");
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * check current wallet deposit in the entryPoint
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    /**
     * deposit more funds for this wallet in the entryPoint
     */
    function addDeposit() public payable {
        (bool req, ) = address(entryPoint()).call{value: msg.value}("");
        require(req);
    }

    /**
     * withdraw value from the wallet's deposit
     * @param withdrawAddress target to send to
     * @param amount to withdraw
     */
    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) public onlyOwner {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }
}
