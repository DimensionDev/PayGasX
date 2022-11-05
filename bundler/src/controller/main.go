package controller

import (
	"bundler/abi"
	"bundler/config"
	"bundler/util"

	"golang.org/x/xerrors"
)

type UserOperation struct {
	// `from`
	Sender *string `json:"sender"`
	// `big.Int`
	Nonce *string `json:"nonce"`
	// Base64 encoded
	CallData *string `json:"call_data"`
	// `big.Int`
	VerificationGas *string `json:"verification_gas"`
	// `big.Int`
	PreVerificationGas *string `json:"pre_verification_gas"`
	// `big.Int`
	MaxFeePerGas *string `json:"max_fee_per_gas"`
	// `big.Int`
	MaxPriorityFeePerGas *string `json:"max_priority_fee_per_gas"`
	// Base64 encoded
	Signature *string `json:"signature"`
	// No need to give paymaster data
}

func (uo *UserOperation) ToABIStruct() (abiUO *abi.UserOperation, err error) {
	abiUO = new(abi.UserOperation)
	abiUO.Sender = util.ParseAddressString(*uo.Sender)
	abiUO.Nonce = util.ParseBigIntString(*uo.Nonce)
	abiUO.CallData, err = util.ParseBase64String(*uo.CallData)
	if err != nil {
		return nil, xerrors.Errorf("failed to parse call data: %w", err)
	}
	abiUO.VerificationGas = util.ParseBigIntString(*uo.VerificationGas)
	abiUO.PreVerificationGas = util.ParseBigIntString(*uo.PreVerificationGas)
	abiUO.MaxFeePerGas = util.ParseBigIntString(*uo.MaxFeePerGas)
	abiUO.MaxPriorityFeePerGas = util.ParseBigIntString(*uo.MaxPriorityFeePerGas)
	abiUO.Signature, err = util.ParseBase64String(*uo.Signature)
	if err != nil {
		return nil, xerrors.Errorf("failed to parse signature: %w", err)
	}

	abiUO.Paymaster = config.GetPaymasterAddres()
	abiUO.PaymasterData = []byte{} // TODO: don't know what it is for?

	return
}
