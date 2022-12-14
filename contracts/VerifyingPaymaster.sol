// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.12;

import "./BasePaymaster.sol";
import "./lib/ECDSA.sol";
import "./lib/UserOperation.sol";
import "./EntryPoint.sol";

/* solhint-disable reason-string */
/**
 * A sample paymaster that uses external service to decide whether to pay for the UserOp.
 * The paymaster trusts an external signer to sign the transaction.
 * The calling user must pass the UserOp to that external signer first, which performs
 * whatever off-chain verification before signing the UserOp.
 * Note that this signature is NOT a replacement for wallet signature:
 * - the paymaster signs to agree to PAY for GAS.
 * - the wallet signs to prove identity and wallet ownership.
 */
contract VerifyingPaymaster is BasePaymaster {
    using ECDSA for bytes32;
    using UserOperationLib for UserOperation;

    address public immutable verifyingSigner;
    address public immutable token;
    address public mainPaymaster;
    bytes4 public constant APPROVE_FUNCTION_SELECTOR = bytes4(keccak256("approve(address,uint256)"));

    mapping(address => bool) public blockLists;

    constructor(
        EntryPoint _entryPoint,
        address _verifyingSigner,
        address _token,
        address _mainPaymaster
    ) BasePaymaster(_entryPoint) {
        verifyingSigner = _verifyingSigner;
        token = _token;
        mainPaymaster = _mainPaymaster;
    }

    modifier onlySelf() {
        require(msg.sender == address(this), "only paymaster itself could call this function");
        _;
    }

    /**
     * return the hash we're going to sign off-chain (and validate on-chain)
     * this method is called by the off-chain service, to sign the request.
     * it is called on-chain from the validatePaymasterUserOp, to validate the signature.
     * note that this signature covers all fields of the UserOperation, except the "paymasterData",
     * which will carry the signature itself.
     */
    function getHash(UserOperation calldata userOp) public pure returns (bytes32) {
        //can't use userOp.hash(), since it contains also the paymasterData itself.
        return
            keccak256(
                abi.encode(
                    userOp.getSender(),
                    userOp.nonce,
                    keccak256(userOp.initCode),
                    keccak256(userOp.callData),
                    userOp.callGas,
                    userOp.verificationGas,
                    userOp.preVerificationGas,
                    userOp.maxFeePerGas,
                    userOp.maxPriorityFeePerGas,
                    userOp.paymaster
                )
            );
    }

    /**
     * verify our external signer signed this request.
     * the "paymasterData" is supposed to be a signature over the entire request params
     */
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32, /*requestId*/
        uint256 requiredPreFund
    ) external view override returns (bytes memory context) {
        (requiredPreFund);
        bytes32 hash = getHash(userOp);
        uint256 sigLength = userOp.paymasterData.length;
        require(blockLists[msg.sender] == false, "VerifyingPaymaster: This wallet is blocked");
        require(sigLength == 64 || sigLength == 65, "VerifyingPaymaster: invalid signature length in paymasterData");
        require(
            verifyingSigner == hash.toEthSignedMessageHash().recover(userOp.paymasterData),
            "VerifyingPaymaster: wrong signature"
        );
        require(this._validateCallData(userOp.callData), "VerifyingPaymaster: operation not in sponsored operation");
        //no need for other on-chain validation: entire UserOp should have been checked
        // by the external service prior to signing it.
        return "";
    }

    function _validateCallData(bytes calldata opCallData) external view onlySelf returns (bool) {
        // The opCallDataLength should be the same with approveOperation
        if (opCallData.length != 228) return false;
        bytes4 funcSelector = bytes4(opCallData[132:136]);
        bytes calldata destData = opCallData[4:36];
        address dest = abi.decode(destData, (address));
        if (dest != token) return false;
        bytes memory approveParam = opCallData[136:200];
        (address spender, ) = abi.decode(approveParam, (address, uint256));
        if (funcSelector == APPROVE_FUNCTION_SELECTOR && spender == mainPaymaster) return true;
        return false;
    }

    function addBlockList(address blockAddress) public onlyOwner {
        blockLists[blockAddress] = true;
    }
}
