package eth

import (
	"bundler/abi"
	"bundler/config"
	"context"
	"crypto/ecdsa"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/require"
)

// vars should be defined in `secret_test.go` file:
// USER_SECRET : *ecdsa.PrivateKey
// CONTRACT_WALLET_ADDRESS : common.Address
// TEST_ERC20_ADDRESS : common.Address
var (
	USER         *ecdsa.PrivateKey
	USER_PUBLIC  ecdsa.PublicKey
	USER_BIND    *bind.TransactOpts
	USER_ADDRESS = crypto.PubkeyToAddress(USER_PUBLIC)

	erc20Contract *abi.ERC20
)

func getContractWalletAddress() common.Address {
	return common.HexToAddress(config.C.Test.WalletContractAddress)
}

func getERC20Address() common.Address {
	return common.HexToAddress(config.C.Test.TestERC20Address)
}

func getPaymasterAddress() common.Address {
	return common.HexToAddress(config.C.Test.PaymasterAddress)
}

func prepareTransactOpts(t *testing.T, ctx context.Context, from common.Address) *bind.TransactOpts {
	nonce, err := client.NonceAt(ctx, from, nil)
	if err != nil {
		t.Fatalf("failed to get nonce for 0x%s: %s", from.Hex(), err.Error())
	}

	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		t.Fatalf("failed to get gas price: %s", err.Error())
	}

	gasTipCap, err := client.SuggestGasTipCap(ctx)
	if err != nil {
		t.Fatalf("failed to get gas price: %s", err.Error())
	}

	return &bind.TransactOpts{
		From:      from,
		Nonce:     big.NewInt(0).SetUint64(nonce),
		Value:     big.NewInt(0),
		GasPrice:  gasPrice,
		GasTipCap: gasTipCap,
		NoSend:    true,
		GasFeeCap: big.NewInt(1000), // TODO: ???
		GasLimit:  uint64(100000000000),
		Context:   ctx,
		// Signer is missing
	}
}

func before_each(t *testing.T) {
	config.InitFromFile("./config/config.test.json")
	Init()

	if config.C.Test == nil {
		t.Fatalf("Test config is not defined")
	}

	if USER == nil {
		var err error
		USER, err = crypto.HexToECDSA(config.C.Test.UserSecret)
		if err != nil {
			t.Fatalf("%s", err.Error())
		}
		USER_PUBLIC = USER.PublicKey
		USER_BIND, err = bind.NewKeyedTransactorWithChainID(USER, config.GetChainID())
		if err != nil {
			t.Fatalf("%s", err.Error())
		}
	}

	if erc20Contract == nil {
		var err error
		erc20Contract, err = abi.NewERC20(getERC20Address(), client)
		if err != nil {
			t.Fatalf("%s", err.Error())
		}
	}
}

// From: ContractWallet, To: ERC20Contract, Signer: User
func buildTransferTX(t *testing.T, to common.Address) *types.Transaction {
	opts := prepareTransactOpts(t, context.Background(), getContractWalletAddress())
	opts.Signer = USER_BIND.Signer

	tx, err := erc20Contract.Transfer(opts, to, big.NewInt(100))
	if err != nil {
		t.Fatalf("%s", err.Error())
	}
	return tx
}

// TODO: finish this function
func txToUserOperation(sender common.Address, tx *types.Transaction) abi.UserOperation {
	return abi.UserOperation{
		Sender:               sender,
		Nonce:                big.NewInt(0).SetUint64(tx.Nonce()),
		InitCode:             []byte{},
		CallData:             tx.Data(),
		CallGas:              big.NewInt(0).SetUint64(tx.Gas()),
		VerificationGas:      big.NewInt(0), // TODO: ?
		PreVerificationGas:   big.NewInt(21000),
		MaxFeePerGas:         big.NewInt(2000000), // TODO: ?
		MaxPriorityFeePerGas: big.NewInt(200000),  // TODO: ?
		Paymaster:            getPaymasterAddress(),
		PaymasterData:        []byte{},
		Signature:            []byte{},
	}
}

func Test_Simulate(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		before_each(t)

		// User transfer 100 tokens from user contract wallet to itself.
		tx := buildTransferTX(t, getContractWalletAddress())
		uo := txToUserOperation(getContractWalletAddress(), tx)
		err := Simulate(context.Background(), uo)
		require.NoError(t, err)
	})
}
