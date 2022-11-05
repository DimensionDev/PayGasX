package config

import (
	"crypto/ecdsa"
	"fmt"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

var (
	C *Config
)

type Config struct {
	Chain ChainConfig `json:"chain"`
}

type ChainConfig struct {
	RPCServer          string `json:"rpc_server"`
	PaymasterSecretKey string `json:"paymaster_secret_key"`
}

func GetPaymaster() *ecdsa.PrivateKey {
	skBytes := common.Hex2Bytes(C.Chain.PaymasterSecretKey)
	sk, err := crypto.ToECDSA(skBytes)
	if err != nil {
		panic(fmt.Sprintf("failed to parse paymaster secret key: %v", err))
	}
	return sk
}

func GetPaymasterAddres() common.Address {
	sk := GetPaymaster()
	return crypto.PubkeyToAddress(sk.PublicKey)
}
