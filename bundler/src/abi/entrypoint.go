// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package abi

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
)

// EntryPointUserOpInfo is an auto generated low-level Go binding around an user-defined struct.
type EntryPointUserOpInfo struct {
	RequestId     [32]byte
	Prefund       *big.Int
	PaymentMode   uint8
	ContextOffset *big.Int
	PreOpGas      *big.Int
}

// StakeManagerDepositInfo is an auto generated low-level Go binding around an user-defined struct.
type StakeManagerDepositInfo struct {
	Deposit         *big.Int
	Staked          bool
	Stake           *big.Int
	UnstakeDelaySec uint32
	WithdrawTime    uint64
}

// UserOperation is an auto generated low-level Go binding around an user-defined struct.
type UserOperation struct {
	Sender               common.Address
	Nonce                *big.Int
	InitCode             []byte
	CallData             []byte
	CallGas              *big.Int
	VerificationGas      *big.Int
	PreVerificationGas   *big.Int
	MaxFeePerGas         *big.Int
	MaxPriorityFeePerGas *big.Int
	Paymaster            common.Address
	PaymasterData        []byte
	Signature            []byte
}

// EntryPointMetaData contains all meta data concerning the EntryPoint contract.
var EntryPointMetaData = &bind.MetaData{
	ABI: "[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"_create2factory\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"_paymasterStake\",\"type\":\"uint256\"},{\"internalType\":\"uint32\",\"name\":\"_unstakeDelaySec\",\"type\":\"uint32\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"opIndex\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"paymaster\",\"type\":\"address\"},{\"internalType\":\"string\",\"name\":\"reason\",\"type\":\"string\"}],\"name\":\"FailedOp\",\"type\":\"error\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"totalDeposit\",\"type\":\"uint256\"}],\"name\":\"Deposited\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"totalStaked\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"withdrawTime\",\"type\":\"uint256\"}],\"name\":\"StakeLocked\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"withdrawTime\",\"type\":\"uint256\"}],\"name\":\"StakeUnlocked\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"address\",\"name\":\"withdrawAddress\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"StakeWithdrawn\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"bytes32\",\"name\":\"requestId\",\"type\":\"bytes32\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"sender\",\"type\":\"address\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"paymaster\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"actualGasCost\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"actualGasPrice\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"bool\",\"name\":\"success\",\"type\":\"bool\"}],\"name\":\"UserOperationEvent\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"bytes32\",\"name\":\"requestId\",\"type\":\"bytes32\"},{\"indexed\":true,\"internalType\":\"address\",\"name\":\"sender\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"},{\"indexed\":false,\"internalType\":\"bytes\",\"name\":\"revertReason\",\"type\":\"bytes\"}],\"name\":\"UserOperationRevertReason\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"address\",\"name\":\"withdrawAddress\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"amount\",\"type\":\"uint256\"}],\"name\":\"Withdrawn\",\"type\":\"event\"},{\"inputs\":[{\"internalType\":\"uint32\",\"name\":\"_unstakeDelaySec\",\"type\":\"uint32\"}],\"name\":\"addStake\",\"outputs\":[],\"stateMutability\":\"payable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"}],\"name\":\"balanceOf\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"create2factory\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"}],\"name\":\"depositTo\",\"outputs\":[],\"stateMutability\":\"payable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"name\":\"deposits\",\"outputs\":[{\"internalType\":\"uint112\",\"name\":\"deposit\",\"type\":\"uint112\"},{\"internalType\":\"bool\",\"name\":\"staked\",\"type\":\"bool\"},{\"internalType\":\"uint112\",\"name\":\"stake\",\"type\":\"uint112\"},{\"internalType\":\"uint32\",\"name\":\"unstakeDelaySec\",\"type\":\"uint32\"},{\"internalType\":\"uint64\",\"name\":\"withdrawTime\",\"type\":\"uint64\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"account\",\"type\":\"address\"}],\"name\":\"getDepositInfo\",\"outputs\":[{\"components\":[{\"internalType\":\"uint112\",\"name\":\"deposit\",\"type\":\"uint112\"},{\"internalType\":\"bool\",\"name\":\"staked\",\"type\":\"bool\"},{\"internalType\":\"uint112\",\"name\":\"stake\",\"type\":\"uint112\"},{\"internalType\":\"uint32\",\"name\":\"unstakeDelaySec\",\"type\":\"uint32\"},{\"internalType\":\"uint64\",\"name\":\"withdrawTime\",\"type\":\"uint64\"}],\"internalType\":\"structStakeManager.DepositInfo\",\"name\":\"info\",\"type\":\"tuple\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"components\":[{\"internalType\":\"address\",\"name\":\"sender\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"},{\"internalType\":\"bytes\",\"name\":\"initCode\",\"type\":\"bytes\"},{\"internalType\":\"bytes\",\"name\":\"callData\",\"type\":\"bytes\"},{\"internalType\":\"uint256\",\"name\":\"callGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"verificationGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"preVerificationGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"maxFeePerGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"maxPriorityFeePerGas\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"paymaster\",\"type\":\"address\"},{\"internalType\":\"bytes\",\"name\":\"paymasterData\",\"type\":\"bytes\"},{\"internalType\":\"bytes\",\"name\":\"signature\",\"type\":\"bytes\"}],\"internalType\":\"structUserOperation\",\"name\":\"userOp\",\"type\":\"tuple\"}],\"name\":\"getRequestId\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"bytes\",\"name\":\"initCode\",\"type\":\"bytes\"},{\"internalType\":\"uint256\",\"name\":\"salt\",\"type\":\"uint256\"}],\"name\":\"getSenderAddress\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"sender\",\"type\":\"address\"}],\"name\":\"getSenderStorage\",\"outputs\":[{\"internalType\":\"uint256[]\",\"name\":\"senderStorageCells\",\"type\":\"uint256[]\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"components\":[{\"internalType\":\"address\",\"name\":\"sender\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"},{\"internalType\":\"bytes\",\"name\":\"initCode\",\"type\":\"bytes\"},{\"internalType\":\"bytes\",\"name\":\"callData\",\"type\":\"bytes\"},{\"internalType\":\"uint256\",\"name\":\"callGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"verificationGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"preVerificationGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"maxFeePerGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"maxPriorityFeePerGas\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"paymaster\",\"type\":\"address\"},{\"internalType\":\"bytes\",\"name\":\"paymasterData\",\"type\":\"bytes\"},{\"internalType\":\"bytes\",\"name\":\"signature\",\"type\":\"bytes\"}],\"internalType\":\"structUserOperation[]\",\"name\":\"ops\",\"type\":\"tuple[]\"},{\"internalType\":\"addresspayable\",\"name\":\"beneficiary\",\"type\":\"address\"}],\"name\":\"handleOps\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"components\":[{\"internalType\":\"address\",\"name\":\"sender\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"},{\"internalType\":\"bytes\",\"name\":\"initCode\",\"type\":\"bytes\"},{\"internalType\":\"bytes\",\"name\":\"callData\",\"type\":\"bytes\"},{\"internalType\":\"uint256\",\"name\":\"callGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"verificationGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"preVerificationGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"maxFeePerGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"maxPriorityFeePerGas\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"paymaster\",\"type\":\"address\"},{\"internalType\":\"bytes\",\"name\":\"paymasterData\",\"type\":\"bytes\"},{\"internalType\":\"bytes\",\"name\":\"signature\",\"type\":\"bytes\"}],\"internalType\":\"structUserOperation\",\"name\":\"op\",\"type\":\"tuple\"},{\"components\":[{\"internalType\":\"bytes32\",\"name\":\"requestId\",\"type\":\"bytes32\"},{\"internalType\":\"uint256\",\"name\":\"prefund\",\"type\":\"uint256\"},{\"internalType\":\"enumEntryPoint.PaymentMode\",\"name\":\"paymentMode\",\"type\":\"uint8\"},{\"internalType\":\"uint256\",\"name\":\"contextOffset\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"preOpGas\",\"type\":\"uint256\"}],\"internalType\":\"structEntryPoint.UserOpInfo\",\"name\":\"opInfo\",\"type\":\"tuple\"},{\"internalType\":\"bytes\",\"name\":\"context\",\"type\":\"bytes\"}],\"name\":\"innerHandleOp\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"actualGasCost\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"paymasterStake\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"components\":[{\"internalType\":\"address\",\"name\":\"sender\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"},{\"internalType\":\"bytes\",\"name\":\"initCode\",\"type\":\"bytes\"},{\"internalType\":\"bytes\",\"name\":\"callData\",\"type\":\"bytes\"},{\"internalType\":\"uint256\",\"name\":\"callGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"verificationGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"preVerificationGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"maxFeePerGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"maxPriorityFeePerGas\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"paymaster\",\"type\":\"address\"},{\"internalType\":\"bytes\",\"name\":\"paymasterData\",\"type\":\"bytes\"},{\"internalType\":\"bytes\",\"name\":\"signature\",\"type\":\"bytes\"}],\"internalType\":\"structUserOperation\",\"name\":\"userOp\",\"type\":\"tuple\"}],\"name\":\"simulateValidation\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"preOpGas\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"prefund\",\"type\":\"uint256\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"unlockStake\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"unstakeDelaySec\",\"outputs\":[{\"internalType\":\"uint32\",\"name\":\"\",\"type\":\"uint32\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"addresspayable\",\"name\":\"withdrawAddress\",\"type\":\"address\"}],\"name\":\"withdrawStake\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"addresspayable\",\"name\":\"withdrawAddress\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"withdrawAmount\",\"type\":\"uint256\"}],\"name\":\"withdrawTo\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"stateMutability\":\"payable\",\"type\":\"receive\"}]",
}

// EntryPointABI is the input ABI used to generate the binding from.
// Deprecated: Use EntryPointMetaData.ABI instead.
var EntryPointABI = EntryPointMetaData.ABI

// EntryPoint is an auto generated Go binding around an Ethereum contract.
type EntryPoint struct {
	EntryPointCaller     // Read-only binding to the contract
	EntryPointTransactor // Write-only binding to the contract
	EntryPointFilterer   // Log filterer for contract events
}

// EntryPointCaller is an auto generated read-only Go binding around an Ethereum contract.
type EntryPointCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// EntryPointTransactor is an auto generated write-only Go binding around an Ethereum contract.
type EntryPointTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// EntryPointFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type EntryPointFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// EntryPointSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type EntryPointSession struct {
	Contract     *EntryPoint       // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// EntryPointCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type EntryPointCallerSession struct {
	Contract *EntryPointCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts     // Call options to use throughout this session
}

// EntryPointTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type EntryPointTransactorSession struct {
	Contract     *EntryPointTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts     // Transaction auth options to use throughout this session
}

// EntryPointRaw is an auto generated low-level Go binding around an Ethereum contract.
type EntryPointRaw struct {
	Contract *EntryPoint // Generic contract binding to access the raw methods on
}

// EntryPointCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type EntryPointCallerRaw struct {
	Contract *EntryPointCaller // Generic read-only contract binding to access the raw methods on
}

// EntryPointTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type EntryPointTransactorRaw struct {
	Contract *EntryPointTransactor // Generic write-only contract binding to access the raw methods on
}

// NewEntryPoint creates a new instance of EntryPoint, bound to a specific deployed contract.
func NewEntryPoint(address common.Address, backend bind.ContractBackend) (*EntryPoint, error) {
	contract, err := bindEntryPoint(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &EntryPoint{EntryPointCaller: EntryPointCaller{contract: contract}, EntryPointTransactor: EntryPointTransactor{contract: contract}, EntryPointFilterer: EntryPointFilterer{contract: contract}}, nil
}

// NewEntryPointCaller creates a new read-only instance of EntryPoint, bound to a specific deployed contract.
func NewEntryPointCaller(address common.Address, caller bind.ContractCaller) (*EntryPointCaller, error) {
	contract, err := bindEntryPoint(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &EntryPointCaller{contract: contract}, nil
}

// NewEntryPointTransactor creates a new write-only instance of EntryPoint, bound to a specific deployed contract.
func NewEntryPointTransactor(address common.Address, transactor bind.ContractTransactor) (*EntryPointTransactor, error) {
	contract, err := bindEntryPoint(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &EntryPointTransactor{contract: contract}, nil
}

// NewEntryPointFilterer creates a new log filterer instance of EntryPoint, bound to a specific deployed contract.
func NewEntryPointFilterer(address common.Address, filterer bind.ContractFilterer) (*EntryPointFilterer, error) {
	contract, err := bindEntryPoint(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &EntryPointFilterer{contract: contract}, nil
}

// bindEntryPoint binds a generic wrapper to an already deployed contract.
func bindEntryPoint(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(EntryPointABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_EntryPoint *EntryPointRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _EntryPoint.Contract.EntryPointCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_EntryPoint *EntryPointRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _EntryPoint.Contract.EntryPointTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_EntryPoint *EntryPointRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _EntryPoint.Contract.EntryPointTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_EntryPoint *EntryPointCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _EntryPoint.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_EntryPoint *EntryPointTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _EntryPoint.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_EntryPoint *EntryPointTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _EntryPoint.Contract.contract.Transact(opts, method, params...)
}

// BalanceOf is a free data retrieval call binding the contract method 0x70a08231.
//
// Solidity: function balanceOf(address account) view returns(uint256)
func (_EntryPoint *EntryPointCaller) BalanceOf(opts *bind.CallOpts, account common.Address) (*big.Int, error) {
	var out []interface{}
	err := _EntryPoint.contract.Call(opts, &out, "balanceOf", account)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// BalanceOf is a free data retrieval call binding the contract method 0x70a08231.
//
// Solidity: function balanceOf(address account) view returns(uint256)
func (_EntryPoint *EntryPointSession) BalanceOf(account common.Address) (*big.Int, error) {
	return _EntryPoint.Contract.BalanceOf(&_EntryPoint.CallOpts, account)
}

// BalanceOf is a free data retrieval call binding the contract method 0x70a08231.
//
// Solidity: function balanceOf(address account) view returns(uint256)
func (_EntryPoint *EntryPointCallerSession) BalanceOf(account common.Address) (*big.Int, error) {
	return _EntryPoint.Contract.BalanceOf(&_EntryPoint.CallOpts, account)
}

// Create2factory is a free data retrieval call binding the contract method 0x0bfb6847.
//
// Solidity: function create2factory() view returns(address)
func (_EntryPoint *EntryPointCaller) Create2factory(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _EntryPoint.contract.Call(opts, &out, "create2factory")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Create2factory is a free data retrieval call binding the contract method 0x0bfb6847.
//
// Solidity: function create2factory() view returns(address)
func (_EntryPoint *EntryPointSession) Create2factory() (common.Address, error) {
	return _EntryPoint.Contract.Create2factory(&_EntryPoint.CallOpts)
}

// Create2factory is a free data retrieval call binding the contract method 0x0bfb6847.
//
// Solidity: function create2factory() view returns(address)
func (_EntryPoint *EntryPointCallerSession) Create2factory() (common.Address, error) {
	return _EntryPoint.Contract.Create2factory(&_EntryPoint.CallOpts)
}

// Deposits is a free data retrieval call binding the contract method 0xfc7e286d.
//
// Solidity: function deposits(address ) view returns(uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint64 withdrawTime)
func (_EntryPoint *EntryPointCaller) Deposits(opts *bind.CallOpts, arg0 common.Address) (struct {
	Deposit         *big.Int
	Staked          bool
	Stake           *big.Int
	UnstakeDelaySec uint32
	WithdrawTime    uint64
}, error) {
	var out []interface{}
	err := _EntryPoint.contract.Call(opts, &out, "deposits", arg0)

	outstruct := new(struct {
		Deposit         *big.Int
		Staked          bool
		Stake           *big.Int
		UnstakeDelaySec uint32
		WithdrawTime    uint64
	})
	if err != nil {
		return *outstruct, err
	}

	outstruct.Deposit = *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)
	outstruct.Staked = *abi.ConvertType(out[1], new(bool)).(*bool)
	outstruct.Stake = *abi.ConvertType(out[2], new(*big.Int)).(**big.Int)
	outstruct.UnstakeDelaySec = *abi.ConvertType(out[3], new(uint32)).(*uint32)
	outstruct.WithdrawTime = *abi.ConvertType(out[4], new(uint64)).(*uint64)

	return *outstruct, err

}

// Deposits is a free data retrieval call binding the contract method 0xfc7e286d.
//
// Solidity: function deposits(address ) view returns(uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint64 withdrawTime)
func (_EntryPoint *EntryPointSession) Deposits(arg0 common.Address) (struct {
	Deposit         *big.Int
	Staked          bool
	Stake           *big.Int
	UnstakeDelaySec uint32
	WithdrawTime    uint64
}, error) {
	return _EntryPoint.Contract.Deposits(&_EntryPoint.CallOpts, arg0)
}

// Deposits is a free data retrieval call binding the contract method 0xfc7e286d.
//
// Solidity: function deposits(address ) view returns(uint112 deposit, bool staked, uint112 stake, uint32 unstakeDelaySec, uint64 withdrawTime)
func (_EntryPoint *EntryPointCallerSession) Deposits(arg0 common.Address) (struct {
	Deposit         *big.Int
	Staked          bool
	Stake           *big.Int
	UnstakeDelaySec uint32
	WithdrawTime    uint64
}, error) {
	return _EntryPoint.Contract.Deposits(&_EntryPoint.CallOpts, arg0)
}

// GetDepositInfo is a free data retrieval call binding the contract method 0x5287ce12.
//
// Solidity: function getDepositInfo(address account) view returns((uint112,bool,uint112,uint32,uint64) info)
func (_EntryPoint *EntryPointCaller) GetDepositInfo(opts *bind.CallOpts, account common.Address) (StakeManagerDepositInfo, error) {
	var out []interface{}
	err := _EntryPoint.contract.Call(opts, &out, "getDepositInfo", account)

	if err != nil {
		return *new(StakeManagerDepositInfo), err
	}

	out0 := *abi.ConvertType(out[0], new(StakeManagerDepositInfo)).(*StakeManagerDepositInfo)

	return out0, err

}

// GetDepositInfo is a free data retrieval call binding the contract method 0x5287ce12.
//
// Solidity: function getDepositInfo(address account) view returns((uint112,bool,uint112,uint32,uint64) info)
func (_EntryPoint *EntryPointSession) GetDepositInfo(account common.Address) (StakeManagerDepositInfo, error) {
	return _EntryPoint.Contract.GetDepositInfo(&_EntryPoint.CallOpts, account)
}

// GetDepositInfo is a free data retrieval call binding the contract method 0x5287ce12.
//
// Solidity: function getDepositInfo(address account) view returns((uint112,bool,uint112,uint32,uint64) info)
func (_EntryPoint *EntryPointCallerSession) GetDepositInfo(account common.Address) (StakeManagerDepositInfo, error) {
	return _EntryPoint.Contract.GetDepositInfo(&_EntryPoint.CallOpts, account)
}

// GetRequestId is a free data retrieval call binding the contract method 0x4baeaf8a.
//
// Solidity: function getRequestId((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes) userOp) view returns(bytes32)
func (_EntryPoint *EntryPointCaller) GetRequestId(opts *bind.CallOpts, userOp UserOperation) ([32]byte, error) {
	var out []interface{}
	err := _EntryPoint.contract.Call(opts, &out, "getRequestId", userOp)

	if err != nil {
		return *new([32]byte), err
	}

	out0 := *abi.ConvertType(out[0], new([32]byte)).(*[32]byte)

	return out0, err

}

// GetRequestId is a free data retrieval call binding the contract method 0x4baeaf8a.
//
// Solidity: function getRequestId((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes) userOp) view returns(bytes32)
func (_EntryPoint *EntryPointSession) GetRequestId(userOp UserOperation) ([32]byte, error) {
	return _EntryPoint.Contract.GetRequestId(&_EntryPoint.CallOpts, userOp)
}

// GetRequestId is a free data retrieval call binding the contract method 0x4baeaf8a.
//
// Solidity: function getRequestId((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes) userOp) view returns(bytes32)
func (_EntryPoint *EntryPointCallerSession) GetRequestId(userOp UserOperation) ([32]byte, error) {
	return _EntryPoint.Contract.GetRequestId(&_EntryPoint.CallOpts, userOp)
}

// GetSenderAddress is a free data retrieval call binding the contract method 0xc31e4354.
//
// Solidity: function getSenderAddress(bytes initCode, uint256 salt) view returns(address)
func (_EntryPoint *EntryPointCaller) GetSenderAddress(opts *bind.CallOpts, initCode []byte, salt *big.Int) (common.Address, error) {
	var out []interface{}
	err := _EntryPoint.contract.Call(opts, &out, "getSenderAddress", initCode, salt)

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// GetSenderAddress is a free data retrieval call binding the contract method 0xc31e4354.
//
// Solidity: function getSenderAddress(bytes initCode, uint256 salt) view returns(address)
func (_EntryPoint *EntryPointSession) GetSenderAddress(initCode []byte, salt *big.Int) (common.Address, error) {
	return _EntryPoint.Contract.GetSenderAddress(&_EntryPoint.CallOpts, initCode, salt)
}

// GetSenderAddress is a free data retrieval call binding the contract method 0xc31e4354.
//
// Solidity: function getSenderAddress(bytes initCode, uint256 salt) view returns(address)
func (_EntryPoint *EntryPointCallerSession) GetSenderAddress(initCode []byte, salt *big.Int) (common.Address, error) {
	return _EntryPoint.Contract.GetSenderAddress(&_EntryPoint.CallOpts, initCode, salt)
}

// GetSenderStorage is a free data retrieval call binding the contract method 0xec8b5dbf.
//
// Solidity: function getSenderStorage(address sender) view returns(uint256[] senderStorageCells)
func (_EntryPoint *EntryPointCaller) GetSenderStorage(opts *bind.CallOpts, sender common.Address) ([]*big.Int, error) {
	var out []interface{}
	err := _EntryPoint.contract.Call(opts, &out, "getSenderStorage", sender)

	if err != nil {
		return *new([]*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new([]*big.Int)).(*[]*big.Int)

	return out0, err

}

// GetSenderStorage is a free data retrieval call binding the contract method 0xec8b5dbf.
//
// Solidity: function getSenderStorage(address sender) view returns(uint256[] senderStorageCells)
func (_EntryPoint *EntryPointSession) GetSenderStorage(sender common.Address) ([]*big.Int, error) {
	return _EntryPoint.Contract.GetSenderStorage(&_EntryPoint.CallOpts, sender)
}

// GetSenderStorage is a free data retrieval call binding the contract method 0xec8b5dbf.
//
// Solidity: function getSenderStorage(address sender) view returns(uint256[] senderStorageCells)
func (_EntryPoint *EntryPointCallerSession) GetSenderStorage(sender common.Address) ([]*big.Int, error) {
	return _EntryPoint.Contract.GetSenderStorage(&_EntryPoint.CallOpts, sender)
}

// PaymasterStake is a free data retrieval call binding the contract method 0x17c6a987.
//
// Solidity: function paymasterStake() view returns(uint256)
func (_EntryPoint *EntryPointCaller) PaymasterStake(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _EntryPoint.contract.Call(opts, &out, "paymasterStake")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// PaymasterStake is a free data retrieval call binding the contract method 0x17c6a987.
//
// Solidity: function paymasterStake() view returns(uint256)
func (_EntryPoint *EntryPointSession) PaymasterStake() (*big.Int, error) {
	return _EntryPoint.Contract.PaymasterStake(&_EntryPoint.CallOpts)
}

// PaymasterStake is a free data retrieval call binding the contract method 0x17c6a987.
//
// Solidity: function paymasterStake() view returns(uint256)
func (_EntryPoint *EntryPointCallerSession) PaymasterStake() (*big.Int, error) {
	return _EntryPoint.Contract.PaymasterStake(&_EntryPoint.CallOpts)
}

// UnstakeDelaySec is a free data retrieval call binding the contract method 0x390b9978.
//
// Solidity: function unstakeDelaySec() view returns(uint32)
func (_EntryPoint *EntryPointCaller) UnstakeDelaySec(opts *bind.CallOpts) (uint32, error) {
	var out []interface{}
	err := _EntryPoint.contract.Call(opts, &out, "unstakeDelaySec")

	if err != nil {
		return *new(uint32), err
	}

	out0 := *abi.ConvertType(out[0], new(uint32)).(*uint32)

	return out0, err

}

// UnstakeDelaySec is a free data retrieval call binding the contract method 0x390b9978.
//
// Solidity: function unstakeDelaySec() view returns(uint32)
func (_EntryPoint *EntryPointSession) UnstakeDelaySec() (uint32, error) {
	return _EntryPoint.Contract.UnstakeDelaySec(&_EntryPoint.CallOpts)
}

// UnstakeDelaySec is a free data retrieval call binding the contract method 0x390b9978.
//
// Solidity: function unstakeDelaySec() view returns(uint32)
func (_EntryPoint *EntryPointCallerSession) UnstakeDelaySec() (uint32, error) {
	return _EntryPoint.Contract.UnstakeDelaySec(&_EntryPoint.CallOpts)
}

// AddStake is a paid mutator transaction binding the contract method 0x0396cb60.
//
// Solidity: function addStake(uint32 _unstakeDelaySec) payable returns()
func (_EntryPoint *EntryPointTransactor) AddStake(opts *bind.TransactOpts, _unstakeDelaySec uint32) (*types.Transaction, error) {
	return _EntryPoint.contract.Transact(opts, "addStake", _unstakeDelaySec)
}

// AddStake is a paid mutator transaction binding the contract method 0x0396cb60.
//
// Solidity: function addStake(uint32 _unstakeDelaySec) payable returns()
func (_EntryPoint *EntryPointSession) AddStake(_unstakeDelaySec uint32) (*types.Transaction, error) {
	return _EntryPoint.Contract.AddStake(&_EntryPoint.TransactOpts, _unstakeDelaySec)
}

// AddStake is a paid mutator transaction binding the contract method 0x0396cb60.
//
// Solidity: function addStake(uint32 _unstakeDelaySec) payable returns()
func (_EntryPoint *EntryPointTransactorSession) AddStake(_unstakeDelaySec uint32) (*types.Transaction, error) {
	return _EntryPoint.Contract.AddStake(&_EntryPoint.TransactOpts, _unstakeDelaySec)
}

// DepositTo is a paid mutator transaction binding the contract method 0xb760faf9.
//
// Solidity: function depositTo(address account) payable returns()
func (_EntryPoint *EntryPointTransactor) DepositTo(opts *bind.TransactOpts, account common.Address) (*types.Transaction, error) {
	return _EntryPoint.contract.Transact(opts, "depositTo", account)
}

// DepositTo is a paid mutator transaction binding the contract method 0xb760faf9.
//
// Solidity: function depositTo(address account) payable returns()
func (_EntryPoint *EntryPointSession) DepositTo(account common.Address) (*types.Transaction, error) {
	return _EntryPoint.Contract.DepositTo(&_EntryPoint.TransactOpts, account)
}

// DepositTo is a paid mutator transaction binding the contract method 0xb760faf9.
//
// Solidity: function depositTo(address account) payable returns()
func (_EntryPoint *EntryPointTransactorSession) DepositTo(account common.Address) (*types.Transaction, error) {
	return _EntryPoint.Contract.DepositTo(&_EntryPoint.TransactOpts, account)
}

// HandleOps is a paid mutator transaction binding the contract method 0x2815c17b.
//
// Solidity: function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes)[] ops, address beneficiary) returns()
func (_EntryPoint *EntryPointTransactor) HandleOps(opts *bind.TransactOpts, ops []UserOperation, beneficiary common.Address) (*types.Transaction, error) {
	return _EntryPoint.contract.Transact(opts, "handleOps", ops, beneficiary)
}

// HandleOps is a paid mutator transaction binding the contract method 0x2815c17b.
//
// Solidity: function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes)[] ops, address beneficiary) returns()
func (_EntryPoint *EntryPointSession) HandleOps(ops []UserOperation, beneficiary common.Address) (*types.Transaction, error) {
	return _EntryPoint.Contract.HandleOps(&_EntryPoint.TransactOpts, ops, beneficiary)
}

// HandleOps is a paid mutator transaction binding the contract method 0x2815c17b.
//
// Solidity: function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes)[] ops, address beneficiary) returns()
func (_EntryPoint *EntryPointTransactorSession) HandleOps(ops []UserOperation, beneficiary common.Address) (*types.Transaction, error) {
	return _EntryPoint.Contract.HandleOps(&_EntryPoint.TransactOpts, ops, beneficiary)
}

// InnerHandleOp is a paid mutator transaction binding the contract method 0x88799426.
//
// Solidity: function innerHandleOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes) op, (bytes32,uint256,uint8,uint256,uint256) opInfo, bytes context) returns(uint256 actualGasCost)
func (_EntryPoint *EntryPointTransactor) InnerHandleOp(opts *bind.TransactOpts, op UserOperation, opInfo EntryPointUserOpInfo, context []byte) (*types.Transaction, error) {
	return _EntryPoint.contract.Transact(opts, "innerHandleOp", op, opInfo, context)
}

// InnerHandleOp is a paid mutator transaction binding the contract method 0x88799426.
//
// Solidity: function innerHandleOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes) op, (bytes32,uint256,uint8,uint256,uint256) opInfo, bytes context) returns(uint256 actualGasCost)
func (_EntryPoint *EntryPointSession) InnerHandleOp(op UserOperation, opInfo EntryPointUserOpInfo, context []byte) (*types.Transaction, error) {
	return _EntryPoint.Contract.InnerHandleOp(&_EntryPoint.TransactOpts, op, opInfo, context)
}

// InnerHandleOp is a paid mutator transaction binding the contract method 0x88799426.
//
// Solidity: function innerHandleOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes) op, (bytes32,uint256,uint8,uint256,uint256) opInfo, bytes context) returns(uint256 actualGasCost)
func (_EntryPoint *EntryPointTransactorSession) InnerHandleOp(op UserOperation, opInfo EntryPointUserOpInfo, context []byte) (*types.Transaction, error) {
	return _EntryPoint.Contract.InnerHandleOp(&_EntryPoint.TransactOpts, op, opInfo, context)
}

// SimulateValidation is a paid mutator transaction binding the contract method 0x1a1c1141.
//
// Solidity: function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes) userOp) returns(uint256 preOpGas, uint256 prefund)
func (_EntryPoint *EntryPointTransactor) SimulateValidation(opts *bind.TransactOpts, userOp UserOperation) (*types.Transaction, error) {
	return _EntryPoint.contract.Transact(opts, "simulateValidation", userOp)
}

// SimulateValidation is a paid mutator transaction binding the contract method 0x1a1c1141.
//
// Solidity: function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes) userOp) returns(uint256 preOpGas, uint256 prefund)
func (_EntryPoint *EntryPointSession) SimulateValidation(userOp UserOperation) (*types.Transaction, error) {
	return _EntryPoint.Contract.SimulateValidation(&_EntryPoint.TransactOpts, userOp)
}

// SimulateValidation is a paid mutator transaction binding the contract method 0x1a1c1141.
//
// Solidity: function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,address,bytes,bytes) userOp) returns(uint256 preOpGas, uint256 prefund)
func (_EntryPoint *EntryPointTransactorSession) SimulateValidation(userOp UserOperation) (*types.Transaction, error) {
	return _EntryPoint.Contract.SimulateValidation(&_EntryPoint.TransactOpts, userOp)
}

// UnlockStake is a paid mutator transaction binding the contract method 0xbb9fe6bf.
//
// Solidity: function unlockStake() returns()
func (_EntryPoint *EntryPointTransactor) UnlockStake(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _EntryPoint.contract.Transact(opts, "unlockStake")
}

// UnlockStake is a paid mutator transaction binding the contract method 0xbb9fe6bf.
//
// Solidity: function unlockStake() returns()
func (_EntryPoint *EntryPointSession) UnlockStake() (*types.Transaction, error) {
	return _EntryPoint.Contract.UnlockStake(&_EntryPoint.TransactOpts)
}

// UnlockStake is a paid mutator transaction binding the contract method 0xbb9fe6bf.
//
// Solidity: function unlockStake() returns()
func (_EntryPoint *EntryPointTransactorSession) UnlockStake() (*types.Transaction, error) {
	return _EntryPoint.Contract.UnlockStake(&_EntryPoint.TransactOpts)
}

// WithdrawStake is a paid mutator transaction binding the contract method 0xc23a5cea.
//
// Solidity: function withdrawStake(address withdrawAddress) returns()
func (_EntryPoint *EntryPointTransactor) WithdrawStake(opts *bind.TransactOpts, withdrawAddress common.Address) (*types.Transaction, error) {
	return _EntryPoint.contract.Transact(opts, "withdrawStake", withdrawAddress)
}

// WithdrawStake is a paid mutator transaction binding the contract method 0xc23a5cea.
//
// Solidity: function withdrawStake(address withdrawAddress) returns()
func (_EntryPoint *EntryPointSession) WithdrawStake(withdrawAddress common.Address) (*types.Transaction, error) {
	return _EntryPoint.Contract.WithdrawStake(&_EntryPoint.TransactOpts, withdrawAddress)
}

// WithdrawStake is a paid mutator transaction binding the contract method 0xc23a5cea.
//
// Solidity: function withdrawStake(address withdrawAddress) returns()
func (_EntryPoint *EntryPointTransactorSession) WithdrawStake(withdrawAddress common.Address) (*types.Transaction, error) {
	return _EntryPoint.Contract.WithdrawStake(&_EntryPoint.TransactOpts, withdrawAddress)
}

// WithdrawTo is a paid mutator transaction binding the contract method 0x205c2878.
//
// Solidity: function withdrawTo(address withdrawAddress, uint256 withdrawAmount) returns()
func (_EntryPoint *EntryPointTransactor) WithdrawTo(opts *bind.TransactOpts, withdrawAddress common.Address, withdrawAmount *big.Int) (*types.Transaction, error) {
	return _EntryPoint.contract.Transact(opts, "withdrawTo", withdrawAddress, withdrawAmount)
}

// WithdrawTo is a paid mutator transaction binding the contract method 0x205c2878.
//
// Solidity: function withdrawTo(address withdrawAddress, uint256 withdrawAmount) returns()
func (_EntryPoint *EntryPointSession) WithdrawTo(withdrawAddress common.Address, withdrawAmount *big.Int) (*types.Transaction, error) {
	return _EntryPoint.Contract.WithdrawTo(&_EntryPoint.TransactOpts, withdrawAddress, withdrawAmount)
}

// WithdrawTo is a paid mutator transaction binding the contract method 0x205c2878.
//
// Solidity: function withdrawTo(address withdrawAddress, uint256 withdrawAmount) returns()
func (_EntryPoint *EntryPointTransactorSession) WithdrawTo(withdrawAddress common.Address, withdrawAmount *big.Int) (*types.Transaction, error) {
	return _EntryPoint.Contract.WithdrawTo(&_EntryPoint.TransactOpts, withdrawAddress, withdrawAmount)
}

// Receive is a paid mutator transaction binding the contract receive function.
//
// Solidity: receive() payable returns()
func (_EntryPoint *EntryPointTransactor) Receive(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _EntryPoint.contract.RawTransact(opts, nil) // calldata is disallowed for receive function
}

// Receive is a paid mutator transaction binding the contract receive function.
//
// Solidity: receive() payable returns()
func (_EntryPoint *EntryPointSession) Receive() (*types.Transaction, error) {
	return _EntryPoint.Contract.Receive(&_EntryPoint.TransactOpts)
}

// Receive is a paid mutator transaction binding the contract receive function.
//
// Solidity: receive() payable returns()
func (_EntryPoint *EntryPointTransactorSession) Receive() (*types.Transaction, error) {
	return _EntryPoint.Contract.Receive(&_EntryPoint.TransactOpts)
}

// EntryPointDepositedIterator is returned from FilterDeposited and is used to iterate over the raw logs and unpacked data for Deposited events raised by the EntryPoint contract.
type EntryPointDepositedIterator struct {
	Event *EntryPointDeposited // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *EntryPointDepositedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(EntryPointDeposited)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(EntryPointDeposited)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *EntryPointDepositedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *EntryPointDepositedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// EntryPointDeposited represents a Deposited event raised by the EntryPoint contract.
type EntryPointDeposited struct {
	Account      common.Address
	TotalDeposit *big.Int
	Raw          types.Log // Blockchain specific contextual infos
}

// FilterDeposited is a free log retrieval operation binding the contract event 0x2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c4.
//
// Solidity: event Deposited(address indexed account, uint256 totalDeposit)
func (_EntryPoint *EntryPointFilterer) FilterDeposited(opts *bind.FilterOpts, account []common.Address) (*EntryPointDepositedIterator, error) {

	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}

	logs, sub, err := _EntryPoint.contract.FilterLogs(opts, "Deposited", accountRule)
	if err != nil {
		return nil, err
	}
	return &EntryPointDepositedIterator{contract: _EntryPoint.contract, event: "Deposited", logs: logs, sub: sub}, nil
}

// WatchDeposited is a free log subscription operation binding the contract event 0x2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c4.
//
// Solidity: event Deposited(address indexed account, uint256 totalDeposit)
func (_EntryPoint *EntryPointFilterer) WatchDeposited(opts *bind.WatchOpts, sink chan<- *EntryPointDeposited, account []common.Address) (event.Subscription, error) {

	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}

	logs, sub, err := _EntryPoint.contract.WatchLogs(opts, "Deposited", accountRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(EntryPointDeposited)
				if err := _EntryPoint.contract.UnpackLog(event, "Deposited", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseDeposited is a log parse operation binding the contract event 0x2da466a7b24304f47e87fa2e1e5a81b9831ce54fec19055ce277ca2f39ba42c4.
//
// Solidity: event Deposited(address indexed account, uint256 totalDeposit)
func (_EntryPoint *EntryPointFilterer) ParseDeposited(log types.Log) (*EntryPointDeposited, error) {
	event := new(EntryPointDeposited)
	if err := _EntryPoint.contract.UnpackLog(event, "Deposited", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// EntryPointStakeLockedIterator is returned from FilterStakeLocked and is used to iterate over the raw logs and unpacked data for StakeLocked events raised by the EntryPoint contract.
type EntryPointStakeLockedIterator struct {
	Event *EntryPointStakeLocked // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *EntryPointStakeLockedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(EntryPointStakeLocked)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(EntryPointStakeLocked)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *EntryPointStakeLockedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *EntryPointStakeLockedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// EntryPointStakeLocked represents a StakeLocked event raised by the EntryPoint contract.
type EntryPointStakeLocked struct {
	Account      common.Address
	TotalStaked  *big.Int
	WithdrawTime *big.Int
	Raw          types.Log // Blockchain specific contextual infos
}

// FilterStakeLocked is a free log retrieval operation binding the contract event 0xa5ae833d0bb1dcd632d98a8b70973e8516812898e19bf27b70071ebc8dc52c01.
//
// Solidity: event StakeLocked(address indexed account, uint256 totalStaked, uint256 withdrawTime)
func (_EntryPoint *EntryPointFilterer) FilterStakeLocked(opts *bind.FilterOpts, account []common.Address) (*EntryPointStakeLockedIterator, error) {

	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}

	logs, sub, err := _EntryPoint.contract.FilterLogs(opts, "StakeLocked", accountRule)
	if err != nil {
		return nil, err
	}
	return &EntryPointStakeLockedIterator{contract: _EntryPoint.contract, event: "StakeLocked", logs: logs, sub: sub}, nil
}

// WatchStakeLocked is a free log subscription operation binding the contract event 0xa5ae833d0bb1dcd632d98a8b70973e8516812898e19bf27b70071ebc8dc52c01.
//
// Solidity: event StakeLocked(address indexed account, uint256 totalStaked, uint256 withdrawTime)
func (_EntryPoint *EntryPointFilterer) WatchStakeLocked(opts *bind.WatchOpts, sink chan<- *EntryPointStakeLocked, account []common.Address) (event.Subscription, error) {

	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}

	logs, sub, err := _EntryPoint.contract.WatchLogs(opts, "StakeLocked", accountRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(EntryPointStakeLocked)
				if err := _EntryPoint.contract.UnpackLog(event, "StakeLocked", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseStakeLocked is a log parse operation binding the contract event 0xa5ae833d0bb1dcd632d98a8b70973e8516812898e19bf27b70071ebc8dc52c01.
//
// Solidity: event StakeLocked(address indexed account, uint256 totalStaked, uint256 withdrawTime)
func (_EntryPoint *EntryPointFilterer) ParseStakeLocked(log types.Log) (*EntryPointStakeLocked, error) {
	event := new(EntryPointStakeLocked)
	if err := _EntryPoint.contract.UnpackLog(event, "StakeLocked", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// EntryPointStakeUnlockedIterator is returned from FilterStakeUnlocked and is used to iterate over the raw logs and unpacked data for StakeUnlocked events raised by the EntryPoint contract.
type EntryPointStakeUnlockedIterator struct {
	Event *EntryPointStakeUnlocked // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *EntryPointStakeUnlockedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(EntryPointStakeUnlocked)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(EntryPointStakeUnlocked)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *EntryPointStakeUnlockedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *EntryPointStakeUnlockedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// EntryPointStakeUnlocked represents a StakeUnlocked event raised by the EntryPoint contract.
type EntryPointStakeUnlocked struct {
	Account      common.Address
	WithdrawTime *big.Int
	Raw          types.Log // Blockchain specific contextual infos
}

// FilterStakeUnlocked is a free log retrieval operation binding the contract event 0xfa9b3c14cc825c412c9ed81b3ba365a5b459439403f18829e572ed53a4180f0a.
//
// Solidity: event StakeUnlocked(address indexed account, uint256 withdrawTime)
func (_EntryPoint *EntryPointFilterer) FilterStakeUnlocked(opts *bind.FilterOpts, account []common.Address) (*EntryPointStakeUnlockedIterator, error) {

	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}

	logs, sub, err := _EntryPoint.contract.FilterLogs(opts, "StakeUnlocked", accountRule)
	if err != nil {
		return nil, err
	}
	return &EntryPointStakeUnlockedIterator{contract: _EntryPoint.contract, event: "StakeUnlocked", logs: logs, sub: sub}, nil
}

// WatchStakeUnlocked is a free log subscription operation binding the contract event 0xfa9b3c14cc825c412c9ed81b3ba365a5b459439403f18829e572ed53a4180f0a.
//
// Solidity: event StakeUnlocked(address indexed account, uint256 withdrawTime)
func (_EntryPoint *EntryPointFilterer) WatchStakeUnlocked(opts *bind.WatchOpts, sink chan<- *EntryPointStakeUnlocked, account []common.Address) (event.Subscription, error) {

	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}

	logs, sub, err := _EntryPoint.contract.WatchLogs(opts, "StakeUnlocked", accountRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(EntryPointStakeUnlocked)
				if err := _EntryPoint.contract.UnpackLog(event, "StakeUnlocked", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseStakeUnlocked is a log parse operation binding the contract event 0xfa9b3c14cc825c412c9ed81b3ba365a5b459439403f18829e572ed53a4180f0a.
//
// Solidity: event StakeUnlocked(address indexed account, uint256 withdrawTime)
func (_EntryPoint *EntryPointFilterer) ParseStakeUnlocked(log types.Log) (*EntryPointStakeUnlocked, error) {
	event := new(EntryPointStakeUnlocked)
	if err := _EntryPoint.contract.UnpackLog(event, "StakeUnlocked", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// EntryPointStakeWithdrawnIterator is returned from FilterStakeWithdrawn and is used to iterate over the raw logs and unpacked data for StakeWithdrawn events raised by the EntryPoint contract.
type EntryPointStakeWithdrawnIterator struct {
	Event *EntryPointStakeWithdrawn // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *EntryPointStakeWithdrawnIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(EntryPointStakeWithdrawn)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(EntryPointStakeWithdrawn)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *EntryPointStakeWithdrawnIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *EntryPointStakeWithdrawnIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// EntryPointStakeWithdrawn represents a StakeWithdrawn event raised by the EntryPoint contract.
type EntryPointStakeWithdrawn struct {
	Account         common.Address
	WithdrawAddress common.Address
	Amount          *big.Int
	Raw             types.Log // Blockchain specific contextual infos
}

// FilterStakeWithdrawn is a free log retrieval operation binding the contract event 0xb7c918e0e249f999e965cafeb6c664271b3f4317d296461500e71da39f0cbda3.
//
// Solidity: event StakeWithdrawn(address indexed account, address withdrawAddress, uint256 amount)
func (_EntryPoint *EntryPointFilterer) FilterStakeWithdrawn(opts *bind.FilterOpts, account []common.Address) (*EntryPointStakeWithdrawnIterator, error) {

	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}

	logs, sub, err := _EntryPoint.contract.FilterLogs(opts, "StakeWithdrawn", accountRule)
	if err != nil {
		return nil, err
	}
	return &EntryPointStakeWithdrawnIterator{contract: _EntryPoint.contract, event: "StakeWithdrawn", logs: logs, sub: sub}, nil
}

// WatchStakeWithdrawn is a free log subscription operation binding the contract event 0xb7c918e0e249f999e965cafeb6c664271b3f4317d296461500e71da39f0cbda3.
//
// Solidity: event StakeWithdrawn(address indexed account, address withdrawAddress, uint256 amount)
func (_EntryPoint *EntryPointFilterer) WatchStakeWithdrawn(opts *bind.WatchOpts, sink chan<- *EntryPointStakeWithdrawn, account []common.Address) (event.Subscription, error) {

	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}

	logs, sub, err := _EntryPoint.contract.WatchLogs(opts, "StakeWithdrawn", accountRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(EntryPointStakeWithdrawn)
				if err := _EntryPoint.contract.UnpackLog(event, "StakeWithdrawn", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseStakeWithdrawn is a log parse operation binding the contract event 0xb7c918e0e249f999e965cafeb6c664271b3f4317d296461500e71da39f0cbda3.
//
// Solidity: event StakeWithdrawn(address indexed account, address withdrawAddress, uint256 amount)
func (_EntryPoint *EntryPointFilterer) ParseStakeWithdrawn(log types.Log) (*EntryPointStakeWithdrawn, error) {
	event := new(EntryPointStakeWithdrawn)
	if err := _EntryPoint.contract.UnpackLog(event, "StakeWithdrawn", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// EntryPointUserOperationEventIterator is returned from FilterUserOperationEvent and is used to iterate over the raw logs and unpacked data for UserOperationEvent events raised by the EntryPoint contract.
type EntryPointUserOperationEventIterator struct {
	Event *EntryPointUserOperationEvent // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *EntryPointUserOperationEventIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(EntryPointUserOperationEvent)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(EntryPointUserOperationEvent)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *EntryPointUserOperationEventIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *EntryPointUserOperationEventIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// EntryPointUserOperationEvent represents a UserOperationEvent event raised by the EntryPoint contract.
type EntryPointUserOperationEvent struct {
	RequestId      [32]byte
	Sender         common.Address
	Paymaster      common.Address
	Nonce          *big.Int
	ActualGasCost  *big.Int
	ActualGasPrice *big.Int
	Success        bool
	Raw            types.Log // Blockchain specific contextual infos
}

// FilterUserOperationEvent is a free log retrieval operation binding the contract event 0x33fd4d1f25a5461bea901784a6571de6debc16cd0831932c22c6969cd73ba994.
//
// Solidity: event UserOperationEvent(bytes32 indexed requestId, address indexed sender, address indexed paymaster, uint256 nonce, uint256 actualGasCost, uint256 actualGasPrice, bool success)
func (_EntryPoint *EntryPointFilterer) FilterUserOperationEvent(opts *bind.FilterOpts, requestId [][32]byte, sender []common.Address, paymaster []common.Address) (*EntryPointUserOperationEventIterator, error) {

	var requestIdRule []interface{}
	for _, requestIdItem := range requestId {
		requestIdRule = append(requestIdRule, requestIdItem)
	}
	var senderRule []interface{}
	for _, senderItem := range sender {
		senderRule = append(senderRule, senderItem)
	}
	var paymasterRule []interface{}
	for _, paymasterItem := range paymaster {
		paymasterRule = append(paymasterRule, paymasterItem)
	}

	logs, sub, err := _EntryPoint.contract.FilterLogs(opts, "UserOperationEvent", requestIdRule, senderRule, paymasterRule)
	if err != nil {
		return nil, err
	}
	return &EntryPointUserOperationEventIterator{contract: _EntryPoint.contract, event: "UserOperationEvent", logs: logs, sub: sub}, nil
}

// WatchUserOperationEvent is a free log subscription operation binding the contract event 0x33fd4d1f25a5461bea901784a6571de6debc16cd0831932c22c6969cd73ba994.
//
// Solidity: event UserOperationEvent(bytes32 indexed requestId, address indexed sender, address indexed paymaster, uint256 nonce, uint256 actualGasCost, uint256 actualGasPrice, bool success)
func (_EntryPoint *EntryPointFilterer) WatchUserOperationEvent(opts *bind.WatchOpts, sink chan<- *EntryPointUserOperationEvent, requestId [][32]byte, sender []common.Address, paymaster []common.Address) (event.Subscription, error) {

	var requestIdRule []interface{}
	for _, requestIdItem := range requestId {
		requestIdRule = append(requestIdRule, requestIdItem)
	}
	var senderRule []interface{}
	for _, senderItem := range sender {
		senderRule = append(senderRule, senderItem)
	}
	var paymasterRule []interface{}
	for _, paymasterItem := range paymaster {
		paymasterRule = append(paymasterRule, paymasterItem)
	}

	logs, sub, err := _EntryPoint.contract.WatchLogs(opts, "UserOperationEvent", requestIdRule, senderRule, paymasterRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(EntryPointUserOperationEvent)
				if err := _EntryPoint.contract.UnpackLog(event, "UserOperationEvent", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseUserOperationEvent is a log parse operation binding the contract event 0x33fd4d1f25a5461bea901784a6571de6debc16cd0831932c22c6969cd73ba994.
//
// Solidity: event UserOperationEvent(bytes32 indexed requestId, address indexed sender, address indexed paymaster, uint256 nonce, uint256 actualGasCost, uint256 actualGasPrice, bool success)
func (_EntryPoint *EntryPointFilterer) ParseUserOperationEvent(log types.Log) (*EntryPointUserOperationEvent, error) {
	event := new(EntryPointUserOperationEvent)
	if err := _EntryPoint.contract.UnpackLog(event, "UserOperationEvent", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// EntryPointUserOperationRevertReasonIterator is returned from FilterUserOperationRevertReason and is used to iterate over the raw logs and unpacked data for UserOperationRevertReason events raised by the EntryPoint contract.
type EntryPointUserOperationRevertReasonIterator struct {
	Event *EntryPointUserOperationRevertReason // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *EntryPointUserOperationRevertReasonIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(EntryPointUserOperationRevertReason)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(EntryPointUserOperationRevertReason)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *EntryPointUserOperationRevertReasonIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *EntryPointUserOperationRevertReasonIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// EntryPointUserOperationRevertReason represents a UserOperationRevertReason event raised by the EntryPoint contract.
type EntryPointUserOperationRevertReason struct {
	RequestId    [32]byte
	Sender       common.Address
	Nonce        *big.Int
	RevertReason []byte
	Raw          types.Log // Blockchain specific contextual infos
}

// FilterUserOperationRevertReason is a free log retrieval operation binding the contract event 0x1c4fada7374c0a9ee8841fc38afe82932dc0f8e69012e927f061a8bae611a201.
//
// Solidity: event UserOperationRevertReason(bytes32 indexed requestId, address indexed sender, uint256 nonce, bytes revertReason)
func (_EntryPoint *EntryPointFilterer) FilterUserOperationRevertReason(opts *bind.FilterOpts, requestId [][32]byte, sender []common.Address) (*EntryPointUserOperationRevertReasonIterator, error) {

	var requestIdRule []interface{}
	for _, requestIdItem := range requestId {
		requestIdRule = append(requestIdRule, requestIdItem)
	}
	var senderRule []interface{}
	for _, senderItem := range sender {
		senderRule = append(senderRule, senderItem)
	}

	logs, sub, err := _EntryPoint.contract.FilterLogs(opts, "UserOperationRevertReason", requestIdRule, senderRule)
	if err != nil {
		return nil, err
	}
	return &EntryPointUserOperationRevertReasonIterator{contract: _EntryPoint.contract, event: "UserOperationRevertReason", logs: logs, sub: sub}, nil
}

// WatchUserOperationRevertReason is a free log subscription operation binding the contract event 0x1c4fada7374c0a9ee8841fc38afe82932dc0f8e69012e927f061a8bae611a201.
//
// Solidity: event UserOperationRevertReason(bytes32 indexed requestId, address indexed sender, uint256 nonce, bytes revertReason)
func (_EntryPoint *EntryPointFilterer) WatchUserOperationRevertReason(opts *bind.WatchOpts, sink chan<- *EntryPointUserOperationRevertReason, requestId [][32]byte, sender []common.Address) (event.Subscription, error) {

	var requestIdRule []interface{}
	for _, requestIdItem := range requestId {
		requestIdRule = append(requestIdRule, requestIdItem)
	}
	var senderRule []interface{}
	for _, senderItem := range sender {
		senderRule = append(senderRule, senderItem)
	}

	logs, sub, err := _EntryPoint.contract.WatchLogs(opts, "UserOperationRevertReason", requestIdRule, senderRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(EntryPointUserOperationRevertReason)
				if err := _EntryPoint.contract.UnpackLog(event, "UserOperationRevertReason", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseUserOperationRevertReason is a log parse operation binding the contract event 0x1c4fada7374c0a9ee8841fc38afe82932dc0f8e69012e927f061a8bae611a201.
//
// Solidity: event UserOperationRevertReason(bytes32 indexed requestId, address indexed sender, uint256 nonce, bytes revertReason)
func (_EntryPoint *EntryPointFilterer) ParseUserOperationRevertReason(log types.Log) (*EntryPointUserOperationRevertReason, error) {
	event := new(EntryPointUserOperationRevertReason)
	if err := _EntryPoint.contract.UnpackLog(event, "UserOperationRevertReason", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// EntryPointWithdrawnIterator is returned from FilterWithdrawn and is used to iterate over the raw logs and unpacked data for Withdrawn events raised by the EntryPoint contract.
type EntryPointWithdrawnIterator struct {
	Event *EntryPointWithdrawn // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *EntryPointWithdrawnIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(EntryPointWithdrawn)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(EntryPointWithdrawn)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *EntryPointWithdrawnIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *EntryPointWithdrawnIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// EntryPointWithdrawn represents a Withdrawn event raised by the EntryPoint contract.
type EntryPointWithdrawn struct {
	Account         common.Address
	WithdrawAddress common.Address
	Amount          *big.Int
	Raw             types.Log // Blockchain specific contextual infos
}

// FilterWithdrawn is a free log retrieval operation binding the contract event 0xd1c19fbcd4551a5edfb66d43d2e337c04837afda3482b42bdf569a8fccdae5fb.
//
// Solidity: event Withdrawn(address indexed account, address withdrawAddress, uint256 amount)
func (_EntryPoint *EntryPointFilterer) FilterWithdrawn(opts *bind.FilterOpts, account []common.Address) (*EntryPointWithdrawnIterator, error) {

	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}

	logs, sub, err := _EntryPoint.contract.FilterLogs(opts, "Withdrawn", accountRule)
	if err != nil {
		return nil, err
	}
	return &EntryPointWithdrawnIterator{contract: _EntryPoint.contract, event: "Withdrawn", logs: logs, sub: sub}, nil
}

// WatchWithdrawn is a free log subscription operation binding the contract event 0xd1c19fbcd4551a5edfb66d43d2e337c04837afda3482b42bdf569a8fccdae5fb.
//
// Solidity: event Withdrawn(address indexed account, address withdrawAddress, uint256 amount)
func (_EntryPoint *EntryPointFilterer) WatchWithdrawn(opts *bind.WatchOpts, sink chan<- *EntryPointWithdrawn, account []common.Address) (event.Subscription, error) {

	var accountRule []interface{}
	for _, accountItem := range account {
		accountRule = append(accountRule, accountItem)
	}

	logs, sub, err := _EntryPoint.contract.WatchLogs(opts, "Withdrawn", accountRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(EntryPointWithdrawn)
				if err := _EntryPoint.contract.UnpackLog(event, "Withdrawn", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseWithdrawn is a log parse operation binding the contract event 0xd1c19fbcd4551a5edfb66d43d2e337c04837afda3482b42bdf569a8fccdae5fb.
//
// Solidity: event Withdrawn(address indexed account, address withdrawAddress, uint256 amount)
func (_EntryPoint *EntryPointFilterer) ParseWithdrawn(log types.Log) (*EntryPointWithdrawn, error) {
	event := new(EntryPointWithdrawn)
	if err := _EntryPoint.contract.UnpackLog(event, "Withdrawn", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
