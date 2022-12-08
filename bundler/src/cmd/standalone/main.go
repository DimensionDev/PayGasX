package main

import (
	"bundler/config"
	"bundler/eth"
)

func main() {
	config.InitFromFile("config/config.json")
	eth.Init()
}
