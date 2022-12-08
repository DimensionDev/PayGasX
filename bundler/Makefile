abigen:
	-mkdir src/abi
	jq .abi ../artifacts/contracts/EntryPoint.sol/EntryPoint.json > src/abi/EntryPoint.json
	abigen --abi src/abi/EntryPoint.json --pkg abi --type EntryPoint --out src/abi/entrypoint.go

build:
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 sam build

deploy: build
	sam deploy

lambda-local: build
	sam local start-api
