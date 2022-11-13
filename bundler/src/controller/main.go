package controller

import (
	"bundler/abi"
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

type HandleOpsRequest struct {
	UserOperations []UserOperation `json:"UserOperations"`
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
		Body:       fmt.Sprintf("{\"message\": \"%s\"}", body),
	}, nil
}

func Healthz(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	return events.APIGatewayProxyResponse{
		StatusCode:      200,
		Body:            "OK",
		IsBase64Encoded: false,
	}, nil
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

	return events.APIGatewayProxyResponse{
		StatusCode:      200,
		Body:            fmt.Sprintf("{\"tx_hash\": \"%s\"}", txHash),
		IsBase64Encoded: false,
	}, nil
}
