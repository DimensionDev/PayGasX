package eth

import (
	"github.com/ethereum/go-ethereum/ethclient"
	"golang.org/x/xerrors"

	"bundler/abi"
)

func BroadcastToRPC(ops []abi.UserOperation) error {
	_, err := ethclient.Dial("RPCSERVER")
	if err != nil {
		return xerrors.Errorf("Failed to connect to the Ethereum client: %w", err)
	}

	return nil // TODO
}
