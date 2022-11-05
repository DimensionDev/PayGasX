package util

import (
	"encoding/base64"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

func ParseAddressString(addr string) (common.Address) {
	return common.HexToAddress(addr)
}

func ParseBigIntString(bint string) (result *big.Int) {
	result = big.NewInt(0)
	result, ok := result.SetString(bint, 10)
	if !ok {
		return nil
	}
	return result
}

func ParseBase64String(b64 string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(b64)
}
