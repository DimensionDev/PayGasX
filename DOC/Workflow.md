# Workflow

Before dive deep into the detail about workflow of PayGasX, it would be better to know the general structure of the proposal [EIP-4337](https://eips.ethereum.org/EIPS/eip-4337) in advance.

## State in EIP-4337

![state](stateDiagram.png)

Understanding the state transition in EIP-4337 could help you understand our workflow better.

Since the new data structure `UserOperation` is introduced in EIP-4337, only two status of transaction (i.e. failure and success of a transaction) cannot describe the status of `UserOperation` precisely. We should know a new condition: **Transaction succeed, but the original user call is reverted**. With this status, our system is able to get paid even though the user call fails.

Check [try/catch mechanism in solidity](https://docs.soliditylang.org/en/v0.8.17/control-structures.html?highlight=try#try-catch) for more detail.

## Details of SimpleWallet

Transactions can be executed directly by the owner through `exec(address, uint256, bytes)`, or from EntryPoint `execFromEntryPoint(address, uint256, bytes)`.

- Calling `exec()` directly require the owner address to hold sufficient coins to pay for the GAS fees, the wallet will behave like normal smart contract wallet when used this way.
- An alternative way to achieve GAS-less transaction is to sponsor the transaction by pre-deposit the fees into EntryPoint contract by calling `addDeposit() payable`. The user will have to sign an userOperation and get a Bundler to execute it from the EntryPoint.

The two methods will achieve the same result.
![walletWorkFlow](4337WalletWorkFlow.png)

## Detail of Paymaster

According to the [official doc of ERC-4337](https://eips.ethereum.org/EIPS/eip-4337#simulation),

> While simulating `op` validation, the client should make sure that `paymaster.validatePaymasterUserOp` does not access mutable state of any contract except the paymaster itself.

We need some special design for ERC-20 paymaster to avoid violating the condition. Our solution is to use deposit mechanism and also create two paymaster (the two paymasters could be on implementation level or just conception level).

Currently, we divided the entire work flow into two main parts: preparation stage and execution stage.

The following workflow diagrams illustrate these two stage in detail.

### Preparation Stage

We hope to give user an entirely gas-free procedure, thus, we have a `verifying paymaster` to help gasless user approve their ERC-20 token ($MASK will be the example token in the following sections).

![preparation](preparation.png)

`Verifying paymaster` could sponsor transaction for qualified users with supported operation. Here, this paymaster will be used in the operations: `approve()`. This operation should be done in advance (especially for first-time user). Here, we must pay attention to the malicious attack targeting our verifying paymaster since we sponsor users for free. Our solution is to parse `callData` in `UserOperation` to ensure it only sponsor the supported operation. Check [data structure of `UserOperation.callData`](callDataField.md)

### Execution Stage

As stated in the former section, we use deposit mechanism. In this mechanism, every SC wallet should have enough deposit balance before execution stage. In our case, we plan to cover the deposit fee for user. For qualified users, we will deposit for them in advance. Then, users with enough deposit balance in our paymaster is eligible to perform their `UserOperation` via our $MASK paymaster.

If the execution is completed successfully, paymaster will call `transferFrom()` in $MASK token contract to transfer $MASK for gas fee directly. If paymaster fail to get paid, they'll decrease the deposit balance instead.

![execution](execution.png)

In the entire process, user may face three major exceptional condition.

- User does not complete the preparation stage or their deposit is not enough: Our $MASK paymaster will reject to pay for this `UserOperation`.

- User call in `UserOperation` execution is failed: user still have to pay for their failed operation. $MASK paymaster will call $MASK token contract to transfer corresponding token amount from user's contract wallet.

- `postOp()` execution is failed: paymaster cannot get paid in `postOp()`. It will reduce the deposit of this user as a substitute.

For token exchange (i.e. $ETH-$MASK), we decided to use a script to periodically update the token swap ratio to keep a relatively stable exchange ratio and also reduce the gas cost for instant token exchange.

**NOTE**: For `opReverted` mode and `postOpReverted` mode, the effect caused by user call in `UserOperation` will be reverted even though the entire tx won't be reverted.
