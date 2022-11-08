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
	SecretKey string `json:"secret_key"`
	EntrypointContractAddress string `json:"entrypoint_contract_address"`
}

func InitFromFile(filename string) {
	if C != nil {
		return
	}

	configContent, err := ioutil.ReadFile(filename)
	if err != nil {
		panic(fmt.Sprintf("Error reading config file: %v", err))
	}

	if err = json.Unmarshal(configContent, C); err != nil {
		panic(fmt.Sprintf("Error parsing config file: %v", err))
	}

	fmt.Printf("Bundler EOA address: 0x%s", GetBundlerAddress().Hex())
	fmt.Printf("Contract address: 0x%s", GetEntrypointContractAddress().Hex())

}

func GetBundler() *ecdsa.PrivateKey {
	skBytes := common.Hex2Bytes(C.Chain.SecretKey)
	sk, err := crypto.ToECDSA(skBytes)
	if err != nil {
		panic(fmt.Sprintf("failed to parse paymaster secret key: %v", err))
	}
	return sk
}

func GetBundlerAddress() common.Address {
	sk := GetBundler()
	return crypto.PubkeyToAddress(sk.PublicKey)
}


func GetEntrypointContractAddress() common.Address {
	return common.HexToAddress(C.Chain.EntrypointContractAddress)
}
