package config

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"math/big"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/sirupsen/logrus"
)

var (
	C *Config
)

type Config struct {
	Chain ChainConfig `json:"chain"`
	// Test can be nil in production env.
	Test *TestConfig `json:"test"`
}

type ChainConfig struct {
	ChainID                   string `json:"id"`
	RPCServer                 string `json:"rpc_server"`
	SecretKey                 string `json:"secret_key"`
	EntrypointContractAddress string `json:"entrypoint_contract_address"`
}

type TestConfig struct {
	UserSecret            string `json:"user_secret"`
	WalletContractAddress string `json:"contract_wallet_address"`
	TestERC20Address      string `json:"erc20_contract_address"`
	PaymasterAddress      string `json:"paymaster_address"`
}

func InitFromFile(filename string) {
	if C != nil {
		return
	}

	configContent, err := os.ReadFile(filename)
	if err != nil {
		panic(fmt.Sprintf("Error reading config file: %v", err))
	}

	if err = json.Unmarshal(configContent, &C); err != nil {
		panic(fmt.Sprintf("Error parsing config file: %v", err))
	}

	GetChainID() // Check Chain ID config
	GetBundler() // Check bundler config

	fmt.Printf("Bundler EOA address: %s\n", GetBundlerAddress().Hex())
	fmt.Printf("Entrypoint contract address: %s\n", GetEntrypointContractAddress().Hex())

}

func InitFromAWSSecret() {
	var secretName string
	var ok bool
	if secretName, ok = os.LookupEnv("SECRET_NAME"); !ok {
		logrus.Fatalf("SECRET_NAME is not set")
	}
	ctx := context.Background()

	// Create a Secrets Manager client
	cfg, err := config.LoadDefaultConfig(
		ctx,
	)
	if err != nil {
		logrus.Fatalf("Unable to load SDK config: %v", err)
	}

	client := secretsmanager.NewFromConfig(cfg)
	input := secretsmanager.GetSecretValueInput{
		SecretId:     aws.String(secretName),
		VersionStage: aws.String("AWSCURRENT"),
	}
	result, err := client.GetSecretValue(ctx, &input)
	if err != nil {
		logrus.Fatalf("Error when fetching secret: %s", err.Error())
	}

	// Decrypts secret using the associated KMS CMK.
	// Depending on whether the secret is a string or binary, one of these fields will be populated.
	if result.SecretString == nil {
		logrus.Fatalf("cannot get secret string")
	}
	secretString := *result.SecretString

	err = json.Unmarshal([]byte(secretString), &C)
	if err != nil {
		logrus.Fatalf("Error during parsing config JSON: %v", err)
	}
}

func GetChainID() *big.Int {
	id, ok := big.NewInt(0).SetString(C.Chain.ChainID, 10)
	if !ok {
		panic(fmt.Sprintf("failed to parse chain id: %v", C.Chain.ChainID))
	}
	return id
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
