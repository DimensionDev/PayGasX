package eth

import (
	"context"
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/rlp"
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
	bundler *bind.TransactOpts
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

	bundler, err = bind.NewKeyedTransactorWithChainID(config.GetBundler(), config.GetChainID())
	if err != nil {
		panic(fmt.Sprintf("Failed to create transactor for bundler: %s", err.Error()))
	}
}

func Simulate(ctx context.Context, op abi.UserOperation) error {
	// Init contract
	entrypoint, err := abi.NewEntryPoint(config.GetEntrypointContractAddress(), client)
	if err != nil {
		return err
	}

	// Start simulation
	// Build a call to SimulateValidation, but not send on the chain.
	tx, err := entrypoint.SimulateValidation(&bind.TransactOpts{
		From:    bundler.From,
		Signer:  bundler.Signer,
		NoSend:  true,
		Context: ctx,
	}, op)
	if err != nil {
		return err
	}

	// Use `eth_call` to simulate the transaction on remote RPC server.
	simResultBytes, err := client.CallContract(ctx, ethereum.CallMsg{
		From:      bundler.From,
		To:        tx.To(),
		Gas:       tx.Gas(),
		GasPrice:  tx.GasPrice(),
		GasFeeCap: tx.GasFeeCap(),
		GasTipCap: tx.GasTipCap(),
		Value:     tx.Value(),
		Data:      tx.Data(),
	}, nil)
	if err != nil {
		return err
	}
	simResult := new(SimulateResult)
	err = rlp.DecodeBytes(simResultBytes, simResult)
	if err != nil {
		return xerrors.Errorf("error when decoding simulate result: %w", err)
	}
	l.Debugf("Simulate result for %s: %v", op.Sender.Hex(), simResult)

	return nil
}

func HandleOps(ctx context.Context, ops []abi.UserOperation) (txHash string, err error) {
	// Init contract
	entrypoint, err := abi.NewEntryPoint(config.GetEntrypointContractAddress(), client)
	if err != nil {
		return "", err
	}

	tx, err := entrypoint.HandleOps(&bind.TransactOpts{
		From:    bundler.From,
		Signer:  bundler.Signer,
		Context: ctx,
		NoSend:  false,
	}, ops, config.GetBundlerAddress())
	if err != nil {
		return "", err
	}

	return tx.Hash().Hex(), nil
}
