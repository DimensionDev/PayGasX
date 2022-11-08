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

func Simulate(op abi.UserOperation) error {
	// Init contract
	entrypoint, err := abi.NewEntryPoint(config.GetEntrypointContractAddress(), client)
	if err != nil {
		return err
	}

	// Start simulation
	// Build a call to SimulateValidation, but not send on the chain.
	tx, err := entrypoint.SimulateValidation(&bind.TransactOpts{
		NoSend: true,
	}, op)
	if err != nil {
		return err
	}

	// Use `eth_call` to simulate the transaction on remote RPC server.
	simResultBytes, err := client.CallContract(context.Background(), ethereum.CallMsg{
		From:      config.GetBundlerAddress(),
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

func HandleOps(ops []abi.UserOperation) (txHash string, err error) {
	// Init contract
	entrypoint, err := abi.NewEntryPoint(config.GetEntrypointContractAddress(), client)
	if err != nil {
		return "", err
	}

	tx, err := entrypoint.HandleOps(nil, ops, config.GetBundlerAddress())
	if err != nil {
		return "", err
	}

	return tx.Hash().Hex(), nil
}
