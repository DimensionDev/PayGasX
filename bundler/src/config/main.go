package config

import (
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"io/ioutil"

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
	EntrypointContractAddress string `json:"entrypoint_contract_address"`
}

func InitFromFile(filename string) {
	if len(C.Chain.RPCServer) > 0 {
		return
	}

	configContent, err := ioutil.ReadFile(filename)
	if err != nil {
		panic(fmt.Sprintf("Error reading config file: %v", err))
	}

	if err = json.Unmarshal(configContent, C); err != nil {
		panic(fmt.Sprintf("Error parsing config file: %v", err))
	}
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


func GetEntrypointContractAddress() common.Address {
	return common.HexToAddress(C.Chain.EntrypointContractAddress)
}
