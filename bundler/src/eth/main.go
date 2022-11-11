package eth

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"

	"bundler/abi"
	"bundler/config"
)

var (
	client *ethclient.Client
	l      = logrus.WithFields(logrus.Fields{
		"module": "eth",
	})
)

type SimulateResult struct {
	PreOpGas *big.Int
	Prefund  *big.Int
}

func Init() {
	if client != nil {
		return
	}

	var err error
	client, err = ethclient.Dial(config.C.Chain.RPCServer)
	if err != nil {
		panic(fmt.Sprintf("Failed to connect to the Ethereum client: %s", err.Error()))
	}
}

func Simulate(ctx context.Context, op abi.UserOperation) error {
	// Init contract
	entrypoint, err := abi.NewEntryPoint(config.GetEntrypointContractAddress(), client)
	if err != nil {
		return err
	}

	signer := types.LatestSignerForChainID(config.GetChainID())
	tOps := &bind.TransactOpts{
		// Zero address `from` required by contract
		From: common.Address{},
		// Basiclly bind.NewKeyedTransactorWithChainID() but omit `ErrNotAuthorized` check
		Signer: func(address common.Address, tx *types.Transaction) (*types.Transaction, error) {
			signature, err := crypto.Sign(signer.Hash(tx).Bytes(), config.GetBundler())
			if err != nil {
				return nil, err
			}
			return tx.WithSignature(signer, signature)
		},
		Context: ctx,
		NoSend:  true,
	}

	// Start simulation
	_, err = entrypoint.SimulateValidation(tOps, op)
	if err != nil {
		l.Warnf("Simulation failed. Error: %s", err.Error())
		return err
	}
	return nil
}

func HandleOps(ctx context.Context, ops []abi.UserOperation) (txHash string, err error) {
	// Init contract
	entrypoint, err := abi.NewEntryPoint(config.GetEntrypointContractAddress(), client)
	if err != nil {
		return "", err
	}
	transactOps, err := bind.NewKeyedTransactorWithChainID(config.GetBundler(), config.GetChainID())
	if err != nil {
		return "", xerrors.Errorf("Failed to create transactor for bundler: %w", err)
	}
	transactOps.Context = ctx

	tx, err := entrypoint.HandleOps(transactOps, ops, config.GetBundlerAddress())
	if err != nil {
		return "", err
	}

	return tx.Hash().Hex(), nil
}
