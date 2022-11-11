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
	USER_ADDRESS common.Address

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

	gasTipCap, err := client.SuggestGasTipCap(ctx)
	if err != nil {
		t.Fatalf("failed to get gas price: %s", err.Error())
	}

	return &bind.TransactOpts{
		From:  from,
		Nonce: big.NewInt(0).SetUint64(nonce),
		Value: big.NewInt(0),
		// GasPrice:  gasPrice,
		GasTipCap: gasTipCap,
		NoSend:    true,
		GasFeeCap: big.NewInt(1500000000), // TODO: ???
		GasLimit:  uint64(1000000),
		Context:   ctx,
		// Signer is missing
	}
}

func before_each(t *testing.T) {
	config.InitFromFile("../config/config.test.json")
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
		USER_ADDRESS = crypto.PubkeyToAddress(USER_PUBLIC)
		l.Infof("User address: %s", USER_ADDRESS.Hex())
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
	opts := prepareTransactOpts(t, context.Background(), USER_ADDRESS)
	opts.Signer = USER_BIND.Signer
	l.Infof("opts: %v", *opts)

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
		VerificationGas:      big.NewInt(100000),
		PreVerificationGas:   big.NewInt(21000),
		MaxFeePerGas:         big.NewInt(2000000), // TODO: ?
		MaxPriorityFeePerGas: big.NewInt(200000),  // TODO: ?
		Paymaster:            common.Address{},
		PaymasterData:        []byte{},
		Signature:            rawSigToBytes(tx.RawSignatureValues()),
	}
}

func SimulateOperation() abi.UserOperation {
	sender := common.HexToAddress("0x7f477B448FA08E8801c7fe44546e6aEae9Daae19")

	return abi.UserOperation{
		Sender:               sender,
		Nonce:                big.NewInt(4),
		InitCode:             []byte{},
		CallData:             common.Hex2Bytes("80c5c7d0000000000000000000000000f8935df67cab7bfca9532d1ac2088c5c39b995b5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044095ea7b30000000000000000000000003eea25034397b249a3ed8614bb4d0533e5b03594ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00000000000000000000000000000000000000000000000000000000"),
		CallGas:              big.NewInt(0).SetBytes(common.Hex2Bytes("015c28")),
		VerificationGas:      big.NewInt(103600),
		PreVerificationGas:   big.NewInt(21000),
		MaxFeePerGas:         big.NewInt(0).SetBytes(common.Hex2Bytes("29e8d60800")),
		MaxPriorityFeePerGas: big.NewInt(0).SetBytes(common.Hex2Bytes("06fc23ac00")),
		Paymaster:            common.Address{},
		PaymasterData:        []byte{},
		Signature:            common.Hex2Bytes("e0dd769fa60207219671c83b51ef568d80eac49003299e3709179ab2bb26df10074f7a7e6204527a8e2db160fb58a132fac15a6873497c86133827e867b0860b1b"),
	}
}

func rawSigToBytes(v, r, s *big.Int) []byte {
	result := make([]byte, 0)
	result = append(result, r.Bytes()...)
	result = append(result, s.Bytes()...)
	result = append(result, byte(v.Uint64()))

	return result
}

// NOTE: manually tested in <22-11-11 23:45:00>
// May not be reproducible unless self-created tx logic is implemented.
func Test_Simulate(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		before_each(t)

		// User transfer 100 tokens from user contract wallet to itself.
		uo := SimulateOperation()
		err := Simulate(context.Background(), uo)
		require.NoError(t, err)
	})
}

// NOTE: manually tested in <22-11-11 23:45:00>
// May not be reproducible unless self-created tx logic is implemented.
func Test_HandleOps(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		before_each(t)

		uo := SimulateOperation()
		txHash, err := HandleOps(context.Background(), []abi.UserOperation{uo})
		require.NoError(t, err)
		t.Logf("Tx Hash: %s", txHash)
	})
}
