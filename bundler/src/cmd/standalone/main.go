package main

import (
	"bundler/abi"
	"bundler/config"
	"bundler/eth"
	"math/big"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

func main() {
	config.InitFromFile("config/config.json")
	eth.Init()
}
