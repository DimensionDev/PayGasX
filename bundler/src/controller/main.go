package controller

import (
	"bundler/abi"
	"bundler/config"
	"bundler/eth"
	"bundler/util"
	"context"
	"encoding/json"
	"fmt"

	"github.com/aws/aws-lambda-go/events"
	"github.com/ethereum/go-ethereum/common"
	"github.com/sirupsen/logrus"
	"golang.org/x/xerrors"
)

var (
	l = logrus.WithField("module", "controller")
)

type HealthResponse struct {
	Hello                     string `json:"hello"`
	BundlerEOA                string `json:"bundler_eoa"`
	ChainID                   string `json:"chain_id"`
	EntrypointContractAddress string `json:"entrypoint_contract_address"`
}

type HandleOpsRequest struct {
	UserOperations []UserOperation `json:"user_operations"`
}

type UserOperation struct {
	// `from`
	// User (contract wallet) address
	Sender *string `json:"sender"`
	// `big.Int`
	Nonce *string `json:"nonce"`
	// Base64 encoded bytes
	CallData *string `json:"call_data"`
	// `big.Int`
	CallGas *string `json:"call_gas"`
	// `big.Int`
	VerificationGas *string `json:"verification_gas"`
	// `big.Int`
	PreVerificationGas *string `json:"pre_verification_gas"`
	// `big.Int`
	MaxFeePerGas *string `json:"max_fee_per_gas"`
	// `big.Int`
	MaxPriorityFeePerGas *string `json:"max_priority_fee_per_gas"`
	// Paymaster to use.
	Paymaster *string `json:"paymaster"`
	// Base64 encoded bytes
	PaymasterData *string `json:"paymaster_data"`
	// Base64 encoded
	Signature *string `json:"signature"`
	// No need to give paymaster data
}

type HandleOpsResponse struct {
	TxHash string `json:"tx_hash"`
}

func (uo *UserOperation) ToABIStruct() (abiUO abi.UserOperation, err error) {
	abiUO = abi.UserOperation{}

	abiUO.Sender = util.ParseAddressString(*uo.Sender)
	abiUO.Nonce = util.ParseBigIntString(*uo.Nonce)
	abiUO.CallData, err = util.ParseBase64String(*uo.CallData)
	abiUO.CallGas = util.ParseBigIntString(*uo.CallGas)
	if err != nil {
		return abi.UserOperation{}, xerrors.Errorf("failed to parse call data: %w", err)
	}
	abiUO.VerificationGas = util.ParseBigIntString(*uo.VerificationGas)
	abiUO.PreVerificationGas = util.ParseBigIntString(*uo.PreVerificationGas)
	abiUO.MaxFeePerGas = util.ParseBigIntString(*uo.MaxFeePerGas)
	abiUO.MaxPriorityFeePerGas = util.ParseBigIntString(*uo.MaxPriorityFeePerGas)
	abiUO.Signature, err = util.ParseBase64String(*uo.Signature)
	if err != nil {
		return abi.UserOperation{}, xerrors.Errorf("failed to parse signature: %w", err)
	}

	abiUO.Paymaster = common.HexToAddress(*uo.Paymaster)
	abiUO.PaymasterData, err = util.ParseBase64String(*uo.PaymasterData)
	if err != nil {
		return abi.UserOperation{}, xerrors.Errorf("failed to parse paymaster data: %w", err)
	}

	return
}

func errorResp(code int, body string) (events.APIGatewayProxyResponse, error) {
	return events.APIGatewayProxyResponse{
		StatusCode: code,
		Headers:    map[string]string{"Content-Type": "application/json"},
		Body:       fmt.Sprintf("{\"message\": \"%s\"}", body),
	}, nil
}

func successResp(body any) (events.APIGatewayProxyResponse, error) {
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode:      500,
			Headers:         map[string]string{"Content-Type": "application/json"},
			Body:            fmt.Sprintf("{\"message\": \"failed to marshal response body: %s\"}", err.Error()),
			IsBase64Encoded: false,
		}, nil
	}
	return events.APIGatewayProxyResponse{
		StatusCode:      200,
		Headers:         map[string]string{"Content-Type": "application/json"},
		Body:            string(bodyBytes),
		IsBase64Encoded: false,
	}, nil
}

func Healthz(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return successResp(HealthResponse{
		Hello:                     "bundler",
		BundlerEOA:                config.GetBundlerAddress().Hex(),
		ChainID:                   config.GetChainID().String(),
		EntrypointContractAddress: config.GetEntrypointContractAddress().Hex(),
	})
}

func HandleOps(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	req := HandleOpsRequest{}
	err := json.Unmarshal([]byte(request.Body), &req)
	if err != nil {
		return errorResp(400, "failed to parse request body")
	}

	if len(req.UserOperations) == 0 {
		return errorResp(400, "no user operations")
	}

	abiUOs := make([]abi.UserOperation, len(req.UserOperations))
	for _, uo := range req.UserOperations {
		abiUO, err := uo.ToABIStruct()
		if err != nil {
			return errorResp(400, fmt.Sprintf("failed to parse user operation: %s", err.Error()))
		}
		abiUOs = append(abiUOs, abiUO)
	}

	txHash, err := eth.HandleOps(context.Background(), abiUOs)
	if err != nil {
		return errorResp(500, fmt.Sprintf("failed to send HandleOps call: %s", err.Error()))
	}

	return successResp(HandleOpsResponse{
		TxHash: txHash,
	})
}
